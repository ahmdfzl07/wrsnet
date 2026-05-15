const { Invoice, Payment, Customer, Package, FinancialReport, sequelize } = require('../models');
const { Op } = require('sequelize');
const { generateInvoiceNumber, paginateResponse, formatCurrency } = require('../utils/helpers');
const moment = require('moment');

/**
 * Status customer yang berhak menerima invoice generate bulanan.
 *
 * Definisi status (dari model Customer):
 *   - active    : pelanggan aktif normal — wajib invoice
 *   - isolated  : kena isolir (terlambat bayar, internet diputus sementara) —
 *                 tetap pelanggan, tetap wajib invoice bulan berikutnya
 *   - suspended : di-pause sementara (cuti panjang, dll) — tetap dapat invoice
 *                 sesuai kebijakan
 *   - inactive  : sudah berhenti berlangganan (churn) — TIDAK invoice
 *
 * Kalau suatu hari kebijakan berubah, ubah hanya satu konstanta ini dan
 * seluruh sistem ikut konsisten (generate manual, cron, preview, dst).
 */
const INVOICE_ELIGIBLE_STATUSES = ['active', 'isolated', 'suspended'];

class BillingController {
  // List invoices
  async listInvoices(req, res) {
    try {
      const { page = 1, limit = 20, status, customer_id, month, year, search } = req.query;
      const today = moment().format('YYYY-MM-DD');
      const where = {};

      // Filter status — 'overdue' adalah kondisi aktual (due_date < today + unpaid)
      if (status === 'overdue') {
        where.status   = { [Op.in]: ['unpaid','overdue'] };
        where.due_date = { [Op.lt]: today };
      } else if (status === 'unpaid') {
        where.status   = { [Op.in]: ['unpaid'] };
        where.due_date = { [Op.gte]: today };
      } else if (status) {
        where.status = status;
      }

      if (customer_id) where.customer_id = customer_id;
      if (month) where.period_month = month;
      if (year)  where.period_year  = year;

      // Search by customer name, CID, atau invoice number
      const includeOpts = [
        {
          model: Customer, as: 'customer',
          attributes: ['id', 'customer_id', 'name', 'phone'],
          where: search ? { [Op.or]: [
            { name:        { [Op.like]: '%' + search + '%' } },
            { customer_id: { [Op.like]: '%' + search + '%' } }
          ]} : undefined,
          required: !!search
        },
        {
          model: Payment, as: 'payments',
          attributes: ['id','amount','payment_method','payment_date','reference_number'],
          required: false,
          limit: 1,
          order: [['payment_date','DESC']]
        }
      ];

      if (search && !where[Op.or]) {
        // Also search by invoice_number
        const invWhere = { ...where, invoice_number: { [Op.like]: '%' + search + '%' } };
        const byInv = await Invoice.findAndCountAll({
          where: invWhere,
          include: [
            { model: Customer, as: 'customer', attributes: ['id','customer_id','name','phone'], required: false },
            { model: Payment, as: 'payments', attributes: ['id','amount','payment_method','payment_date','reference_number'], required: false, limit: 1, order: [['payment_date','DESC']] }
          ],
          offset: (page-1)*limit, limit: parseInt(limit), order: [['due_date','ASC'],['created_at','DESC']]
        });
        if (byInv.count > 0) {
          const { applyTaxToInvoiceList } = require('../utils/taxHelper');
          const adjusted = await applyTaxToInvoiceList(byInv.rows);
          return res.json({ success: true, ...paginateResponse(adjusted, byInv.count, page, limit) });
        }
      }

      const offset = (page - 1) * limit;
      const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: includeOpts,
        offset,
        limit: parseInt(limit),
        order: [['due_date', 'ASC'], ['created_at', 'DESC']]
      });

      // Apply current tax setting on-the-fly: kalau PPN nonaktif, force tax=0
      // & total=amount tanpa mengubah DB. Invoice lama yg dibuat saat PPN aktif
      // akan tampil tanpa pajak begitu setting dimatikan.
      const { applyTaxToInvoiceList } = require('../utils/taxHelper');
      const adjustedRows = await applyTaxToInvoiceList(rows);

