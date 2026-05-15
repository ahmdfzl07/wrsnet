const { Keuangan, User, sequelize } = require('../models');
const { Op }   = require('sequelize');
const moment   = require('moment');

const TYPE_LABEL = {
  pemasukan:  'Pemasukan',
  pengeluaran:'Pengeluaran',
  hutang:     'Hutang',
  piutang:    'Piutang',
  modal:      'Modal'
};

class KeuanganController {


  // ── POST /api/keuangan/sync-payments ──────────────────────
  // Impor pembayaran pelanggan bulan ini sebagai Pemasukan
  async syncPayments(req, res) {
    try {
      const month = parseInt(req.query.month) || moment().month() + 1;
      const year  = parseInt(req.query.year)  || moment().year();
      const start = moment(`${year}-${String(month).padStart(2,'0')}-01`).startOf('month').format('YYYY-MM-DD');
      const end   = moment(start).endOf('month').format('YYYY-MM-DD');

      // Ambil semua pembayaran bulan ini dengan data customer & invoice
      const payRows = await sequelize.query(
        `SELECT p.id AS payment_id,
                p.amount,
                p.payment_date,
                p.payment_method,
                p.reference_number,
                i.invoice_number,
                c.name AS cust_name,
                c.customer_id AS cid
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN customers c ON c.id = i.customer_id
         WHERE p.payment_date BETWEEN :start AND :end
         ORDER BY p.payment_date ASC`,
        { replacements:{start,end}, type: sequelize.QueryTypes.SELECT }
      );

      if (!payRows.length)
        return res.json({ success:true, message:'Tidak ada pembayaran di bulan ini', synced:0 });

      // Cek yang sudah pernah di-sync (ref_number format: PAY-{payment_id})
      const existingRefs = await Keuangan.findAll({
        where: {
          type: 'pemasukan',
          ref_number: { [require('sequelize').Op.in]: payRows.map(p=>`PAY-${p.payment_id}`) }
        },
        attributes: ['ref_number'],
        raw: true
      });
      const existingSet = new Set(existingRefs.map(r=>r.ref_number));

      // Filter yang belum di-sync
      const toSync = payRows.filter(p => !existingSet.has(`PAY-${p.payment_id}`));

      if (!toSync.length)
        return res.json({ success:true, message:'Semua pembayaran sudah tersinkronisasi', synced:0 });

      const METHOD_LABEL = {cash:'Cash',transfer:'Transfer Bank',dana:'DANA',ovo:'OVO',gopay:'GoPay',qris:'QRIS'};

      // Bulk insert
      const records = toSync.map(p => ({
        type:        'pemasukan',
        category:    'Pembayaran Pelanggan',
        description: `Pembayaran ${p.cust_name} (${p.cid})`,
        amount:      parseFloat(p.amount),
        date:        p.payment_date,
        ref_number:  `PAY-${p.payment_id}`,
        notes:       `Invoice: ${p.invoice_number || '-'} | Metode: ${METHOD_LABEL[p.payment_method]||p.payment_method||'-'}${p.reference_number ? ' | Ref: '+p.reference_number : ''}`,
        recorded_by: req.user?.id || null
      }));

      await Keuangan.bulkCreate(records);

      res.json({
        success: true,
        message: `Berhasil sinkronisasi ${records.length} pembayaran sebagai Pemasukan`,
        synced:  records.length
      });
    } catch(e) {
      console.error('[Keuangan.syncPayments]', e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── GET /api/keuangan/summary ──────────────────────────────
  async summary(req, res) {
    try {
      const month = parseInt(req.query.month) || moment().month() + 1;
      const year  = parseInt(req.query.year)  || moment().year();
      const start = moment(`${year}-${String(month).padStart(2,'0')}-01`).startOf('month').format('YYYY-MM-DD');
      const end   = moment(start).endOf('month').format('YYYY-MM-DD');

      const rows = await sequelize.query(
        `SELECT type,
                COALESCE(SUM(amount),0) AS total,
                COUNT(*) AS cnt
         FROM keuangan
         WHERE date BETWEEN :start AND :end
         GROUP BY type`,
        { replacements:{start,end}, type: sequelize.QueryTypes.SELECT }
      );

      // Aggregate per type
      const agg = { pemasukan:0, pengeluaran:0, hutang:0, piutang:0, modal:0 };
      const cnt = { pemasukan:0, pengeluaran:0, hutang:0, piutang:0, modal:0 };
      (Array.isArray(rows) ? rows : [rows]).filter(Boolean).forEach(r => {
        if (agg[r.type] !== undefined) {
          agg[r.type]  = parseFloat(r.total);
          cnt[r.type]  = parseInt(r.cnt);
        }
      });

      // Outstanding hutang & piutang (all time, belum lunas)
      const [hutangOut] = await sequelize.query(
        `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
         FROM keuangan WHERE type='hutang' AND (status='belum_lunas' OR status='cicilan')`,
        { type: sequelize.QueryTypes.SELECT }
      ) || [{}];
      const [piutangOut] = await sequelize.query(
        `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
         FROM keuangan WHERE type='piutang' AND (status='belum_lunas' OR status='cicilan')`,
        { type: sequelize.QueryTypes.SELECT }
      ) || [{}];

      // Cash flow = pemasukan + modal_masuk - pengeluaran (bulan ini)
      const cashflow = agg.pemasukan + agg.modal - agg.pengeluaran;

      // 6 month trend
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const ts = moment().year(year).month(month - 1).subtract(i, 'months');
        const s  = ts.clone().startOf('month').format('YYYY-MM-DD');
        const e  = ts.clone().endOf('month').format('YYYY-MM-DD');
        const trRows = await sequelize.query(
          `SELECT
             COALESCE(SUM(CASE WHEN type='pemasukan' THEN amount ELSE 0 END),0) AS pemasukan,
             COALESCE(SUM(CASE WHEN type='pengeluaran' THEN amount ELSE 0 END),0) AS pengeluaran
           FROM keuangan WHERE date BETWEEN :s AND :e`,
          { replacements:{s,e}, type: sequelize.QueryTypes.SELECT }
        );
        const tr = (Array.isArray(trRows) ? trRows[0] : trRows) || {};
        trend.push({
          label:      ts.format('MMM'),
          pemasukan:  parseFloat(tr.pemasukan||0),
          pengeluaran:parseFloat(tr.pengeluaran||0)
        });
      }

      // Category breakdown (pengeluaran) this month
      const catRows = await sequelize.query(
        `SELECT category, COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt
         FROM keuangan
         WHERE type='pengeluaran' AND date BETWEEN :start AND :end
         GROUP BY category ORDER BY total DESC LIMIT 8`,
        { replacements:{start,end}, type: sequelize.QueryTypes.SELECT }
      );

      res.json({
        success: true,
        data: {
          month, year, start, end,
          pemasukan:  agg.pemasukan,
          pengeluaran:agg.pengeluaran,
          modal:      agg.modal,
          hutangBulan:agg.hutang,
          piutangBulan:agg.piutang,
          hutangOutstanding:    parseFloat(hutangOut?.total||0),
          hutangOutstandingCnt: parseInt(hutangOut?.cnt||0),
          piutangOutstanding:   parseFloat(piutangOut?.total||0),
          piutangOutstandingCnt:parseInt(piutangOut?.cnt||0),
          cashflow,
          trend,
          catRows
        }
      });
    } catch(e) {
      console.error('[Keuangan.summary]', e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }


  // ── GET /api/keuangan/:id ──────────────────────────────────
  async show(req, res) {
    try {
      const record = await Keuangan.findByPk(req.params.id, {
        include: [{ model: User, as: 'recorder', attributes: ['id','name'], required: false }]
      });
      if (!record) return res.status(404).json({ success:false, message:'Data tidak ditemukan' });
      res.json({ success:true, data:record });
    } catch(e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── GET /api/keuangan ──────────────────────────────────────
  async index(req, res) {
    try {
      const { type, month, year, page=1, limit=50, search='' } = req.query;
      const where = {};

      if (type && type !== 'semua') where.type = type;

      if (month && year) {
        const start = moment(`${year}-${String(month).padStart(2,'0')}-01`).startOf('month').format('YYYY-MM-DD');
        const end   = moment(start).endOf('month').format('YYYY-MM-DD');
        where.date  = { [Op.between]: [start, end] };
      } else if (year) {
        where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
      }

      if (search) {
        where[Op.or] = [
          { description: { [Op.like]: `%${search}%` } },
          { category:    { [Op.like]: `%${search}%` } },
          { party_name:  { [Op.like]: `%${search}%` } },
          { ref_number:  { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (parseInt(page)-1) * parseInt(limit);
      const { count, rows } = await Keuangan.findAndCountAll({
        where,
        include: [{ model: User, as: 'recorder', attributes: ['id','name'], required: false }],
        order: [['date','DESC'],['id','DESC']],
        limit:  parseInt(limit),
        offset
      });

      res.json({ success:true, data:rows, total:count, page:parseInt(page), limit:parseInt(limit) });
    } catch(e) {
      console.error('[Keuangan.index]', e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── POST /api/keuangan ─────────────────────────────────────
  async store(req, res) {
    try {
      const {
        type, category, description, amount, date,
        due_date, party_name, status, source,
        ref_number, notes
      } = req.body;

      if (!type || !category || !description || !amount || !date)
        return res.status(400).json({ success:false, message:'Field wajib: type, category, description, amount, date' });

      if (!Object.keys(TYPE_LABEL).includes(type))
        return res.status(400).json({ success:false, message:'Type tidak valid' });

      const record = await Keuangan.create({
        type, category: category.trim(),
        description: description.trim(),
        amount: parseFloat(String(amount).replace(/[.,]/g,'')||0) || parseFloat(amount),
        date,
        due_date:   due_date   || null,
        party_name: party_name || null,
        status:     status     || null,
        source:     source     || null,
        ref_number: ref_number || null,
        notes:      notes      || null,
        recorded_by: req.user?.id || null
      });

      res.status(201).json({ success:true, message:`${TYPE_LABEL[type]} berhasil dicatat`, data:record });
    } catch(e) {
      console.error('[Keuangan.store]', e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── PUT /api/keuangan/:id ──────────────────────────────────
  async update(req, res) {
    try {
      const record = await Keuangan.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success:false, message:'Data tidak ditemukan' });

      const {
        type, category, description, amount, date,
        due_date, party_name, status, source,
        ref_number, notes
      } = req.body;

      await record.update({
        type:        type        || record.type,
        category:    category    ? category.trim()    : record.category,
        description: description ? description.trim() : record.description,
        amount:      amount ? (parseFloat(String(amount).replace(/[.,]/g,'')) || parseFloat(amount)) : record.amount,
        date:        date        || record.date,
        due_date:    due_date    !== undefined ? (due_date||null)    : record.due_date,
        party_name:  party_name  !== undefined ? (party_name||null)  : record.party_name,
        status:      status      !== undefined ? (status||null)      : record.status,
        source:      source      !== undefined ? (source||null)      : record.source,
        ref_number:  ref_number  !== undefined ? (ref_number||null)  : record.ref_number,
        notes:       notes       !== undefined ? (notes||null)       : record.notes
      });

      res.json({ success:true, message:'Data berhasil diperbarui', data:record });
    } catch(e) {
      console.error('[Keuangan.update]', e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── DELETE /api/keuangan/:id ───────────────────────────────
  async destroy(req, res) {
    const t = await sequelize.transaction();
    try {
      const record = await Keuangan.findByPk(req.params.id, { transaction: t });
      if (!record) {
        await t.rollback();
        return res.status(404).json({ success:false, message:'Data tidak ditemukan' });
      }

      // ═══════════════════════════════════════════════════════════
      // Cek apakah ini entry hasil sync dari Payment
      // Format ref_number: PAY-{payment_id}
      // ═══════════════════════════════════════════════════════════
      let paymentDeletedMsg = '';
      if (record.ref_number && record.ref_number.startsWith('PAY-')) {
        const paymentId = record.ref_number.replace('PAY-', '');
        
        try {
          const { Payment, Invoice } = require('../models');
          const payment = await Payment.findByPk(paymentId, { transaction: t });
          
          if (payment) {
            // Revert invoice ke unpaid
            await Invoice.update(
              { status: 'unpaid', paid_date: null }, 
              { where: { id: payment.invoice_id }, transaction: t }
            );
            
            // Hapus payment
            await payment.destroy({ transaction: t });
            paymentDeletedMsg = ' Payment terkait juga telah dihapus.';
            
            console.log(`[Keuangan] Auto-delete Payment ID ${paymentId} karena entry keuangan dihapus`);
          }
        } catch(paymentErr) {
          console.error('[Keuangan] Gagal delete payment terkait:', paymentErr.message);
          // Lanjutkan hapus entry keuangan meskipun delete payment gagal
        }
      }
      // ═══════════════════════════════════════════════════════════

      await record.destroy({ transaction: t });
      await t.commit();
      
      res.json({ 
        success:true, 
        message: 'Data berhasil dihapus.' + paymentDeletedMsg 
      });
    } catch(e) {
      await t.rollback();
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── PUT /api/keuangan/:id/lunas ────────────────────────────
  async markLunas(req, res) {
    try {
      const record = await Keuangan.findByPk(req.params.id);
      if (!record) return res.status(404).json({ success:false, message:'Data tidak ditemukan' });
      if (!['hutang','piutang'].includes(record.type))
        return res.status(400).json({ success:false, message:'Hanya hutang/piutang yang bisa ditandai lunas' });
      await record.update({ status:'lunas' });
      res.json({ success:true, message:'Ditandai lunas', data:record });
    } catch(e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ── GET /api/keuangan/categories ──────────────────────────
  async categories(req, res) {
    try {
      const rows = await Keuangan.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
        where: req.query.type ? { type: req.query.type } : {},
        raw: true
      });
      const cats = rows.map(r => r.category).filter(Boolean).sort();
      res.json({ success:true, data:cats });
    } catch(e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }
}

module.exports = new KeuanganController();