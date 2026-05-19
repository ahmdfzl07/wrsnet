/**
 * WaFeaturesController.js
 * Handle: Templates, Reminder Settings, Report Settings & Preview
 */
const { WaTemplate, ReminderSetting, AppSetting, Invoice, Payment, Customer, Package, WaSession, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { getCompanyName } = require('../utils/companyInfo');

const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ── Helpers ──────────────────────────────────────────────────
async function getSetting(key, def = '') {
  const row = await AppSetting.findOne({ where: { key } });
  return row ? (row.value ?? def) : def;
}
async function setSetting(key, value, type = 'string') {
  await AppSetting.upsert({ key, value: String(value), type });
}
function fmtRp(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }

// ── TEMPLATE CRUD ─────────────────────────────────────────────
const templates = {
  async list(req, res) {
    try {
      const rows = await WaTemplate.findAll({ order: [['category','ASC'],['name','ASC']] });
      res.json({ success: true, data: rows });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async create(req, res) {
    try {
      const { name, category, content } = req.body;
      if (!name || !content) return res.status(400).json({ success: false, message: 'Nama dan isi template wajib diisi' });
      const variables = (content.match(/\{(\w+)\}/g) || []).map(v => v.slice(1,-1));
      const tpl = await WaTemplate.create({
        name, category: category || 'custom', content, message: content,
        variables, is_active: true, created_by: req.user?.id || null
      });
      res.status(201).json({ success: true, data: tpl, message: 'Template berhasil dibuat' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async update(req, res) {
    try {
      const tpl = await WaTemplate.findByPk(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, message: 'Template tidak ditemukan' });
      const { name, category, content } = req.body;
      const variables = (content.match(/\{(\w+)\}/g) || []).map(v => v.slice(1,-1));
      await tpl.update({ name, category, content, message: content, variables });
      res.json({ success: true, data: tpl, message: 'Template diupdate' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async toggle(req, res) {
    try {
      const tpl = await WaTemplate.findByPk(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, message: 'Template tidak ditemukan' });
      await tpl.update({ is_active: !tpl.is_active });
      res.json({ success: true, is_active: tpl.is_active, message: `Template ${tpl.is_active ? 'diaktifkan' : 'dinonaktifkan'}` });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async destroy(req, res) {
    try {
      const tpl = await WaTemplate.findByPk(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, message: 'Template tidak ditemukan' });
      await tpl.destroy();
      res.json({ success: true, message: 'Template dihapus' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  // Preview - render template dengan data dummy
  async preview(req, res) {
    try {
      const { content } = req.body;
      if (!content) return res.json({ success: true, preview: '' });
      const now = moment();
      // Helper: format tanggal Indonesia ("13 Mei 2026") tanpa butuh moment locale.
      // Pakai konstanta MONTHS modul (sudah Indonesia, baris 9).
      const fmtID = (m) => m.date() + ' ' + MONTHS[m.month()+1] + ' ' + m.year();
      const dummy = {
        // ── Identitas pelanggan ───────────────────────────────────────
        nama:           'Budi Santoso',
        cid:            'CID0042',
        phone:          '628123456789',
        nohp:           '628123456789',
        email:          'budi.santoso@example.com',
        alamat:         'Jl. Mawar No. 12, RT 03/RW 05, Depok',

        // ── Layanan / paket ───────────────────────────────────────────
        paket:          'Paket 20 Mbps Home',
        harga_paket:    'Rp 250.000',
        harga:          'Rp 250.000',  // alias lama
        tgl_install:    fmtID(now.clone()),

        // ── Tagihan / invoice ─────────────────────────────────────────
        invoice:        'INV-' + now.format('DDMM') + '-00042',
        periode:        MONTHS[now.month()+1] + ' ' + now.year(),
        jumlah:         'Rp 250.000',
        jatuh_tempo:    fmtID(now.clone().add(3,'days')),
        tgl_jatuh_tempo:fmtID(now.clone().add(3,'days')),
        duedate:        now.clone().add(3,'days').format('DD/MM/YYYY'),
        status:         'segera jatuh tempo',

        // ── Pembayaran (untuk kategori payment_confirm) ───────────────
        tgl_bayar:      fmtID(now.clone()),
        metode:         'Transfer BCA',
        ref_no:         'TRF' + now.format('YYYYMMDD'),
        due_date_baru:  fmtID(now.clone().add(30,'days')),

        // ── Identitas ISP / perusahaan ────────────────────────────────
        perusahaan:     await getCompanyName(),
        phone_cs:       process.env.COMPANY_PHONE || process.env.SUPPORT_PHONE || '0800-1234-5678',
        pppoe_user:     'budi.santoso',
        static_ip:      '10.10.10.42'
      };
      let preview = content;
      Object.keys(dummy).forEach(k => { preview = preview.split(`{${k}}`).join(dummy[k]); });
      res.json({ success: true, preview });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }
};

// ── REMINDER SETTINGS ─────────────────────────────────────────
const reminder = {
  async list(req, res) {
    try {
      // Pakai raw query untuk hindari masalah association
      const rows = await ReminderSetting.findAll({
        order: [['type', 'ASC'], ['days_offset', 'ASC']]
      });
      const typeOrder = { before: 0, due: 1, overdue: 2 };
      rows.sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || (a.days_offset - b.days_offset));

      // Ambil template secara terpisah lalu gabungkan manual
      const tpls = await WaTemplate.findAll({
        where: { is_active: true },
        attributes: ['id','name','category'],
        order: [['name','ASC']]
      });
      const tplMap = {};
      tpls.forEach(t => { tplMap[t.id] = t.toJSON(); });

      const data = rows.map(r => {
        const json = r.toJSON();
        json.template = json.template_id ? (tplMap[json.template_id] || null) : null;
        return json;
      });

      res.json({ success: true, data, templates: tpls });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async seed(req, res) {
    try {
      const defaults = [
        { id:1, type:'before',  days_offset:-3, send_time:'08:00:00', is_active:true },
        { id:2, type:'before',  days_offset:-1, send_time:'08:00:00', is_active:true },
        { id:3, type:'due',     days_offset:0,  send_time:'08:00:00', is_active:true },
        { id:4, type:'overdue', days_offset:1,  send_time:'08:00:00', is_active:true },
        { id:5, type:'overdue', days_offset:3,  send_time:'08:00:00', is_active:true },
      ];
      for (const d of defaults) {
        await ReminderSetting.upsert(d);
      }
      res.json({ success: true, message: '5 reminder settings berhasil dibuat' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async save(req, res) {
    try {
      const { reminders } = req.body; // array of {id, template_id, send_time, is_active}
      if (!Array.isArray(reminders)) return res.status(400).json({ success: false, message: 'Invalid data' });
      for (const r of reminders) {
        if (!r.id) continue;
        await ReminderSetting.update({
          template_id: r.template_id || null,
          send_time:   r.send_time || '08:00:00',
          is_active:   r.is_active ? 1 : 0
        }, { where: { id: r.id } });
      }
      res.json({ success: true, message: 'Pengaturan reminder berhasil disimpan' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  // Run reminder manually - send WA ke pelanggan yang sesuai kondisi
  async runNow(req, res) {
    try {
      const allReminders = await ReminderSetting.findAll({ where: { is_active: true } });
      const activeTpls = await WaTemplate.findAll({ where: { is_active: true } });
      const tplMap = {};
      activeTpls.forEach(t => { tplMap[t.id] = t; });
      const activeReminders = allReminders
        .filter(r => r.template_id && tplMap[r.template_id])
        .map(r => { r.template = tplMap[r.template_id]; return r; });
      if (!activeReminders.length) return res.json({ success: true, message: 'Tidak ada reminder aktif dengan template', sent: 0 });

      const WAService = require('../services/WAService');
      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) {
        return res.status(400).json({ success: false, message: 'Tidak ada WA session terhubung' });
      }

      const today = moment().format('YYYY-MM-DD');
      let sent = 0, failed = 0;

      for (const rm of activeReminders) {
        // Hitung target date berdasarkan type & days_offset
        let targetDate;
        if (rm.type === 'before') targetDate = moment().add(Math.abs(rm.days_offset), 'days').format('YYYY-MM-DD');
        else if (rm.type === 'due') targetDate = today;
        else targetDate = moment().subtract(Math.abs(rm.days_offset), 'days').format('YYYY-MM-DD');

        // Cari customer + invoice dengan due_date = targetDate (unpaid/overdue)
        // FIX: hapus destructuring [customers] — saat type:SELECT digunakan,
        // sequelize.query() return array langsung, bukan [results, metadata].
        const customers = await sequelize.query(
          `SELECT DISTINCT c.id, c.name, c.phone, c.customer_id AS cid,
                  pkg.name AS paket, pkg.price AS harga,
                  i.id AS invoice_id, i.invoice_number, i.due_date,
                  i.total AS jumlah, i.status AS inv_status,
                  i.period_month, i.period_year
           FROM customers c
           LEFT JOIN packages pkg ON pkg.id = c.package_id
           JOIN invoices i ON i.customer_id = c.id
           WHERE i.due_date = :dt AND i.status IN ('unpaid','overdue')
             AND c.phone IS NOT NULL AND c.phone != ''`,
          { replacements: { dt: targetDate }, type: sequelize.QueryTypes.SELECT }
        );

        const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const companyName = await getCompanyName();

        for (const cust of customers) {
          // Render template dengan placeholder lengkap (sinkron dengan
          // BillingController.sendReminder & WAController.bulkReminder)
          const periodeStr = cust.period_month
            ? (MONTHS[cust.period_month] || cust.period_month) + ' ' + (cust.period_year || '')
            : '';
          const dueDateStr = moment(cust.due_date).format('D MMMM YYYY');
          const raw = rm.template.content || rm.template.message || '';
          const vars = {
            '{nama}':             cust.name || '',
            '{nohp}':             cust.phone || '',
            '{phone}':            cust.phone || '',          // alias
            '{invoice}':          cust.invoice_number || '',
            '{paket}':            cust.paket || '–',
            '{periode}':          periodeStr,
            '{jumlah}':           fmtRp(cust.jumlah || 0),
            '{jatuh_tempo}':      dueDateStr,
            '{tgl_jatuh_tempo}':  dueDateStr,                 // alias
            '{status}':           cust.inv_status === 'overdue' ? '⚠️ JATUH TEMPO' : 'segera jatuh tempo',
            '{perusahaan}':       companyName,
            // Backward-compat dengan placeholder lama
            '{cid}':              cust.cid || '',
            '{harga}':            fmtRp(cust.harga || 0),
            '{duedate}':          moment(cust.due_date).format('DD/MM/YYYY')
          };
          const msg = Object.keys(vars).reduce(
            (acc, k) => acc.split(k).join(vars[k]),
            raw
          );
          try {
            await WAService.sendMessage(session.session_id, cust.phone, msg, null);
            sent++;
          } catch(e) { failed++; }
          await new Promise(r => setTimeout(r, 500)); // delay 500ms antar pesan
        }
      }

      res.json({ success: true, message: `Reminder dikirim: ${sent} sukses, ${failed} gagal`, sent, failed });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  // ── TEST SEND — kirim 1 reminder ke nomor HP custom untuk uji template render
  // Body: { phone, reminder_id?, template_id? }
  // Akan ambil 1 invoice unpaid/overdue real sebagai sample data; kalau tidak ada,
  // pakai data dummy.
  async testSend(req, res) {
    try {
      const { phone, reminder_id, template_id } = req.body || {};
      if (!phone) return res.status(400).json({ success: false, message: 'Nomor HP tujuan wajib diisi' });

      // Validasi format nomor (harus angka, minimal 8 digit)
      const cleanPhone = String(phone).replace(/[^\d]/g, '');
      if (cleanPhone.length < 8) return res.status(400).json({ success: false, message: 'Format nomor HP tidak valid' });

      // Resolve template — bisa dari reminder_id atau template_id langsung
      let tpl = null;
      if (template_id) {
        tpl = await WaTemplate.findByPk(template_id);
      } else if (reminder_id) {
        const rm = await ReminderSetting.findByPk(reminder_id);
        if (rm && rm.template_id) tpl = await WaTemplate.findByPk(rm.template_id);
      }
      if (!tpl) return res.status(400).json({ success: false, message: 'Template tidak ditemukan. Pilih reminder dengan template terlebih dulu.' });
      if (!(tpl.content || tpl.message)) return res.status(400).json({ success: false, message: 'Template kosong' });

      // Cek WA session
      const WAService = require('../services/WAService');
      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) {
        return res.status(400).json({ success: false, message: 'Tidak ada WA session terhubung' });
      }

      // Ambil 1 invoice unpaid/overdue real sebagai sample (kalau ada)
      const sampleRows = await sequelize.query(
        `SELECT c.name, c.phone, c.customer_id AS cid,
                pkg.name AS paket, pkg.price AS harga,
                i.invoice_number, i.due_date, i.total AS jumlah,
                i.status AS inv_status, i.period_month, i.period_year
         FROM customers c
         LEFT JOIN packages pkg ON pkg.id = c.package_id
         JOIN invoices i ON i.customer_id = c.id
         WHERE i.status IN ('unpaid','overdue')
         ORDER BY i.due_date DESC
         LIMIT 1`,
        { type: sequelize.QueryTypes.SELECT }
      );

      const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const companyName = await getCompanyName();
      const sample = sampleRows[0];

      let vars;
      let dataSource;
      if (sample) {
        dataSource = `customer real "${sample.name}" (invoice ${sample.invoice_number})`;
        const periodeStr = sample.period_month
          ? (MONTHS[sample.period_month] || sample.period_month) + ' ' + (sample.period_year || '')
          : '';
        const dueDateStr = moment(sample.due_date).format('D MMMM YYYY');
        vars = {
          '{nama}':             sample.name || '',
          '{nohp}':             sample.phone || '',
          '{phone}':            sample.phone || '',
          '{invoice}':          sample.invoice_number || '',
          '{paket}':            sample.paket || '–',
          '{periode}':          periodeStr,
          '{jumlah}':           fmtRp(sample.jumlah || 0),
          '{jatuh_tempo}':      dueDateStr,
          '{tgl_jatuh_tempo}':  dueDateStr,
          '{status}':           sample.inv_status === 'overdue' ? '⚠️ JATUH TEMPO' : 'segera jatuh tempo',
          '{perusahaan}':       companyName,
          '{cid}':              sample.cid || '',
          '{harga}':            fmtRp(sample.harga || 0),
          '{duedate}':          moment(sample.due_date).format('DD/MM/YYYY')
        };
      } else {
        dataSource = 'data dummy (tidak ada invoice unpaid di DB)';
        const now = moment();
        const dueIn3 = moment().add(3, 'days');
        vars = {
          '{nama}':             'Budi Santoso (TEST)',
          '{nohp}':             cleanPhone,
          '{phone}':            cleanPhone,
          '{invoice}':          'INV-' + now.format('DDMM') + '-TEST',
          '{paket}':            'Paket 20 Mbps Home',
          '{periode}':          MONTHS[now.month()+1] + ' ' + now.year(),
          '{jumlah}':           'Rp 250.000',
          '{jatuh_tempo}':      dueIn3.format('D MMMM YYYY'),
          '{tgl_jatuh_tempo}':  dueIn3.format('D MMMM YYYY'),
          '{status}':           'segera jatuh tempo',
          '{perusahaan}':       companyName,
          '{cid}':              'TEST001',
          '{harga}':            'Rp 250.000',
          '{duedate}':          dueIn3.format('DD/MM/YYYY')
        };
      }

      const raw = tpl.content || tpl.message;
      const msg = '🧪 *[TEST]* — pesan ini dikirim untuk uji template\n\n' +
        Object.keys(vars).reduce((acc, k) => acc.split(k).join(vars[k]), raw);

      try {
        await WAService.sendMessage(session.session_id, cleanPhone, msg, null);
        res.json({
          success: true,
          message: `Test pesan terkirim ke ${cleanPhone}`,
          template_used: tpl.name,
          data_source: dataSource,
          preview: msg
        });
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Gagal mengirim WA: ' + e.message });
      }
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }
};

// ── REPORT ────────────────────────────────────────────────────
const report = {
  async getSettings(req, res) {
    try {
      const keys = ['admin_notify_phones','report_enabled','report_schedules','report_sections','report_range','report_last_sent'];
      const rows = await AppSetting.findAll({ where: { key: { [Op.in]: keys } } });
      const cfg = {};
      rows.forEach(r => { cfg[r.key] = r.value; });
      res.json({ success: true, data: cfg });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async saveSettings(req, res) {
    try {
      const { phones, schedules, sections, range } = req.body;
      if (phones !== undefined) await setSetting('admin_notify_phones', JSON.stringify(phones), 'json');
      if (schedules) await setSetting('report_schedules', JSON.stringify(schedules), 'json');
      if (sections)  await setSetting('report_sections',  JSON.stringify(sections), 'json');
      if (range)     await setSetting('report_range', range);
      res.json({ success: true, message: 'Pengaturan laporan disimpan' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async preview(req, res) {
    try {
      const { range = 'this_month', from, to } = req.query;
      const sections = JSON.parse(req.query.sections || '{}');
      const { dateFrom, dateTo, label } = resolveRange(range, from, to);
      const data = await buildReportData(dateFrom, dateTo);
      const appName = await getCompanyName();
      // Load custom template if exists
      const { AppSetting } = require('../models');
      const tplRow = await AppSetting.findOne({ where: { key: 'report_template' } }).catch(() => null);
      const customTpl = tplRow?.value || '';
      const message = customTpl
        ? renderCustomTemplate(customTpl, data, appName, label)
        : buildReportMessage(data, appName, label, sections);
      res.json({ success: true, message, data, label, dateFrom, dateTo });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async sendNow(req, res) {
    try {
      const { range = 'this_month', sections = {}, phones: reqPhones } = req.body;
      const phonesRaw = await getSetting('admin_notify_phones', '[]');
      const phones = reqPhones?.length ? reqPhones : JSON.parse(phonesRaw || '[]');
      if (!phones.length) return res.status(400).json({ success: false, message: 'Belum ada nomor admin. Tambahkan di pengaturan.' });

      const WAService = require('../services/WAService');
      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) {
        return res.status(400).json({ success: false, message: 'Tidak ada WA session terhubung' });
      }

      const { dateFrom, dateTo, label } = resolveRange(range);
      const data = await buildReportData(dateFrom, dateTo);
      const appName = await getCompanyName();
      const tplRowS = await AppSetting.findOne({ where: { key: 'report_template' } }).catch(() => null);
      const customTplS = tplRowS?.value || '';
      const message = customTplS
        ? renderCustomTemplate(customTplS, data, appName, 'Laporan ' + label)
        : buildReportMessage(data, appName, 'Laporan ' + label, sections);

      let sent = 0, failed = 0;
      for (const phone of phones) {
        try {
          await WAService.sendMessage(session.session_id, phone, message, null);
          sent++;
        } catch(e) { failed++; }
        if (phones.length > 1) await new Promise(r => setTimeout(r, 1000));
      }

      await setSetting('report_last_sent', new Date().toISOString());
      res.json({ success: true, message: `Laporan dikirim ke ${sent} nomor`, sent, failed });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }
};

// ── Render custom template ────────────────────────────────────
function renderCustomTemplate(tpl, data, appName, label) {
  const sep  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const now  = new Date().toLocaleString('id-ID');
  const period = data.dateFrom && data.dateTo
    ? moment(data.dateFrom).format('DD/MM/YYYY') + ' - ' + moment(data.dateTo).format('DD/MM/YYYY')
    : '';

  return tpl
    .replace(/\{label\}/g,        label || '')
    .replace(/\{app_name\}/g,     appName)
    .replace(/\{period\}/g,       period)
    .replace(/\{aktif_cnt\}/g,    String(data.aktif?.cnt || 0))
    .replace(/\{aktif_total\}/g,  fmtRp(data.aktif?.total_harga || 0))
    .replace(/\{bayar_cnt\}/g,    String(data.bayar?.cnt || 0))
    .replace(/\{bayar_total\}/g,  fmtRp(data.bayar?.total || 0))
    .replace(/\{unpaid_cnt\}/g,   String(data.unpaidCnt || 0))
    .replace(/\{unpaid_total\}/g, fmtRp(data.unpaidTotal || 0))
    .replace(/\{rate\}/g,         String(data.rate || 0))
    .replace(/\{due_cnt\}/g,      String(data.dueSoon?.cnt || 0))
    .replace(/\{due_total\}/g,    fmtRp(data.dueSoon?.total || 0))
    .replace(/\{total_inv\}/g,    String(data.invPeriod?.total_inv || 0))
    .replace(/\{paid_inv\}/g,     String(data.invPeriod?.paid_inv || 0))
    .replace(/\{paid_list\}/g,    (data.paidList||[]).map((p,i)=>`${i+1}. ${p.name} (${p.cid}) — ${fmtRp(p.amount)}`).join('\n') || '–')
    .replace(/\{unpaid_list\}/g,  (data.unpaidList||[]).map((p,i)=>`${i+1}. ${p.name} (${p.cid}) — ${fmtRp(p.total)} — JT: ${moment(p.due_date).format('DD/MM/YYYY')}`).join('\n') || '–')
    .replace(/\{due_today_list\}/g,(data.dueTodayList||[]).map((p,i)=>`${i+1}. ${p.name} (${p.cid}) — ${fmtRp(p.total)}`).join('\n') || 'Tidak ada')
    .replace(/\{due_list\}/g,     (data.dueSoonList||[]).map(p=>`• ${p.name} (${p.cid}) tgl ${moment(p.due_date).format('DD/MM')}`).join('\n') || 'Tidak ada')
    .replace(/\{sep\}/g,          sep)
    .replace(/\{now\}/g,          now);
}

// ── Internal helpers ──────────────────────────────────────────
function resolveRange(range, customFrom, customTo) {
  const now = moment();
  let dateFrom, dateTo, label;
  switch(range) {
    case 'this_week':
      dateFrom = now.clone().startOf('isoWeek').format('YYYY-MM-DD');
      dateTo   = now.format('YYYY-MM-DD');
      label    = 'Minggu Ini'; break;
    case 'last_week':
      dateFrom = now.clone().subtract(1,'week').startOf('isoWeek').format('YYYY-MM-DD');
      dateTo   = now.clone().subtract(1,'week').endOf('isoWeek').format('YYYY-MM-DD');
      label    = 'Minggu Lalu'; break;
    case 'this_month':
      dateFrom = now.clone().startOf('month').format('YYYY-MM-DD');
      dateTo   = now.format('YYYY-MM-DD');
      label    = now.format('MMMM YYYY'); break;
    case 'last_month':
      const lm = now.clone().subtract(1,'month');
      dateFrom = lm.startOf('month').format('YYYY-MM-DD');
      dateTo   = lm.endOf('month').format('YYYY-MM-DD');
      label    = lm.format('MMMM YYYY'); break;
    default:
      dateFrom = customFrom || now.clone().subtract(30,'days').format('YYYY-MM-DD');
      dateTo   = customTo   || now.format('YYYY-MM-DD');
      label    = moment(dateFrom).format('DD/MM/YY') + ' - ' + moment(dateTo).format('DD/MM/YY');
  }
  return { dateFrom, dateTo, label };
}

async function buildReportData(dateFrom, dateTo) {
  const today = moment().format('YYYY-MM-DD');
  const in7   = moment().add(7,'days').format('YYYY-MM-DD');

  // Total pelanggan aktif & total tagihan bulanan (dari paket)
  const [[aktif]] = await sequelize.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(p.price),0) AS total_harga
     FROM customers c LEFT JOIN packages p ON p.id=c.package_id WHERE c.status='active'`
  );

  // Invoice yang di-generate dalam periode (berdasarkan created_at invoice)
  const [[invPeriod]] = await sequelize.query(
    `SELECT COUNT(*) AS total_inv,
            SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_inv,
            COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) AS paid_total,
            COALESCE(SUM(CASE WHEN status IN ('unpaid','overdue') THEN total ELSE 0 END),0) AS unpaid_total,
            SUM(CASE WHEN status IN ('unpaid','overdue') THEN 1 ELSE 0 END) AS unpaid_cnt
     FROM invoices
     WHERE period_month = MONTH(:dateFrom) AND period_year = YEAR(:dateFrom)`,
    { replacements: { dateFrom } }
  );

  // Pembayaran diterima dalam periode (berdasarkan payment_date)
  const [[bayar]] = await sequelize.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(py.amount),0) AS total
     FROM payments py WHERE DATE(py.payment_date) BETWEEN :dateFrom AND :dateTo`,
    { replacements: { dateFrom, dateTo } }
  );

  // Metode pembayaran dalam periode
  const methods = await sequelize.query(
    `SELECT py.payment_method AS method, COUNT(*) AS cnt, COALESCE(SUM(py.amount),0) AS total
     FROM payments py
     WHERE DATE(py.payment_date) BETWEEN :dateFrom AND :dateTo
     GROUP BY py.payment_method ORDER BY total DESC`,
    { replacements: { dateFrom, dateTo }, type: sequelize.QueryTypes.SELECT }
  );

  // Top pembayar dalam periode
  const topPayers = await sequelize.query(
    `SELECT c.name, c.customer_id AS cid, SUM(py.amount) AS total
     FROM payments py
     JOIN invoices i ON py.invoice_id=i.id
     JOIN customers c ON c.id=i.customer_id
     WHERE DATE(py.payment_date) BETWEEN :dateFrom AND :dateTo
     GROUP BY i.customer_id ORDER BY total DESC LIMIT 5`,
    { replacements: { dateFrom, dateTo }, type: sequelize.QueryTypes.SELECT }
  );

  // Jatuh tempo 7 hari ke depan (saat ini)
  const [[dueSoon]] = await sequelize.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total
     FROM invoices WHERE DATE(due_date) BETWEEN :today AND :in7
     AND status IN ('unpaid','overdue')`,
    { replacements: { today, in7 } }
  );

  // Detail: pelanggan sudah bayar periode ini
  const paidList = await sequelize.query(
    `SELECT c.name, c.customer_id AS cid, py.amount, py.payment_date
     FROM payments py
     JOIN invoices i ON py.invoice_id=i.id
     JOIN customers c ON c.id=i.customer_id
     WHERE DATE(py.payment_date) BETWEEN :dateFrom AND :dateTo
     ORDER BY py.payment_date DESC LIMIT 20`,
    { replacements: { dateFrom, dateTo }, type: sequelize.QueryTypes.SELECT }
  );

  // Detail: pelanggan belum bayar periode ini
  const unpaidList = await sequelize.query(
    `SELECT c.name, c.customer_id AS cid, i.total, i.due_date, i.invoice_number
     FROM invoices i
     JOIN customers c ON c.id=i.customer_id
     WHERE i.period_month=MONTH(:dateFrom) AND i.period_year=YEAR(:dateFrom)
     AND i.status IN ('unpaid','overdue')
     ORDER BY i.due_date ASC LIMIT 20`,
    { replacements: { dateFrom }, type: sequelize.QueryTypes.SELECT }
  );

  // Detail: jatuh tempo hari ini
  const dueTodayList = await sequelize.query(
    `SELECT c.name, c.customer_id AS cid, i.total, i.invoice_number
     FROM invoices i
     JOIN customers c ON c.id=i.customer_id
     WHERE DATE(i.due_date) = :today
     AND i.status IN ('unpaid','overdue')
     ORDER BY c.name ASC LIMIT 15`,
    { replacements: { today }, type: sequelize.QueryTypes.SELECT }
  );

  // Detail: jatuh tempo 3 hari ke depan (tidak termasuk hari ini)
  const in3 = moment().add(3,'days').format('YYYY-MM-DD');
  const dueSoonList = await sequelize.query(
    `SELECT c.name, c.customer_id AS cid, i.total, i.due_date
     FROM invoices i
     JOIN customers c ON c.id=i.customer_id
     WHERE DATE(i.due_date) BETWEEN DATE_ADD(:today, INTERVAL 1 DAY) AND :in3
     AND i.status IN ('unpaid','overdue')
     ORDER BY i.due_date ASC LIMIT 15`,
    { replacements: { today, in3 }, type: sequelize.QueryTypes.SELECT }
  );

  const unpaidCnt   = parseInt(invPeriod?.unpaid_cnt  || 0);
  const unpaidTotal = parseFloat(invPeriod?.unpaid_total || 0);
  const totalInv    = parseInt(invPeriod?.total_inv   || 0);
  const paidInv     = parseInt(invPeriod?.paid_inv    || 0);
  const rate        = totalInv > 0 ? Math.round(paidInv / totalInv * 100) : 0;

  return {
    aktif,
    bayar,
    invPeriod,
    methods,
    topPayers,
    dueSoon,
    paidList,
    unpaidList,
    dueTodayList,
    dueSoonList,
    unpaidCnt,
    unpaidTotal,
    rate,
    dateFrom,
    dateTo
  };
}

function buildReportMessage(data, appName, label, sections) {
  const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const now = new Date().toLocaleString('id-ID');
  let msg = '';

  // Header
  msg += `📊 *${label}*\n*${appName}*\n`;
  msg += `Periode : *${moment(data.dateFrom).format('DD/MM/YYYY')} - ${moment(data.dateTo).format('DD/MM/YYYY')}*\n${sep}`;

  // Summary
  if (sections.summary !== false) {
    msg += `\n\n*RINGKASAN TAGIHAN*\n`;
    msg += `Total Pelanggan Aktif : *${data.aktif?.cnt||0} pelanggan*\n`;
    msg += `Total Tagihan Periode : *${fmtRp(data.aktif?.total_harga||0)}*\n\n`;
    msg += `*Pembayaran Diterima*\n`;
    msg += `Transaksi  : *${data.bayar?.cnt||0} pembayaran*\n`;
    msg += `Diterima   : *${fmtRp(data.bayar?.total||0)}*\n\n`;
    msg += `*Belum Dibayar*\n`;
    msg += `Invoice    : *${data.unpaidCnt} invoice*\n`;
    msg += `Estimasi   : *${fmtRp(data.unpaidTotal)}*`;
  }

  // Collection rate
  if (sections.rate !== false) {
    msg += `\n\n${sep}\n*Collection Rate*\n`;
    msg += `${data.rate}% pelanggan sudah bayar`;
  }

  // Method breakdown
  if (sections.method && data.methods?.length) {
    const grandTotal = data.methods.reduce((a,m) => a+parseFloat(m.total), 0) || 1;
    const methodLabels = { cash:'Cash', transfer:'Transfer', dana:'DANA', ovo:'OVO', gopay:'GoPay', qris:'QRIS' };
    msg += `\n\n${sep}\n*Metode Pembayaran*\n`;
    data.methods.forEach(m => {
      const pct = Math.round(parseFloat(m.total)/grandTotal*100);
      msg += `• ${methodLabels[m.method]||m.method}: ${m.cnt}x - ${fmtRp(m.total)} (${pct}%)\n`;
    });
  }

  // Top payers
  if (sections.top && data.topPayers?.length) {
    msg += `\n${sep}\n*Top Pembayar*\n`;
    data.topPayers.slice(0,5).forEach((p,i) => {
      msg += `${i+1}. ${p.name} (${p.cid}) - ${fmtRp(p.total)}\n`;
    });
  }

  // Due soon
  if (sections.due) {
    msg += `\n${sep}\n*Jatuh Tempo 7 Hari ke Depan*\n`;
    msg += ` ${data.dueSoon?.cnt||0} pelanggan - ${fmtRp(data.dueSoon?.total||0)}`;
  }

  // Footer
  msg += `\n\n${sep}\n_Dikirim otomatis oleh ${appName}_\n_${now}_`;
  return msg;
}

module.exports = { templates, reminder, report };