      res.json({ success: true, ...paginateResponse(adjustedRows, count, page, limit) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Generate monthly invoices (HTTP endpoint)
  async generateInvoices(req, res) {
    try {
      const { month, year } = req.body;
      const targetMonth = month || moment().month() + 1;
      const targetYear  = year  || moment().year();

      const result = await BillingController.generateInvoicesForPeriod(targetMonth, targetYear, {
        source: 'manual'
      });

      // Bangun pesan yang lebih informatif — terutama saat hasil = 0,
      // biar user tahu kenapa (paling sering: tidak ada customer eligible,
      // atau customer belum punya package, atau invoice periode itu sudah ada)
      let message;
      if (result.created > 0) {
        message = `Berhasil generate ${result.created} invoice` +
          (result.skipped > 0 ? `, ${result.skipped} dilewati (sudah ada/tanpa paket)` : '');
      } else {
        const d = result.diagnostics || {};
        const elig = d.eligible_customers || 0;
        const bs = d.by_status || {};
        if (d.total_customers === 0) {
          message = `Tidak ada customer di database. Tambah customer dulu di halaman Customer Data.`;
        } else if (elig === 0) {
          // Tidak ada yang eligible — kemungkinan semua inactive
          message = `Tidak ada invoice ter-generate. Total ${d.total_customers} customer di database, tapi 0 yang eligible (status active/isolated/suspended). Inactive: ${bs.inactive || 0} customer. Update status customer di halaman Customer Data.`;
        } else if (d.skipped_existing > 0 && d.skipped_existing === d.processed) {
          message = `Semua ${d.processed} customer eligible sudah punya invoice di periode ${targetMonth}/${targetYear}. Tidak ada yang perlu di-generate ulang.`;
        } else if (d.skipped_no_package === d.processed) {
          message = `Semua ${d.processed} customer eligible belum dipasangkan ke paket. Set field "Paket" di halaman Customer Data dulu.`;
        } else if (d.skipped_no_package > 0) {
          message = `Tidak ada invoice ter-generate. ${d.skipped_no_package} dari ${d.processed} customer eligible belum punya paket, ${d.skipped_existing} sudah punya invoice di periode ini.`;
        } else {
          message = `Tidak ada invoice ter-generate. Eligible: ${elig} (active=${bs.active||0}, isolated=${bs.isolated||0}, suspended=${bs.suspended||0}), processed=${d.processed}, skipped_existing=${d.skipped_existing}, no_package=${d.skipped_no_package}.`;
        }
      }

      res.json({
        success: true,
        message,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Generate invoice untuk satu periode bulan/tahun. Reusable dari:
   *   - HTTP endpoint generateInvoices (manual via tombol)
   *   - CronService (auto monthly)
   *
   * Idempotent: kalau invoice sudah ada untuk customer di periode tsb, skip.
   *
   * @param {number} targetMonth 1..12
   * @param {number} targetYear  YYYY
   * @param {object} opts        { source: 'manual'|'cron'|'startup' }
   * @returns {object}           { created, skipped, period }
   */
  static async generateInvoicesForPeriod(targetMonth, targetYear, opts = {}) {
    const source = opts.source || 'manual';

    // Load PPN settings sekali untuk seluruh batch generate
    const { loadTaxSettings, computeTax } = require('../utils/taxHelper');
    const taxCfg = await loadTaxSettings();

    // Diagnostic: hitung customer di DB by status untuk troubleshooting
    // kalau hasil generate = 0 (mis-konfigurasi paling sering: status tidak eligible
    // atau customer belum dipasangkan ke package)
    const allCustomersCount = await Customer.count();
    const eligibleCount     = await Customer.count({
      where: { status: { [Op.in]: INVOICE_ELIGIBLE_STATUSES } }
    });
    // Breakdown per-status untuk transparansi (mis. user lihat ada berapa yg isolated)
    const activeCount       = await Customer.count({ where: { status: 'active'    } });
    const isolatedCount     = await Customer.count({ where: { status: 'isolated'  } });
    const suspendedCount    = await Customer.count({ where: { status: 'suspended' } });
    const inactiveCount     = await Customer.count({ where: { status: 'inactive'  } });

    // Get eligible customers (active + isolated + suspended; inactive tidak digenerate)
    const customers = await Customer.findAll({
      where: { status: { [Op.in]: INVOICE_ELIGIBLE_STATUSES } },
      include: [{ model: Package, as: 'package' }]
    });

    let created = 0;
    let skipped = 0;
    let skippedNoPackage = 0;
    let skippedExisting  = 0;
    let skippedFailed    = 0;

    // Ambil base sequence sekali di awal untuk hindari race condition
    const baseSeq = await Invoice.count({
      where: { period_month: targetMonth, period_year: targetYear }
    });
    let seqCounter = baseSeq + 1;

    for (const customer of customers) {
      // Check if invoice exists (idempotent)
      const existing = await Invoice.findOne({
        where: {
          customer_id: customer.id,
          period_month: targetMonth,
          period_year:  targetYear
        }
      });
      if (existing) { skipped++; skippedExisting++; continue; }

      if (!customer.package) { skipped++; skippedNoPackage++; continue; }

      // Hitung breakdown PPN
      const breakdown = computeTax(customer.package.price, taxCfg);
      const amount = breakdown.subtotal;
      const tax    = breakdown.tax;
      const total  = breakdown.total;

      // Due date: pakai customer.due_date (sinkron dengan halaman Customer Data),
      // fallback ke billing_date
      let dueDate;
      if (customer.due_date) {
        const custDue = new Date(customer.due_date + 'T00:00:00');
        const dueDay  = custDue.getDate();
        dueDate = moment(`${targetYear}-${String(targetMonth).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`);
      } else {
        dueDate = moment(`${targetYear}-${String(targetMonth).padStart(2,'0')}-${String(customer.billing_date || 10).padStart(2,'0')}`);
      }

      // Retry jika duplicate invoice_number (concurrent runs)
      let invoiceCreated = false;
      let retries = 0;
      while (!invoiceCreated && retries < 5) {
        try {
          await Invoice.create({
            invoice_number: generateInvoiceNumber(targetYear, targetMonth, seqCounter),
            customer_id: customer.id,
            amount, tax, total,
            status: 'unpaid',
            due_date: dueDate.format('YYYY-MM-DD'),
            period_month: targetMonth,
            period_year:  targetYear
          });
          invoiceCreated = true;
          seqCounter++;
          created++;
        } catch (createErr) {
          if (createErr.name === 'SequelizeUniqueConstraintError') {
            const last = await Invoice.findOne({
              where: { period_month: targetMonth, period_year: targetYear },
              order: [['id', 'DESC']]
            });
            seqCounter = last ? parseInt(last.invoice_number.split('-').pop()) + 1 : seqCounter + 1;
            retries++;
          } else {
            throw createErr;
          }
        }
      }
      if (!invoiceCreated) { skipped++; skippedFailed++; }
    }

    // Log diagnostic kalau hasil generate = 0 — agar mudah troubleshoot
    if (created === 0) {
      try {
        const { logger } = require('../utils/logger');
        logger.warn(`[BillingGen] 0 invoice ter-generate untuk ${targetMonth}/${targetYear}. ` +
          `total=${allCustomersCount} eligible=${eligibleCount} ` +
          `(active=${activeCount} isolated=${isolatedCount} suspended=${suspendedCount} inactive=${inactiveCount}) ` +
          `processed=${customers.length} skipped_existing=${skippedExisting} ` +
          `skipped_no_package=${skippedNoPackage} skipped_failed=${skippedFailed}`);
      } catch (_) {}
    }

    return {
      created,
      skipped,
      period: `${targetMonth}/${targetYear}`,
      source,
      diagnostics: {
        total_customers:        allCustomersCount,
        eligible_customers:     eligibleCount,
        // Backward-compat: field 'active_customers' tetap kembali agar code lama yg
        // baca field ini tidak rusak (mis. CronService log, dll)
        active_customers:       activeCount,
        non_active_customers:   allCustomersCount - eligibleCount,
        by_status: {
          active:    activeCount,
          isolated:  isolatedCount,
          suspended: suspendedCount,
          inactive:  inactiveCount
        },
        eligible_statuses:      INVOICE_ELIGIBLE_STATUSES,
        processed:              customers.length,
        skipped_existing:       skippedExisting,
        skipped_no_package:     skippedNoPackage,
        skipped_failed:         skippedFailed
      }
    };
  }

  // Record payment
  async recordPayment(req, res) {
    try {
      const { invoice_id, amount, payment_method, payment_date, reference_number, notes } = req.body;

      if (!invoice_id) return res.status(400).json({ success: false, message: 'invoice_id is required' });
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Amount harus lebih dari 0' });
      }

      const invoice = await Invoice.findByPk(invoice_id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      if (['paid', 'cancelled'].includes(invoice.status)) {
        return res.status(400).json({ success: false, message: `Invoice sudah berstatus ${invoice.status}` });
      }

      const payment = await Payment.create({
        invoice_id,
        amount: parseFloat(amount),
        payment_method: payment_method || 'cash',
        payment_date: payment_date || moment().format('YYYY-MM-DD'),
        reference_number,
        recorded_by: req.user.id,
        notes
      });

      // Check total payments
      const totalPaid = await Payment.sum('amount', { where: { invoice_id } });
      if (totalPaid >= parseFloat(invoice.total)) {
        await invoice.update({
          status: 'paid',
          paid_date: moment().format('YYYY-MM-DD')
        });
      }

      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Invoice detail
  async showInvoice(req, res) {
    try {
      const invoice = await Invoice.findByPk(req.params.id, {
        include: [
          { model: Customer, as: 'customer', include: [{ model: Package, as: 'package' }] },
          { model: Payment, as: 'payments' }
        ]
      });
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

      // Apply current tax setting on-the-fly (lihat penjelasan di listInvoices)
      const { applyCurrentTaxSetting, loadTaxSettings } = require('../utils/taxHelper');
      const taxCfg = await loadTaxSettings();
      const adjusted = applyCurrentTaxSetting(invoice, taxCfg);

      res.json({ success: true, data: adjusted });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Financial summary
  async financialSummary(req, res) {
    try {
      const { year } = req.query;
      const targetYear = year || moment().year();

      const totalRevenueResult = await sequelize.query(
        `SELECT COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         INNER JOIN invoices i ON p.invoice_id = i.id
         WHERE i.period_year = :year`,
        { replacements: { year: targetYear }, type: sequelize.QueryTypes.SELECT }
      );
      const totalRevenue = parseFloat(totalRevenueResult[0]?.total || 0);

      const totalInvoiced = await Invoice.sum('total', {
        where: { period_year: targetYear }
      }) || 0;

      const totalOutstanding = await Invoice.sum('total', {
        where: { period_year: targetYear, status: { [Op.in]: ['unpaid', 'overdue'] } }
      }) || 0;

      const invoiceCounts = await Invoice.findAll({
        where: { period_year: targetYear },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      // Monthly breakdown
      const monthlyRevenue = await Payment.findAll({
        attributes: [
          [sequelize.fn('MONTH', sequelize.col('payment_date')), 'month'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total']
        ],
        where: sequelize.where(sequelize.fn('YEAR', sequelize.col('payment_date')), targetYear),
        group: [sequelize.fn('MONTH', sequelize.col('payment_date'))],
        raw: true
      });

      res.json({
        success: true,
        data: {
          year: targetYear,
          totalRevenue,
          totalInvoiced,
          totalOutstanding,
          invoiceCounts,
          monthlyRevenue
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Mark overdue invoices
  async markOverdue(req, res) {
    try {
      const today = moment().format('YYYY-MM-DD');
      const [updated] = await Invoice.update(
        { status: 'overdue' },
        { where: { status: 'unpaid', due_date: { [Op.lt]: today } } }
      );
      res.json({ success: true, message: `Marked ${updated} invoices as overdue` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Sinkronisasi due_date invoice unpaid dari customer.due_date
  // Dipanggil dari tombol "Auto Due Date" di halaman customer
  async syncDueDates(req, res) {
    try {
      const { Customer, Invoice } = require('../models');

      // Ambil semua customer eligible (active+isolated+suspended) yang punya due_date.
      // Konsisten dengan kebijakan generate invoice — kalau customer isolated punya
      // invoice unpaid dan mereka update due_date di profil, invoice mereka juga
      // ikut sinkron.
      const customers = await Customer.findAll({
        where: { status: { [Op.in]: INVOICE_ELIGIBLE_STATUSES } },
        attributes: ['id', 'due_date', 'billing_date']
      });

      let updated = 0;
      let skipped = 0;

      for (const cust of customers) {
        if (!cust.due_date) { skipped++; continue; }

        // Ambil tanggal dari due_date customer
        const custDue = new Date(cust.due_date + 'T00:00:00');
        const dueDay  = custDue.getDate();

        // Update semua invoice unpaid milik customer ini:
        // Set due_date ke hari yang sama (dueDay) di bulan invoice masing-masing
        const invoices = await Invoice.findAll({
          where: { customer_id: cust.id, status: 'unpaid' },
          attributes: ['id', 'due_date', 'period_month', 'period_year']
        });

        for (const inv of invoices) {
          const newDue = `${inv.period_year}-${String(inv.period_month).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`;
          if (inv.due_date !== newDue) {
            await inv.update({ due_date: newDue });
            updated++;
          } else {
            skipped++;
          }
        }

        // Update customer.due_date ke bulan depan jika sudah lewat
        const today = new Date();
        today.setHours(0,0,0,0);
        if (custDue < today) {
          const nextDue = new Date(custDue.getFullYear(), custDue.getMonth()+1, dueDay);
          const y = nextDue.getFullYear();
          const m = String(nextDue.getMonth()+1).padStart(2,'0');
          const d = String(dueDay).padStart(2,'0');
          await cust.update({ due_date: `${y}-${m}-${d}` });
        }
      }

      res.json({ success: true, message: `Sinkronisasi selesai: ${updated} invoice diperbarui, ${skipped} dilewati`, data: { updated, skipped } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // Billing stats for dashboard
  async stats(req, res) {
    try {
      const currentMonth = moment().month() + 1;
      const currentYear  = moment().year();
      const today        = moment().format('YYYY-MM-DD');

      // Overdue: invoice unpaid/overdue yang due_date sudah lewat (semua periode)
      // Dihitung secara KONDISI AKTUAL — tidak perlu status='overdue' di DB
      const overdue = await Invoice.count({
        where: {
          status: { [Op.in]: ['unpaid','overdue'] },
          due_date: { [Op.lt]: today }
        }
      });

      // Unpaid: invoice unpaid yang due_date BELUM lewat (bulan berjalan)
      const unpaid = await Invoice.count({
        where: {
          status: { [Op.in]: ['unpaid','overdue'] },
          due_date: { [Op.gte]: today },
          period_month: currentMonth,
          period_year:  currentYear
        }
      });

      // Paid: invoice lunas bulan ini
      const paidThisMonth = await Invoice.count({
        where: { status: 'paid', period_month: currentMonth, period_year: currentYear }
      });

      // Revenue: total payment yang masuk bulan ini
      const firstDay = moment().startOf('month').format('YYYY-MM-DD');
      const lastDay  = moment().endOf('month').format('YYYY-MM-DD');
      const revenueThisMonth = await Payment.sum('amount', {
        where: { payment_date: { [Op.between]: [firstDay, lastDay] } }
      }) || 0;

      res.json({
        success: true,
        data: { unpaid, overdue, paidThisMonth, revenueThisMonth }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Send WA reminder untuk invoice overdue/unpaid
  async sendReminder(req, res) {
    try {
      const invoice = await Invoice.findByPk(req.params.id, {
        include: [{ model: Customer, as: 'customer', include: [{ model: Package, as: 'package' }] }]
      });
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
      if (!invoice.customer?.phone) return res.status(400).json({ success: false, message: 'Nomor HP pelanggan tidak tersedia' });

      const WAService = require('../services/WAService');
      const { WaSession, WaTemplate } = require('../models');
      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) {
        return res.status(400).json({ success: false, message: 'Tidak ada WA session yang terhubung' });
      }

      const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const fmtDate = s => s ? new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '–';
      const fmtRp   = n => 'Rp ' + Number(n).toLocaleString('id-ID');
      const c = invoice.customer;
      const periodeStr = (MONTHS[invoice.period_month]||invoice.period_month) + ' ' + invoice.period_year;
      const companyName = process.env.COMPANY_NAME || process.env.APP_NAME || 'ISP Provider';

      // ── Baca template dari DB sesuai status invoice ─────────────────
      // Mapping: overdue → reminder_overdue, unpaid → reminder_due
      // (Kalau mau, user bisa buat template H-N hari pakai reminder_before)
      const templateCategory = invoice.status === 'overdue' ? 'reminder_overdue' : 'reminder_due';
      const tpl = await WaTemplate.findOne({
        where: { category: templateCategory, is_active: true },
        order: [['updated_at', 'DESC']]
      });

      let msg;
      if (tpl && (tpl.content || tpl.message)) {
        // Render template — support placeholder {nama}, {invoice}, {paket}, {periode},
        // {jumlah}, {jatuh_tempo}, {tgl_jatuh_tempo}, {status}, {perusahaan}, {nohp}
        const raw = tpl.content || tpl.message;
        const dueDateStr = fmtDate(invoice.due_date);
        const vars = {
          '{nama}':             c.name || '',
          '{invoice}':          invoice.invoice_number || '',
          '{paket}':            c.package?.name || '–',
          '{periode}':          periodeStr,
          '{jumlah}':           fmtRp(invoice.total),
          '{jatuh_tempo}':      dueDateStr,
          '{tgl_jatuh_tempo}':  dueDateStr,   // alias
          '{status}':           invoice.status === 'overdue' ? '⚠️ JATUH TEMPO' : 'segera jatuh tempo',
          '{perusahaan}':       companyName,
          '{nohp}':             c.phone || '',
          '{phone}':            c.phone || ''  // alias backward-compat
        };
        msg = Object.keys(vars).reduce(
          (acc, k) => acc.split(k).join(vars[k]),
          raw
        );
        // Increment usage counter (best-effort)
        tpl.update({ usage_count: (tpl.usage_count || 0) + 1 }).catch(()=>{});
      } else {
        // Fallback hardcoded — tetap ada sebagai safety net kalau user belum
        // membuat template di /wa/templates
        msg =
          `*Tagihan Internet ${companyName}*\n\n` +
          `Halo *${c.name}*, tagihan internet Anda:\n\n` +
          `No Invoice : *${invoice.invoice_number}*\n` +
          `Paket      : ${c.package?.name || '–'}\n` +
          `Periode    : ${periodeStr}\n` +
          `Tagihan    : *${fmtRp(invoice.total)}*\n` +
          `atuh Tempo: *${fmtDate(invoice.due_date)}*\n\n` +
          `Mohon segera lakukan pembayaran agar layanan tetap aktif.\n` +
          `_Terima kasih_ 🙏`;
      }

      await WAService.sendMessage(session.session_id, c.phone, msg, null);
      res.json({
        success: true,
        message: `Reminder terkirim ke ${c.name} (${c.phone})`,
        template_used: tpl ? tpl.name : '(default fallback)'
      });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }
  // Customers with unpaid invoices
  async unpaidCustomers(req, res) {
    try {
      const { Customer, Package } = require('../models');
      const { Op } = require('sequelize');
      const rows = await Invoice.findAll({
        where: { status: { [Op.in]: ['unpaid','overdue'] } },
        attributes: ['customer_id'],
        group: ['customer_id'],
        include: [{ model: Customer, as: 'customer', attributes: ['id','customer_id','name','phone'], include: [{ model: Package, as: 'package', attributes: ['name','price'] }] }],
        raw: false
      });
      res.json({ success: true, data: rows.map(r => r.customer).filter(Boolean) });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // Total outstanding amount
  async totalOutstanding(req, res) {
    try {
      const { Op } = require('sequelize');
      const total = await Invoice.sum('total', { where: { status: { [Op.in]: ['unpaid','overdue'] } } }) || 0;
      res.json({ success: true, data: { total } });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }
  // Daftar customer dengan invoice unpaid
  async unpaidCustomers(req, res) {
    try {
      const { Invoice, Customer, Package } = require('../models');
      const rows = await Invoice.findAll({
        where: { status: { [Op.in]: ['unpaid','overdue'] } },
        include: [{
          model: Customer, as: 'customer',
          attributes: ['id','customer_id','name','phone','status'],
          include: [{ model: Package, as: 'package', attributes: ['name','price'] }]
        }],
        order: [['due_date','ASC']]
      });
      res.json({ success: true, data: rows });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // Total outstanding (jumlah tagihan belum lunas)
  async totalOutstanding(req, res) {
    try {
      const { Invoice } = require('../models');
      const { fn, col } = require('sequelize');
      const row = await Invoice.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('total')), 0), 'total']],
        where: { status: { [Op.in]: ['unpaid','overdue'] } },
        raw: true
      });
      res.json({ success: true, data: { total: parseFloat(row?.total || 0) } });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ════════════════════════════════════════════════════════════════
  // RESET / DELETE INVOICES (destructive — superadmin only)
  // ════════════════════════════════════════════════════════════════
  /**
   * Preview invoice yang akan dihapus berdasarkan filter mode.
   * Endpoint read-only untuk konfirmasi modal di frontend.
   *
   * Query params:
   *   - mode: 'all' | 'unpaid' | 'period'  (default: 'unpaid')
   *   - month, year: required jika mode='period'
   */
  async previewResetInvoices(req, res) {
    try {
      const mode  = String(req.query.mode || 'unpaid').toLowerCase();
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year  = req.query.year  ? parseInt(req.query.year)  : null;

      const where = BillingController._buildResetWhere(mode, month, year);
      if (where === null) {
        return res.status(400).json({ success: false, message: 'Parameter mode tidak valid' });
      }
      if (mode === 'period' && (!month || !year)) {
        return res.status(400).json({ success: false, message: 'Mode period membutuhkan parameter month & year' });
      }

      const invoiceCount = await Invoice.count({ where });
      const ids = (await Invoice.findAll({ where, attributes: ['id'], raw: true })).map(r => r.id);
      const paymentCount = ids.length
        ? await Payment.count({ where: { invoice_id: { [Op.in]: ids } } })
        : 0;

      // Hitung total nilai (paid_total = penerimaan yg akan ikut hilang dari laporan)
      const totalRow = ids.length
        ? await Invoice.findOne({
            where,
            attributes: [
              [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('total')), 0), 'gross_total']
            ],
            raw: true
          })
        : { gross_total: 0 };

      const paidRow = ids.length
        ? await Invoice.findOne({
            where: { ...where, status: 'paid' },
            attributes: [
              [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('total')), 0), 'paid_total']
            ],
            raw: true
          })
        : { paid_total: 0 };

      res.json({
        success: true,
        data: {
          mode,
          period: mode === 'period' ? `${month}/${year}` : null,
          invoice_count: invoiceCount,
          payment_count: paymentCount,
          gross_total:   parseFloat(totalRow?.gross_total || 0),
          paid_total:    parseFloat(paidRow?.paid_total  || 0)
        }
      });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  /**
   * Hapus invoice (DESTRUCTIVE) dengan cascade ke payments. Wrap di transaction.
   *
   * Body:
   *   - mode: 'all' | 'unpaid' | 'period'         (required)
   *   - month, year                               (required jika mode='period')
   *   - confirm: 'RESET'                          (required — anti accidental click)
   *
   * Hanya superadmin (lihat route guard).
   */
  async resetInvoices(req, res) {
    const t = await sequelize.transaction();
    try {
      const mode    = String(req.body.mode || '').toLowerCase();
      const month   = req.body.month ? parseInt(req.body.month) : null;
      const year    = req.body.year  ? parseInt(req.body.year)  : null;
      const confirm = String(req.body.confirm || '');

      if (confirm !== 'RESET') {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Konfirmasi tidak valid. Ketik "RESET" untuk melanjutkan.'
        });
      }

      const where = BillingController._buildResetWhere(mode, month, year);
      if (where === null) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Mode tidak valid (gunakan: all, unpaid, period)' });
      }
      if (mode === 'period' && (!month || !year)) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Mode period membutuhkan month & year' });
      }

      // Kumpulkan ID invoice dulu — supaya tahu payment mana yg juga harus dihapus
      const targetInvoices = await Invoice.findAll({
        where,
        attributes: ['id'],
        transaction: t,
        raw: true
      });
      const invoiceIds = targetInvoices.map(r => r.id);

      let deletedPayments = 0;
      if (invoiceIds.length > 0) {
        // Hapus payments dulu (FK constraint)
        deletedPayments = await Payment.destroy({
          where: { invoice_id: { [Op.in]: invoiceIds } },
          transaction: t
        });
      }

      // Hapus invoices
      const deletedInvoices = await Invoice.destroy({ where, transaction: t });

      await t.commit();

      // Audit log (best-effort, tidak blocking)
      try {
        const userId   = req.user?.id || null;
        const userName = req.user?.username || req.user?.name || 'unknown';
        const { logger } = require('../utils/logger');
        logger.warn('[BillingReset] User=' + userName + '(id=' + userId + ') mode=' + mode
          + (mode === 'period' ? ` period=${month}/${year}` : '')
          + ` deletedInvoices=${deletedInvoices} deletedPayments=${deletedPayments}`);
      } catch (_) {}

      res.json({
        success: true,
        message: `Berhasil menghapus ${deletedInvoices} invoice & ${deletedPayments} pembayaran`,
        data: {
          deleted_invoices: deletedInvoices,
          deleted_payments: deletedPayments,
          mode,
          period: mode === 'period' ? `${month}/${year}` : null
        }
      });
    } catch(e) {
      try { await t.rollback(); } catch (_) {}
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * Helper internal: bangun where-clause untuk operasi reset.
   * Return null kalau mode tidak valid.
   */
  static _buildResetWhere(mode, month, year) {
    switch (mode) {
      case 'all':
        return {}; // semua invoice
      case 'unpaid':
        return { status: { [Op.in]: ['unpaid','overdue'] } };
      case 'period':
        if (!month || !year) return null;
        return { period_month: month, period_year: year };
      default:
        return null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // RECALCULATE TAX — apply current PPN settings ke invoice unpaid
  // ════════════════════════════════════════════════════════════════
  /**
   * Recalculate kolom tax & total untuk invoice yang masih unpaid/overdue,
   * pakai setting PPN saat ini. Berguna saat:
   *   - User nonaktifkan PPN dan ingin invoice unpaid lama ikut tanpa pajak
   *   - User ubah tarif PPN dan ingin invoice unpaid mengikuti rate baru
   *
   * Invoice yg sudah 'paid' atau 'cancelled' tidak disentuh (audit safety).
   *
   * Body (opsional):
   *   - period_month, period_year — batasi ke periode tertentu (kalau tidak, semua unpaid)
   */
  async recalculateTax(req, res) {
    try {
      const { loadTaxSettings, computeTax } = require('../utils/taxHelper');
      const taxCfg = await loadTaxSettings(true); // force fresh
      const month  = req.body?.period_month ? parseInt(req.body.period_month) : null;
      const year   = req.body?.period_year  ? parseInt(req.body.period_year)  : null;

      const where = { status: { [Op.in]: ['unpaid','overdue'] } };
      if (month && year) { where.period_month = month; where.period_year = year; }

      // Untuk recalc kita butuh harga paket sebagai base — pakai (subtotal+tax) saat ini
      // sebagai input "harga paket asli", lalu hitung ulang dengan setting baru.
      // Cara ini bekerja baik untuk mode exclusive (subtotal=harga paket) maupun untuk
      // legacy invoice di mana tax kolom sudah benar.
      const invoices = await Invoice.findAll({
        where,
        include: [{ model: Customer, as: 'customer', include: [{ model: Package, as: 'package' }] }]
      });

      let updated = 0;
      let skipped = 0;
      for (const inv of invoices) {
        // Source of truth untuk "harga paket": package.price (kalau ada),
        // fallback ke (amount + tax) saat ini.
        const pkgPrice = inv.customer?.package?.price;
        const basePrice = (pkgPrice != null && Number(pkgPrice) > 0)
          ? Number(pkgPrice)
          : (Number(inv.amount) + Number(inv.tax || 0));

        const breakdown = computeTax(basePrice, taxCfg);
        const newAmount = breakdown.subtotal;
        const newTax    = breakdown.tax;
        const newTotal  = breakdown.total;

        // Skip kalau tidak ada perubahan (hindari write yang tidak perlu)
        if (Number(inv.amount) === newAmount && Number(inv.tax) === newTax && Number(inv.total) === newTotal) {
          skipped++;
          continue;
        }

        await inv.update({ amount: newAmount, tax: newTax, total: newTotal });
        updated++;
      }

      res.json({
        success: true,
        message: `Recalculate selesai: ${updated} invoice di-update, ${skipped} sudah sesuai`,
        data: {
          updated, skipped,
          tax_settings: { enabled: taxCfg.enabled, rate: taxCfg.rate, mode: taxCfg.mode, label: taxCfg.label }
        }
      });
    } catch(e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * Preview untuk modal Generate Invoice — kembalikan jumlah customer eligible,
   * berapa di antaranya yang punya package, dan berapa yang sudah punya invoice
   * di periode bulan/tahun yang diminta.
   *
   * Eligible status = INVOICE_ELIGIBLE_STATUSES (active + isolated + suspended).
   * Customer 'inactive' tidak ikut karena dianggap sudah berhenti berlangganan.
   *
   * Berguna agar user tahu sebelum klik Generate apakah ada customer yang
   * akan diproses, dan jika hasilnya 0 mereka tahu kenapa.
   *
   * Query:
   *   - month, year (opsional, kalau ada akan hitung skipped_existing untuk periode itu)
   */
  async previewGenerate(req, res) {
    try {
      const month = req.query.month ? parseInt(req.query.month) : null;
      const year  = req.query.year  ? parseInt(req.query.year)  : null;

      const totalCustomers    = await Customer.count();
      // Breakdown per-status untuk tampilan rinci di modal
      const activeCount       = await Customer.count({ where: { status: 'active'    } });
      const isolatedCount     = await Customer.count({ where: { status: 'isolated'  } });
      const suspendedCount    = await Customer.count({ where: { status: 'suspended' } });
      const inactiveCount     = await Customer.count({ where: { status: 'inactive'  } });

      const eligibleCustomers = await Customer.count({
        where: { status: { [Op.in]: INVOICE_ELIGIBLE_STATUSES } }
      });
      const eligibleWithPkg   = await Customer.count({
        where: {
          status: { [Op.in]: INVOICE_ELIGIBLE_STATUSES },
          package_id: { [Op.not]: null }
        }
      });

      let existingInPeriod = 0;
      if (month && year) {
        existingInPeriod = await Invoice.count({
          where: { period_month: month, period_year: year }
        });
      }

      // Estimasi: eligible-with-package dikurangi yang sudah punya invoice di
      // periode tsb. Asumsi simpel — bisa over-estimasi kalau invoice di periode
      // itu milik customer inactive (jarang), tapi cukup akurat untuk preview UX
      const estimatedToGenerate = Math.max(0, eligibleWithPkg - existingInPeriod);

      res.json({
        success: true,
        data: {
          total_customers:        totalCustomers,
          // Field utama (baru) — eligible berdasarkan kebijakan generate
          eligible_customers:     eligibleCustomers,
          eligible_with_package:  eligibleWithPkg,
          eligible_without_package: eligibleCustomers - eligibleWithPkg,
          eligible_statuses:      INVOICE_ELIGIBLE_STATUSES,
          // Breakdown per status (untuk transparansi)
          by_status: {
            active:    activeCount,
            isolated:  isolatedCount,
            suspended: suspendedCount,
            inactive:  inactiveCount
          },
          // Backward-compat: field lama tetap dikembalikan agar JS frontend yang
          // belum di-refresh (cache) tidak rusak total. Mapping: dulu "active"
          // sekarang ekuivalen dengan "eligible".
          active_customers:       eligibleCustomers,
          active_with_package:    eligibleWithPkg,
          active_without_package: eligibleCustomers - eligibleWithPkg,

          existing_in_period:     existingInPeriod,
          estimated_to_generate:  estimatedToGenerate,
          period: (month && year) ? `${month}/${year}` : null
        }
      });
    } catch(e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
}

module.exports = new BillingController();
module.exports.generateInvoicesForPeriod = BillingController.generateInvoicesForPeriod;