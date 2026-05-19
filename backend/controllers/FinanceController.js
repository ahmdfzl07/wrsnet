/**
 * FinanceController.js
 * ─────────────────────────────────────────────────────────────────
 * Endpoint pendukung untuk Finance Dashboard:
 *   - GET  /api/finance/activity         → mini activity log (audit)
 *   - GET  /api/finance/insights         → insight otomatis berbasis data
 *   - POST /api/finance/quick-expense    → catat pengeluaran cepat
 *   - GET  /api/finance/reminder-config  → status auto-reminder
 *   - POST /api/finance/reminder-config  → toggle auto-reminder
 */
const { Op } = require('sequelize');
const moment = require('moment');
const {
  ActivityLog, User, Invoice, Payment, Customer, Keuangan,
  ReminderSetting, WaSession, sequelize
} = require('../models');

class FinanceController {
  /**
   * GET /api/finance/activity?limit=10
   * Activity log yang relevan dengan finance (billing/payment/keuangan).
   */
  async activity(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const rows = await ActivityLog.findAll({
        where: {
          module: { [Op.in]: ['billing', 'payment', 'keuangan', 'customer'] }
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
        ],
        order: [['createdAt', 'DESC']],
        limit
      });

      const items = rows.map(r => ({
        id:          r.id,
        action:      r.action,
        module:      r.module,
        description: r.description,
        target_type: r.target_type,
        target_id:   r.target_id,
        created_at:  r.createdAt,
        user: r.user ? {
          id:   r.user.id,
          name: r.user.name
        } : { name: 'Sistem' }
      }));

      res.json({ success: true, data: items });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * GET /api/finance/insights
   * Generate insight otomatis berbasis data billing+keuangan.
   * Return array {type, severity, icon, title, message, action_url?}
   * severity: 'warning'|'info'|'success'|'danger'
   */
  async insights(req, res) {
    try {
      const today        = moment().format('YYYY-MM-DD');
      const monthStart   = moment().startOf('month').format('YYYY-MM-DD');
      const lastMonthSt  = moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      const lastMonthEnd = moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

      const insights = [];

      // ─── 1. Pelanggan overdue > 30 hari ───
      const stuck30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
      const stuckRows = await sequelize.query(
        `SELECT COUNT(DISTINCT customer_id) AS c, COALESCE(SUM(total),0) AS amt
           FROM invoices
          WHERE status IN ('unpaid','overdue') AND due_date < :stuck30Days`,
        { replacements: { stuck30Days }, type: sequelize.QueryTypes.SELECT }
      );
      const stuckCnt = parseInt(stuckRows[0]?.c || 0);
      const stuckAmt = parseFloat(stuckRows[0]?.amt || 0);
      if (stuckCnt > 0) {
        insights.push({
          type:     'churn_risk',
          severity: 'danger',
          icon:     'alert-triangle',
          title:    `${stuckCnt} pelanggan overdue >30 hari`,
          message:  `Total nilai Rp ${stuckAmt.toLocaleString('id-ID')}. Pertimbangkan isolir atau follow-up intensif.`,
          action_url:   '/billing',
          action_label: 'Lihat detail'
        });
      }

      // ─── 2. Collection rate naik/turun signifikan vs bulan lalu ───
      const curCol = await sequelize.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid
           FROM invoices
          WHERE period_year = :y AND period_month = :m`,
        { replacements: { y: moment().year(), m: moment().month() + 1 }, type: sequelize.QueryTypes.SELECT }
      );
      const lastCol = await sequelize.query(
        `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid
           FROM invoices
          WHERE period_year = :y AND period_month = :m`,
        { replacements: {
            y: moment().subtract(1, 'month').year(),
            m: moment().subtract(1, 'month').month() + 1
          }, type: sequelize.QueryTypes.SELECT }
      );
      const curRate  = (parseInt(curCol[0]?.total)  > 0) ? (parseInt(curCol[0].paid)  / parseInt(curCol[0].total))  * 100 : 0;
      const lastRate = (parseInt(lastCol[0]?.total) > 0) ? (parseInt(lastCol[0].paid) / parseInt(lastCol[0].total)) * 100 : 0;
      if (parseInt(lastCol[0]?.total) > 0) {
        const delta = curRate - lastRate;
        if (delta >= 5) {
          insights.push({
            type:     'collection_up',
            severity: 'success',
            icon:     'trending-up',
            title:    `Collection rate naik ${delta.toFixed(1)}%`,
            message:  `Dari ${lastRate.toFixed(1)}% bulan lalu jadi ${curRate.toFixed(1)}% bulan ini. Pertahankan ritme reminder!`,
          });
        } else if (delta <= -5) {
          insights.push({
            type:     'collection_down',
            severity: 'warning',
            icon:     'trending-down',
            title:    `Collection rate turun ${Math.abs(delta).toFixed(1)}%`,
            message:  `Dari ${lastRate.toFixed(1)}% bulan lalu jadi ${curRate.toFixed(1)}% bulan ini. Perlu tingkatkan follow-up.`,
            action_url:   '/finance',
            action_label: 'Cek detail'
          });
        }
      }

      // ─── 3. Channel pembayaran tumbuh signifikan vs bulan lalu ───
      const channelCur = await sequelize.query(
        `SELECT payment_method, COALESCE(SUM(amount),0) AS amt
           FROM payments
          WHERE payment_date >= :monthStart
          GROUP BY payment_method`,
        { replacements: { monthStart }, type: sequelize.QueryTypes.SELECT }
      );
      const channelLast = await sequelize.query(
        `SELECT payment_method, COALESCE(SUM(amount),0) AS amt
           FROM payments
          WHERE payment_date BETWEEN :lastSt AND :lastEnd
          GROUP BY payment_method`,
        { replacements: { lastSt: lastMonthSt, lastEnd: lastMonthEnd }, type: sequelize.QueryTypes.SELECT }
      );
      const lastMap = {};
      channelLast.forEach(r => { lastMap[r.payment_method] = parseFloat(r.amt || 0); });

      // Cari channel dengan growth tertinggi (relative %), threshold > 30%
      let topGrowth = null;
      channelCur.forEach(r => {
        const cur  = parseFloat(r.amt || 0);
        const last = lastMap[r.payment_method] || 0;
        if (last > 0 && cur > last) {
          const growth = ((cur - last) / last) * 100;
          if (growth >= 30 && (!topGrowth || growth > topGrowth.growth)) {
            topGrowth = { method: r.payment_method, growth, cur, last };
          }
        }
      });
      if (topGrowth) {
        const label = topGrowth.method.toUpperCase();
        insights.push({
          type:     'channel_growth',
          severity: 'info',
          icon:     'zap',
          title:    `Channel ${label} naik ${Math.round(topGrowth.growth)}%`,
          message:  `Dari Rp ${topGrowth.last.toLocaleString('id-ID')} jadi Rp ${topGrowth.cur.toLocaleString('id-ID')}. Channel paling tumbuh bulan ini.`,
        });
      }

      // ─── 4. Customer langganan telat 3x berturut-turut (churn risk) ───
      const churnRows = await sequelize.query(
        `SELECT customer_id, COUNT(*) AS late_count
           FROM invoices
          WHERE status IN ('unpaid','overdue') OR
                (status='paid' AND paid_date > due_date)
          GROUP BY customer_id
          HAVING late_count >= 3`,
        { type: sequelize.QueryTypes.SELECT }
      );
      if (churnRows.length > 0) {
        insights.push({
          type:     'churn_alert',
          severity: 'warning',
          icon:     'user-x',
          title:    `${churnRows.length} pelanggan churn-risk`,
          message:  `Punya riwayat telat bayar 3x atau lebih. Pertimbangkan komunikasi proaktif atau review paket.`,
          action_url:   '/customers',
          action_label: 'Buka pelanggan'
        });
      }

      // ─── 5. WA session status — TIDAK ditampilkan sebagai insight ───
      // Status koneksi WA Gateway tidak dirender sebagai banner karena
      // sudah ada notifikasi terpisah di halaman WhatsApp Gateway.
      // Menghindari spam banner saat WA sengaja offline atau dalam proses
      // reconnect.

      // ─── 6. Positive: tidak ada overdue ───
      if (insights.length === 0 || (stuckCnt === 0 && churnRows.length === 0)) {
        const overdueAll = await Invoice.count({
          where: { status: { [Op.in]: ['unpaid','overdue'] }, due_date: { [Op.lt]: today } }
        });
        if (overdueAll === 0) {
          insights.push({
            type:     'all_clear',
            severity: 'success',
            icon:     'check-circle',
            title:    'Tidak ada invoice overdue 🎉',
            message:  'Semua pelanggan up-to-date. Pertahankan kinerja!',
          });
        }
      }

      // Sort by severity priority: danger > warning > info > success
      const order = { danger: 0, warning: 1, info: 2, success: 3 };
      insights.sort((a, b) => (order[a.severity] || 9) - (order[b.severity] || 9));

      res.json({ success: true, data: insights.slice(0, 6) });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * POST /api/finance/quick-expense
   * Body: { amount, category, description?, party_name?, date? }
   */
  async quickExpense(req, res) {
    try {
      const { amount, category, description, party_name, date } = req.body || {};
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Jumlah pengeluaran wajib diisi (> 0)' });
      }
      if (!category || !String(category).trim()) {
        return res.status(400).json({ success: false, message: 'Kategori wajib diisi' });
      }

      const row = await Keuangan.create({
        type:        'pengeluaran',
        amount:      amt,
        category:    String(category).trim(),
        description: description ? String(description).trim() : null,
        party_name:  party_name ? String(party_name).trim() : null,
        date:        date || moment().format('YYYY-MM-DD'),
      });

      try {
        await ActivityLog.create({
          user_id:     req.user?.id || null,
          action:      'create_expense',
          module:      'keuangan',
          description: `Catat pengeluaran Rp ${amt.toLocaleString('id-ID')} (${category})`,
          target_type: 'keuangan',
          target_id:   row.id
        });
      } catch(_) {}

      res.json({
        success: true,
        message: 'Pengeluaran berhasil dicatat',
        data: { id: row.id, amount: amt, category, date: row.date }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * GET /api/finance/reminder-config
   * Return status reminder otomatis per type (before/due/overdue).
   */
  async reminderConfig(req, res) {
    try {
      const rows = await ReminderSetting.findAll({ order: [['type','ASC'], ['days_offset','ASC']] });
      const enabled = rows.some(r => r.is_active);
      res.json({
        success: true,
        data: {
          enabled,
          rules: rows.map(r => ({
            id:          r.id,
            type:        r.type,
            days_offset: r.days_offset,
            send_time:   r.send_time,
            is_active:   r.is_active,
            template_id: r.template_id
          }))
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * POST /api/finance/reminder-config
   * Body: { enabled: bool }
   * Toggle ON/OFF semua aturan reminder sekaligus.
   * Untuk edit aturan detail (waktu, template), tetap pakai /wa/reminder.
   */
  async toggleReminder(req, res) {
    try {
      const enabled = !!req.body?.enabled;
      const [affected] = await ReminderSetting.update(
        { is_active: enabled },
        { where: {} }
      );

      try {
        await ActivityLog.create({
          user_id:     req.user?.id || null,
          action:      enabled ? 'enable_auto_reminder' : 'disable_auto_reminder',
          module:      'billing',
          description: `Auto-reminder WA: ${enabled ? 'ON' : 'OFF'}`,
        });
      } catch(_) {}

      res.json({
        success: true,
        message: `Auto-reminder ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`,
        data: { enabled, affected }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
}

module.exports = new FinanceController();
