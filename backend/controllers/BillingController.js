const { Invoice, Payment, Customer, Package, FinancialReport, sequelize } = require('../models');
const { Op } = require('sequelize');
const { generateInvoiceNumber, paginateResponse, formatCurrency } = require('../utils/helpers');
const moment = require('moment');
const { getCompanyName } = require('../utils/companyInfo');

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

      // Belum Bayar: TOTAL invoice yang belum dibayar — TANPA filter periode
      // atau due_date. Mencakup baik yang masih dalam tempo maupun yang sudah
      // lewat jatuh tempo. Ini adalah jumlah aktual invoice unpaid keseluruhan
      // di sistem (sumber kebenaran tunggal: kolom `status`).
      const unpaid = await Invoice.count({
        where: {
          status: { [Op.in]: ['unpaid','overdue'] }
        }
      });

      // Paid: invoice lunas bulan ini
      const paidThisMonth = await Invoice.count({
        where: { status: 'paid', period_month: currentMonth, period_year: currentYear }
      });

      // Jumlah PELANGGAN UNIK yang invoicenya paid bulan ini.
      // Berbeda dengan paidThisMonth (jumlah invoice) — jika 1 pelanggan
      // bayar 2 invoice maka di sini tetap dihitung 1.
      const paidCustomerRows = await Invoice.findAll({
        where: { status: 'paid', period_month: currentMonth, period_year: currentYear },
        attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('customer_id'))), 'cnt']],
        raw: true
      });
      const paidCustomerCount = parseInt(paidCustomerRows?.[0]?.cnt || 0);

      // Revenue: total payment yang masuk bulan ini
      const firstDay = moment().startOf('month').format('YYYY-MM-DD');
      const lastDay  = moment().endOf('month').format('YYYY-MM-DD');
      const revenueThisMonth = await Payment.sum('amount', {
        where: { payment_date: { [Op.between]: [firstDay, lastDay] } }
      }) || 0;

      res.json({
        success: true,
        data: {
          unpaid,
          overdue,
          paidThisMonth,
          paidCustomerCount,
          revenueThisMonth
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/billing/collection-stats
   * ───────────────────────────────────────────────────────────────
   * Statistik collection rate bulan berjalan (atau bulan yang
   * disebut via query ?month=&year=):
   *  - total_invoices      : jumlah invoice bulan tsb
   *  - paid_count          : jumlah invoice lunas
   *  - unpaid_count        : jumlah invoice unpaid/overdue (belum bayar)
   *  - total_billed        : total nilai invoice (semua status)
   *  - total_collected     : total nilai invoice yang sudah lunas
   *  - total_outstanding   : total nilai invoice belum lunas
   *  - collection_rate     : (paid_count / total_invoices) × 100
   *  - collection_rate_amt : (total_collected / total_billed) × 100
   *  - paid_customers      : jumlah pelanggan unik yang sudah bayar
   *  - unpaid_customers    : jumlah pelanggan unik yang belum bayar
   *
   * Catatan: hitung berbasis invoice.status — sumber kebenaran tunggal.
   */
  async collectionStats(req, res) {
    try {
      const month = parseInt(req.query.month) || (moment().month() + 1);
      const year  = parseInt(req.query.year)  || moment().year();
      const today    = moment().format('YYYY-MM-DD');
      const in3Days  = moment().add(3, 'days').format('YYYY-MM-DD');

      // Total invoice bulan ini (per status) — query agregat tunggal
      const rows = await sequelize.query(
        `SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(total),0) AS total_amount,
            COALESCE(SUM(CASE WHEN status='paid'                  THEN 1 ELSE 0 END),0) AS paid_count,
            COALESCE(SUM(CASE WHEN status='paid'                  THEN total ELSE 0 END),0) AS paid_amount,
            COALESCE(SUM(CASE WHEN status IN ('unpaid','overdue') THEN 1 ELSE 0 END),0) AS unpaid_count,
            COALESCE(SUM(CASE WHEN status IN ('unpaid','overdue') THEN total ELSE 0 END),0) AS unpaid_amount,
            COALESCE(SUM(CASE WHEN status='overdue'               THEN 1 ELSE 0 END),0) AS overdue_count,
            COALESCE(SUM(CASE WHEN status='overdue'               THEN total ELSE 0 END),0) AS overdue_amount,
            COUNT(DISTINCT CASE WHEN status='paid'                  THEN customer_id END) AS paid_customers,
            COUNT(DISTINCT CASE WHEN status IN ('unpaid','overdue') THEN customer_id END) AS unpaid_customers
          FROM invoices
          WHERE period_year=:year AND period_month=:month`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT }
      );

      const r = (Array.isArray(rows) ? rows[0] : rows) || {};
      const total_invoices    = parseInt(r.total_count       || 0);
      const total_billed      = parseFloat(r.total_amount    || 0);
      const paid_count        = parseInt(r.paid_count        || 0);
      const total_collected   = parseFloat(r.paid_amount     || 0);
      const unpaid_count      = parseInt(r.unpaid_count      || 0);
      const total_outstanding = parseFloat(r.unpaid_amount   || 0);
      const overdue_count     = parseInt(r.overdue_count     || 0);
      const overdue_amount    = parseFloat(r.overdue_amount  || 0);
      const paid_customers    = parseInt(r.paid_customers    || 0);
      const unpaid_customers  = parseInt(r.unpaid_customers  || 0);

      // Collection rate (by count, by amount)
      const collection_rate     = total_invoices > 0
        ? Math.round((paid_count / total_invoices) * 1000) / 10   // 1 desimal
        : 0;
      const collection_rate_amt = total_billed > 0
        ? Math.round((total_collected / total_billed) * 1000) / 10
        : 0;

      // ───── Due-date buckets (across ALL periods, not just this month) ─────
      // due_today      : due_date = today, status unpaid/overdue
      // due_in_3_days  : due_date dalam 1-3 hari ke depan, status unpaid/overdue
      // past_due       : due_date < today, status unpaid/overdue
      // Pakai 1 query agregat agar efisien (index `due_date` membantu).
      const [dueRow] = await sequelize.query(
        `SELECT
            COALESCE(SUM(CASE WHEN due_date = :today                                 THEN 1 ELSE 0 END),0) AS due_today_count,
            COALESCE(SUM(CASE WHEN due_date = :today                                 THEN total ELSE 0 END),0) AS due_today_amount,
            COALESCE(SUM(CASE WHEN due_date > :today  AND due_date <= :in3Days       THEN 1 ELSE 0 END),0) AS due_3days_count,
            COALESCE(SUM(CASE WHEN due_date > :today  AND due_date <= :in3Days       THEN total ELSE 0 END),0) AS due_3days_amount,
            COALESCE(SUM(CASE WHEN due_date < :today                                 THEN 1 ELSE 0 END),0) AS past_due_count,
            COALESCE(SUM(CASE WHEN due_date < :today                                 THEN total ELSE 0 END),0) AS past_due_amount,
            COUNT(DISTINCT CASE WHEN due_date = :today                               THEN customer_id END) AS due_today_customers,
            COUNT(DISTINCT CASE WHEN due_date > :today AND due_date <= :in3Days      THEN customer_id END) AS due_3days_customers,
            COUNT(DISTINCT CASE WHEN due_date < :today                               THEN customer_id END) AS past_due_customers
          FROM invoices
          WHERE status IN ('unpaid','overdue')`,
        { replacements: { today, in3Days }, type: sequelize.QueryTypes.SELECT }
      ) || [{}];

      const due_today_count       = parseInt(dueRow?.due_today_count       || 0);
      const due_today_amount      = parseFloat(dueRow?.due_today_amount    || 0);
      const due_today_customers   = parseInt(dueRow?.due_today_customers   || 0);
      const due_3days_count       = parseInt(dueRow?.due_3days_count       || 0);
      const due_3days_amount      = parseFloat(dueRow?.due_3days_amount    || 0);
      const due_3days_customers   = parseInt(dueRow?.due_3days_customers   || 0);
      const past_due_count        = parseInt(dueRow?.past_due_count        || 0);
      const past_due_amount       = parseFloat(dueRow?.past_due_amount     || 0);
      const past_due_customers    = parseInt(dueRow?.past_due_customers    || 0);

      res.json({
        success: true,
        data: {
          month, year,
          total_invoices, total_billed,
          paid_count, total_collected, paid_customers,
          unpaid_count, total_outstanding, unpaid_customers,
          overdue_count, overdue_amount,
          collection_rate, collection_rate_amt,
          // due-date buckets
          due_today_count,    due_today_amount,    due_today_customers,
          due_3days_count,    due_3days_amount,    due_3days_customers,
          past_due_count,     past_due_amount,     past_due_customers,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/billing/due-date-lists
   * ───────────────────────────────────────────────────────────────
   * Daftar invoice + nama pelanggan per bucket due-date.
   * Bucket:
   *   - due_today     : due_date = today, unpaid/overdue
   *   - due_3days     : due_date 1-3 hari ke depan, unpaid/overdue
   *   - past_due      : due_date < today, unpaid/overdue
   *   - unpaid_all    : SEMUA invoice unpaid/overdue (Belum Bayar total)
   *
   * Query: ?limit=8 (default 8 per bucket, max 50)
   * Return: { due_today:[...], due_3days:[...], past_due:[...], unpaid_all:[...] }
   *   Each item: { invoice_id, invoice_number, due_date, total, status,
   *                customer_id, customer_name, customer_phone, days }
   */
  async dueDateLists(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 8, 50);
      const today    = moment().format('YYYY-MM-DD');
      const in3Days  = moment().add(3, 'days').format('YYYY-MM-DD');

      // Helper: query satu bucket
      // Pakai raw query supaya bisa JOIN customer dalam 1 round-trip
      async function fetchBucket(where, order = 'i.due_date ASC') {
        const rows = await sequelize.query(
          `SELECT
              i.id               AS invoice_id,
              i.invoice_number   AS invoice_number,
              i.due_date         AS due_date,
              i.total            AS total,
              i.status           AS status,
              i.last_wa_reminder_at AS last_wa_reminder_at,
              c.id               AS customer_id,
              c.customer_id      AS cid,
              c.name             AS customer_name,
              c.phone            AS customer_phone
            FROM invoices i
            JOIN customers c ON c.id = i.customer_id
            WHERE i.status IN ('unpaid','overdue') AND ${where}
            ORDER BY ${order}
            LIMIT ${limit}`,
          { replacements: { today, in3Days }, type: sequelize.QueryTypes.SELECT }
        );
        return rows.map(r => {
          // hitung selisih hari (negatif = sudah lewat, 0 = hari ini, positif = akan datang)
          const dueDt = new Date(r.due_date + 'T00:00:00');
          const todayDt = new Date(today + 'T00:00:00');
          const days = Math.round((dueDt - todayDt) / 86400000);
          return {
            invoice_id:     r.invoice_id,
            invoice_number: r.invoice_number,
            due_date:       r.due_date,
            total:          parseFloat(r.total || 0),
            status:         r.status,
            last_wa_reminder_at: r.last_wa_reminder_at,
            customer_id:    r.customer_id,
            cid:            r.cid,
            customer_name:  r.customer_name,
            customer_phone: r.customer_phone,
            days
          };
        });
      }

      const [due_today, due_3days, past_due, unpaid_all] = await Promise.all([
        fetchBucket('i.due_date = :today', 'i.total DESC'),
        fetchBucket('i.due_date > :today AND i.due_date <= :in3Days', 'i.due_date ASC, i.total DESC'),
        fetchBucket('i.due_date < :today', 'i.due_date ASC, i.total DESC'),
        fetchBucket('1=1', 'i.due_date ASC, i.total DESC'),
      ]);

      res.json({
        success: true,
        data: { due_today, due_3days, past_due, unpaid_all }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/billing/daily-transactions
   * ───────────────────────────────────────────────────────────────
   * Pemasukan & pengeluaran HARIAN untuk chart. Default 7 hari
   * terakhir; bisa ?days=14 atau ?days=30.
   *
   * Pemasukan: SUM(payments.amount) per payment_date (tanggal aktual
   *            transaksi masuk — bukan per invoice period)
   * Pengeluaran: SUM(keuangan.amount) per date untuk type='pengeluaran'
   *
   * Hari tanpa transaksi tetap di-return dengan nilai 0 supaya chart
   * tidak punya "lubang" di sumbu X.
   *
   * Return:
   *   {
   *     days: [{ date:'2026-05-09', label:'9 Mei', income:..., expense:...,
   *              income_count:..., expense_count:..., net:... }, ...],
   *     totals: { income, expense, net, income_count, expense_count }
   *   }
   */
  async dailyTransactions(req, res) {
    try {
      let days = parseInt(req.query.days) || 7;
      days = Math.max(3, Math.min(days, 90));     // clamp 3..90
      const today = moment().format('YYYY-MM-DD');
      const start = moment().subtract(days - 1, 'days').format('YYYY-MM-DD');

      // ─── Pemasukan harian (dari payments.payment_date) ───
      const incomeRows = await sequelize.query(
        `SELECT DATE(payment_date) AS d,
                COALESCE(SUM(amount),0) AS total,
                COUNT(*) AS cnt
           FROM payments
           WHERE payment_date BETWEEN :start AND :end
           GROUP BY DATE(payment_date)`,
        { replacements:{ start, end: today }, type: sequelize.QueryTypes.SELECT }
      );

      // ─── Pengeluaran harian (dari keuangan.date, type=pengeluaran) ───
      const expenseRows = await sequelize.query(
        `SELECT date AS d,
                COALESCE(SUM(amount),0) AS total,
                COUNT(*) AS cnt
           FROM keuangan
           WHERE type='pengeluaran' AND date BETWEEN :start AND :end
           GROUP BY date`,
        { replacements:{ start, end: today }, type: sequelize.QueryTypes.SELECT }
      );

      // Index by date string for O(1) lookup
      const incomeMap  = {};
      incomeRows.forEach(r => {
        const k = moment(r.d).format('YYYY-MM-DD');
        incomeMap[k] = { total: parseFloat(r.total||0), cnt: parseInt(r.cnt||0) };
      });
      const expenseMap = {};
      expenseRows.forEach(r => {
        const k = moment(r.d).format('YYYY-MM-DD');
        expenseMap[k] = { total: parseFloat(r.total||0), cnt: parseInt(r.cnt||0) };
      });

      // Fill all days dalam range, termasuk yang kosong
      const ID_MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
      const ID_DOW    = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

      const result = [];
      let totalIncome  = 0, totalExpense = 0;
      let totalIncCnt  = 0, totalExpCnt  = 0;
      for (let i = 0; i < days; i++) {
        const d   = moment(start).add(i, 'days');
        const key = d.format('YYYY-MM-DD');
        const inc = incomeMap[key]  || { total:0, cnt:0 };
        const exp = expenseMap[key] || { total:0, cnt:0 };
        const dt  = d.toDate();
        result.push({
          date:           key,
          label:          dt.getDate() + ' ' + ID_MONTHS[dt.getMonth()],
          dow:            ID_DOW[dt.getDay()],
          is_today:       (key === today),
          income:         inc.total,
          income_count:   inc.cnt,
          expense:        exp.total,
          expense_count:  exp.cnt,
          net:            inc.total - exp.total
        });
        totalIncome  += inc.total;
        totalExpense += exp.total;
        totalIncCnt  += inc.cnt;
        totalExpCnt  += exp.cnt;
      }

      res.json({
        success: true,
        data: {
          range_days: days,
          start, end: today,
          days: result,
          totals: {
            income:        totalIncome,
            expense:       totalExpense,
            net:           totalIncome - totalExpense,
            income_count:  totalIncCnt,
            expense_count: totalExpCnt,
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/billing/recent-transactions
   * ───────────────────────────────────────────────────────────────
   * Gabungan transaksi terbaru: pemasukan (dari payments) + pengeluaran
   * (dari keuangan dengan type='pengeluaran'). Di-sort by date desc.
   *
   * Query:
   *   ?type=all|income|expense   (default: all)
   *   ?limit=N                   (default: 8, max 50)
   *
   * Return:
   *   { items: [{ type:'income'|'expense', date, amount, label,
   *               description, ref, method }], total: N }
   *
   * Strategi: ambil 2x limit dari masing-masing source (overshoot), merge,
   * sort desc, lalu slice(limit). Tidak butuh pagination karena hanya
   * dipakai untuk widget dashboard.
   */
  async recentTransactions(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 8, 50);
      const type  = (req.query.type || 'all').toLowerCase();
      const wantIncome  = (type === 'all' || type === 'income');
      const wantExpense = (type === 'all' || type === 'expense');

      const sliceN = Math.max(limit * 2, 20);   // overshoot supaya merge result tetap akurat

      // ─── Pemasukan: dari payments + invoice + customer ───
      let incomeItems = [];
      if (wantIncome) {
        const rows = await sequelize.query(
          `SELECT p.id,
                  p.payment_date   AS date,
                  p.amount         AS amount,
                  p.payment_method AS method,
                  p.reference_number AS ref,
                  i.invoice_number AS invoice_number,
                  c.name           AS customer_name,
                  c.customer_id    AS cid
             FROM payments p
             JOIN invoices i  ON p.invoice_id = i.id
             JOIN customers c ON c.id         = i.customer_id
             ORDER BY p.payment_date DESC, p.id DESC
             LIMIT ${sliceN}`,
          { type: sequelize.QueryTypes.SELECT }
        );
        incomeItems = rows.map(r => ({
          type:        'income',
          source_id:   r.id,
          date:        r.date,
          amount:      parseFloat(r.amount || 0),
          label:       r.customer_name || '—',
          description: r.invoice_number || ('TXN-' + String(r.id||'').padStart(4,'0')),
          ref:         r.ref || r.invoice_number || '',
          method:      r.method || '-',
          cid:         r.cid || null,
        }));
      }

      // ─── Pengeluaran: dari keuangan dengan type='pengeluaran' ───
      let expenseItems = [];
      if (wantExpense) {
        const rows = await sequelize.query(
          `SELECT id, date, amount, category, description, party_name, ref_number
             FROM keuangan
             WHERE type = 'pengeluaran'
             ORDER BY date DESC, id DESC
             LIMIT ${sliceN}`,
          { type: sequelize.QueryTypes.SELECT }
        );
        expenseItems = rows.map(r => ({
          type:        'expense',
          source_id:   r.id,
          date:        r.date,
          amount:      parseFloat(r.amount || 0),
          label:       r.party_name || r.category || 'Pengeluaran',
          description: r.description || r.category || '',
          ref:         r.ref_number || ('EXP-' + String(r.id||'').padStart(4,'0')),
          method:      r.category || '-',
          cid:         null,
        }));
      }

      // Merge & sort by date desc (gunakan ISO string compare karena DATEONLY)
      const merged = [...incomeItems, ...expenseItems].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        if (db !== da) return db - da;
        return (b.source_id || 0) - (a.source_id || 0);
      });

      const items = merged.slice(0, limit);

      res.json({
        success: true,
        data: {
          items,
          total: merged.length,
          type,
          limit,
          income_count:  incomeItems.length,
          expense_count: expenseItems.length,
        }
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
      const companyName = await getCompanyName();

      // ── Baca template dari DB sesuai status invoice + relasi terhadap tanggal jatuh tempo
      // Mapping:
      //   - due_date < today       → reminder_overdue
      //   - due_date = today       → reminder_due
      //   - due_date > today       → reminder_before (fallback ke reminder_due jika belum dibuat)
      // Admin bisa mengubah isi pesan masing-masing di halaman /wa/templates.
      const todayStr = moment().format('YYYY-MM-DD');
      const dueStr   = invoice.due_date ? moment(invoice.due_date).format('YYYY-MM-DD') : null;
      let templateCategory;
      if (invoice.status === 'overdue' || (dueStr && dueStr < todayStr)) {
        templateCategory = 'reminder_overdue';
      } else if (dueStr && dueStr > todayStr) {
        templateCategory = 'reminder_before';
      } else {
        templateCategory = 'reminder_due';
      }

      // Cari template sesuai kategori — kalau kosong (mis. admin belum buat
      // template reminder_before), fallback ke reminder_due agar tetap kirim.
      let tpl = await WaTemplate.findOne({
        where: { category: templateCategory, is_active: true },
        order: [['updated_at', 'DESC']]
      });
      if (!tpl && templateCategory === 'reminder_before') {
        tpl = await WaTemplate.findOne({
          where: { category: 'reminder_due', is_active: true },
          order: [['updated_at', 'DESC']]
        });
      }

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

      // Track timestamp reminder terakhir di invoice (untuk badge di UI)
      try {
        invoice.last_wa_reminder_at = new Date();
        await invoice.save();
      } catch(_) { /* non-fatal */ }

      // Log activity (untuk audit & mini activity log di dashboard)
      try {
        const { ActivityLog } = require('../models');
        await ActivityLog.create({
          user_id:     req.user?.id || null,
          action:      'send_reminder',
          module:      'billing',
          description: `Kirim WA reminder ke ${c.name} (${invoice.invoice_number})`,
          target_type: 'invoice',
          target_id:   invoice.id
        });
      } catch(_) { /* non-fatal */ }

      res.json({
        success: true,
        message: `Reminder terkirim ke ${c.name} (${c.phone})`,
        template_used: tpl ? tpl.name : '(default fallback)',
        sent_at: new Date().toISOString()
      });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  /**
   * POST /api/billing/bulk-reminder
   * ───────────────────────────────────────────────────────────────
   * Kirim WA reminder ke banyak invoice sekaligus. Body:
   *   { invoice_ids: [1, 2, 3, ...] }
   *
   * Strategi: jalankan sendReminder sequential dengan delay kecil antar
   * pengiriman untuk hindari rate-limit Baileys / dianggap spam WhatsApp.
   * Return per-invoice result supaya frontend bisa tampilkan progress
   * akhir + list error.
   *
   * NOTE: untuk volume sangat besar (>50), idealnya dijadwalkan via queue,
   * tapi untuk skala ISP biasa (puluhan invoice/hari), sequential cukup.
   */
  async bulkReminder(req, res) {
    try {
      const ids = Array.isArray(req.body?.invoice_ids) ? req.body.invoice_ids : [];
      if (!ids.length) {
        return res.status(400).json({ success: false, message: 'Pilih minimal 1 invoice' });
      }
      if (ids.length > 100) {
        return res.status(400).json({ success: false, message: 'Maksimal 100 invoice per batch' });
      }

      const WAService = require('../services/WAService');
      const { WaTemplate, WaSession } = require('../models');

      // Cek session WA ready dulu — single point check, tidak per invoice
      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session) {
        return res.status(400).json({ success: false, message: 'Tidak ada sesi WhatsApp yang terhubung' });
      }

      const results = [];
      const todayStr = moment().format('YYYY-MM-DD');
      const sleep = ms => new Promise(r => setTimeout(r, ms));

      for (const id of ids) {
        try {
          const invoice = await Invoice.findByPk(id, {
            include: [{ model: Customer, as: 'customer', include: [{ model: Package, as: 'package' }] }]
          });
          if (!invoice) {
            results.push({ id, ok: false, error: 'Invoice tidak ditemukan' });
            continue;
          }
          const c = invoice.customer;
          if (!c || !c.phone) {
            results.push({ id, ok: false, error: 'Nomor HP tidak tersedia', customer_name: c?.name });
            continue;
          }

          // Pilih template berdasar kondisi due_date
          const dueStr = invoice.due_date ? moment(invoice.due_date).format('YYYY-MM-DD') : null;
          let cat;
          if (invoice.status === 'overdue' || (dueStr && dueStr < todayStr)) cat = 'reminder_overdue';
          else if (dueStr && dueStr > todayStr) cat = 'reminder_before';
          else cat = 'reminder_due';

          let tpl = await WaTemplate.findOne({ where: { category: cat, is_active: true }, order: [['updated_at','DESC']] });
          if (!tpl && cat === 'reminder_before') {
            tpl = await WaTemplate.findOne({ where: { category: 'reminder_due', is_active: true }, order: [['updated_at','DESC']] });
          }

          // Render placeholders (re-use logic dari sendReminder)
          const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
          const fmtDt = s => s ? new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '–';
          const fmtRpFn = n => 'Rp ' + Number(n||0).toLocaleString('id-ID');
          const periodeStr = (MONTHS[invoice.period_month]||invoice.period_month) + ' ' + invoice.period_year;
          const companyName = await getCompanyName();
          const vars = {
            nama:           c.name || '',
            cid:            c.customer_id || '',
            phone:          c.phone || '',
            nohp:           c.phone || '',
            alamat:         c.address || '-',
            paket:          c.package?.name || '-',
            harga_paket:    fmtRpFn(c.package?.price || invoice.total || 0),
            jumlah:         fmtRpFn(invoice.total || 0),
            invoice:        invoice.invoice_number || '',
            periode:        periodeStr,
            jatuh_tempo:    fmtDt(invoice.due_date),
            status:         invoice.status === 'overdue' ? '⚠️ JATUH TEMPO' : 'segera jatuh tempo',
            perusahaan:     companyName,
            phone_cs:       process.env.COMPANY_PHONE || process.env.SUPPORT_PHONE || '-',
          };
          let msg;
          if (tpl) {
            msg = (tpl.content || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
          } else {
            msg = `*Reminder Tagihan*\n\nYth. *${vars.nama}*,\nTagihan ${vars.periode} sebesar *${vars.jumlah}* jatuh tempo pada *${vars.jatuh_tempo}*.\n\nMohon segera lakukan pembayaran agar layanan tetap aktif.\n_Terima kasih_ 🙏`;
          }

          await WAService.sendMessage(session.session_id, c.phone, msg, null);

          // Track + log
          try {
            invoice.last_wa_reminder_at = new Date();
            await invoice.save();
            const { ActivityLog } = require('../models');
            await ActivityLog.create({
              user_id:     req.user?.id || null,
              action:      'send_reminder_bulk',
              module:      'billing',
              description: `Bulk WA reminder ke ${c.name} (${invoice.invoice_number})`,
              target_type: 'invoice',
              target_id:   invoice.id
            });
          } catch(_) {}

          results.push({ id, ok: true, customer_name: c.name, invoice_number: invoice.invoice_number });

          // Delay 1.2 detik antar kirim — hindari rate-limit & spam detection
          await sleep(1200);
        } catch (err) {
          results.push({ id, ok: false, error: err.message || 'Gagal mengirim' });
        }
      }

      const okCount   = results.filter(r => r.ok).length;
      const failCount = results.length - okCount;

      res.json({
        success: true,
        message: `Selesai: ${okCount} berhasil, ${failCount} gagal`,
        data: { ok_count: okCount, fail_count: failCount, results }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /**
   * POST /api/billing/invoices/:id/mark-paid
   * ───────────────────────────────────────────────────────────────
   * Tandai invoice lunas secara manual (untuk transfer offline yang
   * tidak terdeteksi otomatis). Otomatis create Payment row supaya
   * data konsisten dengan flow normal.
   *
   * Body: { method, reference_number, payment_date, notes }
   *   - method: 'cash'|'transfer'|'qris'|'other'|... (default 'transfer')
   *   - reference_number: opsional, mis. ID transfer
   *   - payment_date: opsional, default today
   *   - notes: opsional
   */
  async markPaid(req, res) {
    try {
      const invoice = await Invoice.findByPk(req.params.id, {
        include: [{ model: Customer, as: 'customer' }]
      });
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
      if (invoice.status === 'paid') {
        return res.status(400).json({ success: false, message: 'Invoice sudah berstatus lunas' });
      }

      const { method, reference_number, payment_date, notes } = req.body || {};
      const payDate = payment_date || moment().format('YYYY-MM-DD');

      // Create payment row
      const payment = await Payment.create({
        invoice_id:       invoice.id,
        amount:           invoice.total,
        payment_date:     payDate,
        payment_method:   (method || 'transfer').toLowerCase(),
        reference_number: reference_number || null,
        notes:            notes || `Pelunasan manual oleh ${req.user?.name || 'admin'}`,
      });

      // Update invoice
      invoice.status    = 'paid';
      invoice.paid_date = payDate;
      await invoice.save();

      // Log activity
      try {
        const { ActivityLog } = require('../models');
        await ActivityLog.create({
          user_id:     req.user?.id || null,
          action:      'mark_paid',
          module:      'billing',
          description: `Tandai lunas invoice ${invoice.invoice_number} (${invoice.customer?.name || ''}) — Rp ${Number(invoice.total).toLocaleString('id-ID')}`,
          target_type: 'invoice',
          target_id:   invoice.id
        });
      } catch(_) {}

      res.json({
        success: true,
        message: `Invoice ${invoice.invoice_number} berhasil ditandai lunas`,
        data: { invoice_id: invoice.id, payment_id: payment.id }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
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
  // Mengembalikan:
  //   - total_amount  : SUM(total) dari semua invoice unpaid/overdue
  //   - customer_count: jumlah PELANGGAN UNIK yang punya invoice unpaid/overdue
  //   - total         : alias backward-compat untuk total_amount
  // Frontend (dashboard.js) membaca total_amount & customer_count.
  async totalOutstanding(req, res) {
    try {
      const { Invoice } = require('../models');
      const { fn, col } = require('sequelize');

      const sumRow = await Invoice.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('total')), 0), 'total_amount']],
        where: { status: { [Op.in]: ['unpaid','overdue'] } },
        raw: true
      });

      const customerRow = await Invoice.findOne({
        attributes: [[fn('COUNT', fn('DISTINCT', col('customer_id'))), 'customer_count']],
        where: { status: { [Op.in]: ['unpaid','overdue'] } },
        raw: true
      });

      const total_amount   = parseFloat(sumRow?.total_amount || 0);
      const customer_count = parseInt(customerRow?.customer_count || 0);

      res.json({
        success: true,
        data: {
          total_amount,
          customer_count,
          total: total_amount   // backward-compat untuk caller lama
        }
      });
    } catch(e) {
      res.status(500).json({ success: false, message: e.message });
    }
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