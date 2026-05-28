const {
  Invoice,
  Payment,
  Customer,
  Package,
  User,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { generateInvoiceNumber } = require("../utils/helpers");
const moment = require("moment");
const logger = require("../utils/logger");

const METHODS = ["cash", "transfer", "dana", "ovo", "gopay", "qris"];
const METHOD_LABEL = {
  cash: "Cash",
  transfer: "Transfer",
  dana: "DANA",
  ovo: "OVO",
  gopay: "GoPay",
  qris: "QRIS",
};
const METHOD_COLOR = {
  cash: "#059669",
  transfer: "#2563eb",
  dana: "#0ea5e9",
  ovo: "#7c3aed",
  gopay: "#16a34a",
  qris: "#d97706",
};
const MONTHS = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

class PaymentController {
  // ── Stats (4 fintech cards) ──────────────────────────────────
  async stats(req, res) {
    try {
      const month = parseInt(req.query.month) || moment().month() + 1;
      const year = parseInt(req.query.year) || moment().year();
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      // Current period totals
      const [cur] = await sequelize.query(
        `SELECT COUNT(*) AS total_tx, COALESCE(SUM(p.amount),0) AS total_amount,
                SUM(p.payment_method='cash') AS cash_count,
                SUM(p.payment_method='transfer') AS transfer_count,
                SUM(p.payment_method IN ('dana','ovo','gopay','qris')) AS digital_count
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.period_year=:year AND i.period_month=:month`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT },
      );

      // Previous period
      const [prev] = await sequelize.query(
        `SELECT COUNT(*) AS total_tx, COALESCE(SUM(p.amount),0) AS total_amount
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.period_year=:year AND i.period_month=:month`,
        {
          replacements: { year: prevYear, month: prevMonth },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      // Total Invoices (semua tagihan bulan ini)
      const [invoiceTotals] = await sequelize.query(
        `SELECT COUNT(*) AS total_invoices, COALESCE(SUM(total),0) AS total_invoice_amount
         FROM invoices
         WHERE period_year=:year AND period_month=:month`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT },
      );

      // Overdue/Unpaid Invoices (tagihan tertunggak)
      const [overdueData] = await sequelize.query(
        `SELECT COUNT(*) AS overdue_count, COALESCE(SUM(total),0) AS overdue_amount
         FROM invoices
         WHERE period_year=:year AND period_month=:month AND status IN ('unpaid','overdue')`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT },
      );

      // Method breakdown
      const methodStats = await sequelize.query(
        `SELECT p.payment_method AS method, COUNT(*) AS cnt, COALESCE(SUM(p.amount),0) AS total
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.period_year=:year AND i.period_month=:month
         GROUP BY p.payment_method ORDER BY total DESC`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT },
      );

      const prevTx = parseInt(prev?.total_tx || 0);
      const prevAmt = parseFloat(prev?.total_amount || 0);
      const curTx = parseInt(cur?.total_tx || 0);
      const curAmt = parseFloat(cur?.total_amount || 0);

      res.json({
        success: true,
        data: {
          month,
          year,
          total_tx: curTx,
          total_amount: curAmt,
          cash_count: parseInt(cur?.cash_count || 0),
          transfer_count: parseInt(cur?.transfer_count || 0),
          digital_count: parseInt(cur?.digital_count || 0),
          prev_tx: prevTx,
          prev_amount: prevAmt,
          growth_tx:
            prevTx > 0 ? Math.round(((curTx - prevTx) / prevTx) * 100) : null,
          growth_amt:
            prevAmt > 0
              ? Math.round(((curAmt - prevAmt) / prevAmt) * 100)
              : null,
          // Tambahan: Total Invoices & Overdue
          total_invoices: parseInt(invoiceTotals?.total_invoices || 0),
          total_invoice_amount: parseFloat(
            invoiceTotals?.total_invoice_amount || 0,
          ),
          overdue_count: parseInt(overdueData?.overdue_count || 0),
          overdue_amount: parseFloat(overdueData?.overdue_amount || 0),
          method_stats: methodStats.map((m) => ({
            method: m.method,
            label: METHOD_LABEL[m.method] || m.method,
            color: METHOD_COLOR[m.method] || "#6b7280",
            count: parseInt(m.cnt),
            total: parseFloat(m.total),
          })),
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ── Chart data (daily totals) ────────────────────────────────
  async chartData(req, res) {
    try {
      const month = parseInt(req.query.month) || moment().month() + 1;
      const year = parseInt(req.query.year) || moment().year();
      const daysInMonth = new Date(year, month, 0).getDate();

      const rows = await sequelize.query(
        `SELECT DAY(p.payment_date) AS d, COALESCE(SUM(p.amount),0) AS total, COUNT(*) AS cnt
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.period_year=:year AND i.period_month=:month
         GROUP BY DAY(p.payment_date) ORDER BY d ASC`,
        { replacements: { year, month }, type: sequelize.QueryTypes.SELECT },
      );

      const map = {};
      rows.forEach((r) => {
        map[parseInt(r.d)] = {
          total: parseFloat(r.total),
          cnt: parseInt(r.cnt),
        };
      });
      const days = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        total: map[i + 1]?.total || 0,
        count: map[i + 1]?.cnt || 0,
      }));

      res.json({ success: true, data: days });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ── List payments ────────────────────────────────────────────
  async list(req, res) {
    try {
      const { page = 1, limit = 20, search, month, year } = req.query;

      const m = parseInt(month) || moment().month() + 1;
      const y = parseInt(year) || moment().year();
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let custWhere = "";
      const params = { year: y, month: m };

      if (search) {
        custWhere = `AND (c.name LIKE :search OR c.customer_id LIKE :search OR c.phone LIKE :search)`;
        params.search = "%" + search + "%";
      }

      const [countRow] = await sequelize.query(
        `SELECT COUNT(*) AS n FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          JOIN customers c ON c.id = i.customer_id
          WHERE i.period_year=:year AND i.period_month=:month ${custWhere}`,
        { replacements: params, type: sequelize.QueryTypes.SELECT },
      );

      const total = parseInt(countRow?.n || 0);

      const rows = await sequelize.query(
        `SELECT 
        p.id, p.amount, p.payment_method, p.payment_date, p.reference_number, p.notes, p.created_at,
        p.wa_sent_status, p.wa_sent_at,

        i.invoice_number, i.due_date, i.period_month, i.period_year, i.total AS invoice_total,

        c.name AS cust_name, 
        c.customer_id AS cid, 
        c.phone AS cust_phone,

        pkg.name AS pkg_name,

        (
          SELECT GROUP_CONCAT(p2.name SEPARATOR ', ')
          FROM packages p2
          WHERE FIND_IN_SET(
            p2.id,
            REPLACE(REPLACE(REPLACE(REPLACE(c.addon_id,'[',''),']',''),'"',''),' ','')
          )
        ) AS addon_names,

        u.name AS recorded_by_name

      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN packages pkg ON pkg.id = c.package_id
      LEFT JOIN users u ON u.id = p.recorded_by

      WHERE i.period_year=:year AND i.period_month=:month ${custWhere}

      ORDER BY p.payment_date DESC, p.created_at DESC
      LIMIT :limit OFFSET :offset`,
        {
          replacements: { ...params, limit: parseInt(limit), offset },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      res.json({
        success: true,
        data: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  }

  // ── Record payment ───────────────────────────────────────────
  async record(req, res) {
    const t = await sequelize.transaction();
    try {
      const {
        customer_id,
        amount,
        payment_date,
        method,
        bank,
        reference_no,
        due_date_after,
        send_wa,
        notes,
        period_month,
        period_year,
      } = req.body;

      if (!customer_id || !amount || !due_date_after) {
        await t.rollback();
        const missing = [];
        if (!customer_id) missing.push("customer_id");
        if (!amount) missing.push("amount");
        if (!due_date_after) missing.push("due_date_after (jatuh tempo baru)");
        return res.status(400).json({
          success: false,
          message: "Wajib diisi: " + missing.join(", "),
        });
      }

      const customer = await Customer.findByPk(customer_id, {
        include: [{ model: Package, as: "package" }],
        transaction: t,
      });
      if (!customer) {
        await t.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Customer tidak ditemukan" });
      }

      const pm = parseInt(period_month) || moment().month() + 1;
      const py = parseInt(period_year) || moment().year();

      // ── Cek duplikat: apakah periode ini sudah ada payment yang lunas? ──
      const existingPaidInvoice = await Invoice.findOne({
        where: {
          customer_id,
          period_month: pm,
          period_year: py,
          status: "paid",
        },
        include: [
          {
            model: Payment,
            as: "payments",
            attributes: ["id", "amount", "payment_date"],
          },
        ],
        transaction: t,
      });
      if (existingPaidInvoice) {
        await t.rollback();
        const paidDate = existingPaidInvoice.paid_date
          ? new Date(existingPaidInvoice.paid_date).toLocaleDateString(
              "id-ID",
              { day: "2-digit", month: "long", year: "numeric" },
            )
          : "–";
        return res.status(400).json({
          success: false,
          message: `${customer.name} sudah membayar untuk periode ${MONTHS[pm]} ${py} (lunas ${paidDate}). Invoice: ${existingPaidInvoice.invoice_number}`,
          already_paid: true,
          invoice_number: existingPaidInvoice.invoice_number,
          paid_date: existingPaidInvoice.paid_date,
        });
      }

      // Cari atau buat invoice untuk periode ini
      let invoice = await Invoice.findOne({
        where: { customer_id, period_month: pm, period_year: py },
        transaction: t,
      });

      if (!invoice) {
        // Auto-create invoice - pakai MAX untuk hindari duplicate concurrent
        const invAmount = parseFloat(customer.package?.price || amount);
        let invoiceNumber;
        let attempts = 0;
        while (attempts < 5) {
          try {
            // Cari nomor invoice tertinggi di DB (global), bukan count per bulan
            const lastInv = await Invoice.findOne({
              order: [["id", "DESC"]],
              attributes: ["id"],
              lock: t.LOCK.UPDATE,
              transaction: t,
            });
            const nextSeq = (lastInv?.id || 0) + 1 + attempts;
            invoiceNumber = generateInvoiceNumber(py, pm, nextSeq);
            // Cek apakah nomor ini sudah ada
            const exists = await Invoice.findOne({
              where: { invoice_number: invoiceNumber },
              transaction: t,
            });
            if (!exists) break;
            attempts++;
          } catch (_) {
            attempts++;
          }
        }
        invoice = await Invoice.create(
          {
            invoice_number: invoiceNumber,
            customer_id,
            amount: invAmount,
            tax: 0,
            total: invAmount,
            status: "unpaid",
            due_date: due_date_after,
            period_month: pm,
            period_year: py,
          },
          { transaction: t },
        );
      }

      const payMethod = METHODS.includes(method) ? method : "cash";
      const refNote = [bank, reference_no].filter(Boolean).join(" — ") || null;

      // Simpan payment
      const payment = await Payment.create(
        {
          invoice_id: invoice.id,
          amount:
            parseFloat(String(amount).replace(/[.,]/g, "") || 0) ||
            parseFloat(amount),
          payment_method: payMethod,
          payment_date: payment_date || moment().format("YYYY-MM-DD"),
          reference_number: refNote,
          recorded_by: req.user?.id || null,
          notes: notes || null,
        },
        { transaction: t },
      );

      // Update invoice: paid + due_date
      await invoice.update(
        {
          status: "paid",
          paid_date: payment_date || moment().format("YYYY-MM-DD"),
        },
        { transaction: t },
      );

      // Update customer: due_date + status aktif
      const dueDateBefore = customer.billing_date
        ? moment().date(customer.billing_date).format("YYYY-MM-DD")
        : null;
      await customer.update(
        {
          status: "active",
          installation_date:
            customer.installation_date ||
            payment_date ||
            moment().format("YYYY-MM-DD"),
        },
        { transaction: t },
      );

      // Jika customer terisolir, set flag restoring
      // (implementasi MikroTik restore di-trigger setelah commit di bawah)

      await t.commit();

      // ── Auto-restore di MikroTik kalau customer sebelumnya ter-isolir ──
      // Dijalankan AFTER commit supaya:
      // (1) payment + invoice paid + customer.status='active' sudah persist di DB,
      // (2) kegagalan komunikasi MikroTik tidak membatalkan transaction payment.
      // Kalau gagal di sini, log error tapi jangan throw — cron berikutnya
      // (atau user manual via tombol Restore) bisa retry.
      if (
        customer.isolir_status === "isolated" ||
        customer.isolir_status === "restoring"
      ) {
        try {
          const IsolirSvc = require("../services/IsolirService");
          const restoreResult = await IsolirSvc.restoreAfterPayment(
            customer.id,
          );
          if (restoreResult?.success && !restoreResult.skipped) {
            console.log(
              `[Payment] Auto-restore isolir success: customer ${customer.customer_id} (${customer.name})`,
            );
          }
        } catch (e) {
          console.error(
            `[Payment] Auto-restore isolir gagal untuk customer ${customer.customer_id}:`,
            e.message,
          );
          // Tidak fatal — payment tetap berhasil
        }
      }

      // Kirim WA konfirmasi jika diminta, lalu update status
      let waSentStatus = send_wa ? "failed" : "skipped";
      if (send_wa && customer.phone) {
        const WAService = require("../services/WAService");
        const { WaSession, WaTemplate } = require("../models");
        const {
          replaceVariables,
          getPaymentConfirmationData,
          getDefaultPaymentTemplate,
        } = require("../utils/templateHelper");

        try {
          const session = await WaSession.findOne({
            where: { status: "connected" },
          });
          if (session && WAService.isConnected(session.session_id)) {
            // Get template from database (category: payment_confirm)
            let template = await WaTemplate.findOne({
              where: { category: "payment_confirm", is_active: true },
              order: [["id", "ASC"]],
            });

            // Use default template if not found
            let templateContent =
              template?.content ||
              template?.message ||
              getDefaultPaymentTemplate();

            // Prepare data for template variables
            const methodStr =
              METHOD_LABEL[payMethod] + (bank ? ` (${bank})` : "");
            const fmtAmt =
              "Rp " + parseFloat(payment.amount).toLocaleString("id-ID");
            const fmtDue = moment(due_date_after).format("DD/MM/YYYY");
            const fmtPay = moment(payment.payment_date).format("DD/MM/YYYY");

            const templateData = getPaymentConfirmationData({
              customerName: customer.name,
              customerId: customer.customer_id,
              customerPhone: customer.phone,
              packageName: customer.package?.name,
              amount: payment.amount,
              amountFormatted: fmtAmt,
              paymentDate: payment.payment_date,
              paymentDateFormatted: fmtPay,
              method: payMethod,
              methodLabel: methodStr,
              bank: bank,
              referenceNo: reference_no,
              dueDate: due_date_after,
              dueDateFormatted: fmtDue,
              invoiceNumber: invoice.invoice_number,
              notes: notes,
            });

            // Replace variables in template
            const msg = replaceVariables(templateContent, templateData);

            await WAService.sendMessage(
              session.session_id,
              customer.phone,
              msg,
              null,
            );
            waSentStatus = "sent";

            // Update template usage count
            if (template) {
              await template.increment("usage_count");
            }
          }
        } catch (waErr) {
          waSentStatus = "failed";
          logger.warn("[Payment] WA send failed: " + waErr.message);
        }
        // Update payment dengan status WA
        await payment.update({
          wa_sent_status: waSentStatus,
          wa_sent_at: waSentStatus === "sent" ? new Date() : null,
        });
      } else {
        // Tandai skipped (tidak diminta kirim WA)
        await payment.update({ wa_sent_status: "skipped" });
      }

      // ═══════════════════════════════════════════════════════════
      // AUTO-SYNC ke Keuangan (Real-time tanpa perlu klik Sync)
      // ═══════════════════════════════════════════════════════════
      try {
        const { Keuangan } = require("../models");

        // Cek apakah payment ini sudah pernah di-sync
        const existingEntry = await Keuangan.findOne({
          where: {
            type: "pemasukan",
            ref_number: `PAY-${payment.id}`,
          },
        });

        // Jika belum ada, create entry baru di Keuangan
        if (!existingEntry) {
          const methodStr =
            METHOD_LABEL[payMethod] + (bank ? ` (${bank})` : "");

          await Keuangan.create({
            type: "pemasukan",
            category: "Pembayaran Pelanggan",
            description: `Pembayaran ${customer.name} (${customer.customer_id})`,
            amount: parseFloat(payment.amount),
            date: payment.payment_date,
            ref_number: `PAY-${payment.id}`,
            notes: `Invoice: ${invoice.invoice_number || "-"} | Metode: ${methodStr}${reference_no ? " | Ref: " + reference_no : ""}`,
            recorded_by: req.user?.id || null,
          });

          logger.info(
            `[Payment] Auto-sync ke Keuangan: PAY-${payment.id} - ${customer.name}`,
          );
        }
      } catch (syncErr) {
        // Jangan fail payment jika sync gagal, cukup log saja
        logger.warn("[Payment] Auto-sync ke Keuangan gagal:", syncErr.message);
      }
      // ═══════════════════════════════════════════════════════════

      const waSentMsg =
        waSentStatus === "sent"
          ? " WA konfirmasi terkirim."
          : waSentStatus === "failed"
            ? " (Gagal kirim WA)"
            : "";
      res.status(201).json({
        success: true,
        message: `Pembayaran ${customer.name} berhasil dicatat.` + waSentMsg,
        data: {
          payment_id: payment.id,
          invoice_number: invoice.invoice_number,
          customer_name: customer.name,
          amount: payment.amount,
          due_date_after,
          wa_sent_status: waSentStatus,
        },
      });
    } catch (e) {
      try {
        await t.rollback();
      } catch (_) {}
      // Log detail lengkap termasuk SQL error asli
      const detail = e.original?.message || e.errors?.[0]?.message || e.message;
      console.error("[PaymentController.record] ERROR:", detail);
      console.error("[PaymentController.record] SQL:", e.sql || "-");
      console.error(
        "[PaymentController.record] STACK:",
        e.stack?.split("\n")[0],
      );
      res.status(500).json({
        success: false,
        message: detail,
        sql_hint: e.original?.code || null,
      });
    }
  }

  // ── Delete payment ───────────────────────────────────────────
  async destroy(req, res) {
    const t = await sequelize.transaction();
    let customerId = null;
    try {
      const payment = await Payment.findByPk(req.params.id, { transaction: t });
      if (!payment) {
        await t.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Payment tidak ditemukan" });
      }

      // Ambil customer_id dari invoice (untuk re-evaluasi isolir setelah delete)
      const invoice = await Invoice.findByPk(payment.invoice_id, {
        transaction: t,
      });
      customerId = invoice?.customer_id || null;

      // ═══════════════════════════════════════════════════════════
      // AUTO-DELETE dari Keuangan (Real-time sync)
      // ═══════════════════════════════════════════════════════════
      try {
        const { Keuangan } = require("../models");

        // Hapus entry di keuangan yang terkait dengan payment ini
        await Keuangan.destroy({
          where: {
            type: "pemasukan",
            ref_number: `PAY-${payment.id}`,
          },
          transaction: t,
        });

        logger.info(`[Payment] Auto-delete dari Keuangan: PAY-${payment.id}`);
      } catch (syncErr) {
        // Jangan fail payment delete jika sync gagal, cukup log saja
        logger.warn(
          "[Payment] Auto-delete dari Keuangan gagal:",
          syncErr.message,
        );
      }
      // ═══════════════════════════════════════════════════════════

      // Revert invoice ke unpaid
      await Invoice.update(
        { status: "unpaid", paid_date: null },
        { where: { id: payment.invoice_id }, transaction: t },
      );

      await payment.destroy({ transaction: t });
      await t.commit();

      // ── Re-evaluate isolir status SETELAH commit ──
      // Kalau customer ini sekarang punya invoice unpaid yang sudah lewat grace days,
      // dan belum ter-isolir, lakukan auto-isolir (karena pembayaran yang sebelumnya
      // membuat dia "active" sudah tidak valid).
      // Dijalankan after commit supaya kegagalan komunikasi MikroTik tidak membatalkan
      // delete payment. Kalau gagal di sini, cron berikutnya akan retry.
      let isolirNote = "";
      if (customerId) {
        try {
          const IsolirSvc = require("../services/IsolirService");
          const result = await IsolirSvc.evaluateCustomer(
            customerId,
            "payment_revert",
          );
          if (result?.success && !result.skipped) {
            logger.info(
              `[Payment] Auto-isolir setelah delete payment: customer ${customerId} — ${result.message}`,
            );
            isolirNote =
              " Customer otomatis di-isolir karena tagihan kembali overdue.";
          }
        } catch (e) {
          logger.error(
            `[Payment] Auto-isolir gagal untuk customer ${customerId}:`,
            e.message,
          );
          // Tidak fatal — delete payment tetap berhasil
        }
      }

      res.json({
        success: true,
        message:
          "Pembayaran berhasil dihapus dan tersinkronisasi dengan keuangan." +
          isolirNote,
      });
    } catch (e) {
      await t.rollback();
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ── Check if already paid for period ────────────────────────
  async checkPaid(req, res) {
    try {
      const { customer_id, month, year } = req.query;
      if (!customer_id || !month || !year) return res.json({ paid: false });
      const invoice = await Invoice.findOne({
        where: {
          customer_id: parseInt(customer_id),
          period_month: parseInt(month),
          period_year: parseInt(year),
          status: "paid",
        },
        attributes: ["id", "invoice_number", "paid_date", "due_date"],
      });
      if (invoice) {
        return res.json({
          paid: true,
          invoice_number: invoice.invoice_number,
          paid_date: invoice.paid_date,
        });
      }
      res.json({ paid: false });
    } catch (e) {
      res.json({ paid: false });
    }
  }

  // ── Get invoice data for rendering ──────────────────────────
  async invoiceDataByInvoiceId(req, res) {
    try {
      const invoiceId = req.params.id;
      // Try to get from payments first
      const [rowWithPay] = await sequelize.query(
        `SELECT p.id AS payment_id, p.amount AS payment_amount, p.payment_method, p.payment_date, p.reference_number, p.notes,
                i.id AS invoice_id, i.invoice_number, i.due_date, i.period_month, i.period_year,
                i.amount AS invoice_amount, i.tax AS invoice_tax, i.total AS invoice_total,
                i.status AS invoice_status,
                c.name AS cust_name, c.customer_id AS cid, c.phone AS cust_phone,
                c.address AS cust_address, c.email AS cust_email, c.installation_date,
                pkg.name AS pkg_name, pkg.price AS pkg_price
         FROM invoices i
         LEFT JOIN payments p ON p.invoice_id = i.id
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN packages pkg ON pkg.id = c.package_id
         WHERE i.id = :id ORDER BY p.id DESC LIMIT 1`,
        { replacements: { id: invoiceId }, type: sequelize.QueryTypes.SELECT },
      );
      if (!rowWithPay)
        return res
          .status(404)
          .json({ success: false, message: "Invoice tidak ditemukan" });

      const company = {
        name:
          process.env.COMPANY_NAME || process.env.APP_NAME || "ISP Provider",
        address: process.env.COMPANY_ADDRESS || "",
        phone: process.env.COMPANY_PHONE || "",
        email: process.env.COMPANY_EMAIL || "",
        website: process.env.COMPANY_WEBSITE || "",
        footer:
          process.env.INVOICE_FOOTER ||
          "Terima kasih telah menggunakan layanan kami.",
      };
      const methodMap = {
        cash: "Tunai (Cash)",
        transfer: "Transfer Bank",
        dana: "DANA",
        ovo: "OVO",
        gopay: "GoPay",
        qris: "QRIS",
      };
      const methodLabel =
        methodMap[rowWithPay.payment_method] ||
        rowWithPay.payment_method?.toUpperCase() ||
        "-";

      // Normalisasi: pakai invoice_total sebagai amount jika payment belum ada
      const amount = rowWithPay.payment_amount || rowWithPay.invoice_total || 0;
      // Ambil recorded_by_name dari user jika ada payment
      let recorded_by_name = "System";
      if (rowWithPay.payment_id) {
        try {
          const { User } = require("../models");
          // recorded_by tidak di-select, pakai System saja
        } catch (e) {}
      }

      // Tax breakdown — pakai data dari kolom invoice (sumber kebenaran),
      // hanya ambil label & rate dari settings untuk display.
      // Resilient untuk legacy invoice: kalau kolom tax = 0 tapi total > amount,
      // derive tax dari selisih total - amount (anggap tax sudah include di total tapi belum di-set ke kolom tax)
      const { loadTaxSettings } = require("../utils/taxHelper");
      const taxCfg = await loadTaxSettings();
      let invSubtotal = parseFloat(
        rowWithPay.invoice_amount || rowWithPay.pkg_price || 0,
      );
      let invTax = parseFloat(rowWithPay.invoice_tax || 0);
      let invTotal = parseFloat(
        rowWithPay.invoice_total || invSubtotal + invTax,
      );

      // Auto-detect: kalau total > subtotal tapi tax kolom belum di-set → tax = total - subtotal
      if (invTax === 0 && invTotal > invSubtotal && invSubtotal > 0) {
        invTax = invTotal - invSubtotal;
      }

      // Override on-the-fly: kalau setting PPN saat ini nonaktif, paksa tax=0
      // dan total=subtotal — tanpa mengubah DB. Invoice lama yg dibuat saat
      // PPN aktif akan tampil bersih tanpa PPN setelah toggle dimatikan.
      if (!taxCfg.enabled) {
        invTax = 0;
        invTotal = invSubtotal > 0 ? invSubtotal : invTotal;
      }

      const computedRate =
        invSubtotal > 0 && invTax > 0
          ? Math.round((invTax / invSubtotal) * 1000) / 10 // 1 decimal place
          : taxCfg.rate;

      res.json({
        success: true,
        data: {
          ...rowWithPay,
          amount,
          invoice_subtotal: invSubtotal,
          invoice_tax: invTax,
          invoice_total: invTotal,
          tax_label: taxCfg.label,
          tax_rate: computedRate,
          tax_applied: invTax > 0,
          method_label: methodLabel,
          recorded_by_name,
          company,
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ── Original invoiceData (by payment ID) ─────────────────────
  async invoiceData(req, res) {
    try {
      const paymentId = req.params.id;

      const [row] = await sequelize.query(
        `SELECT 
        p.id, p.amount, p.payment_method, p.payment_date, p.reference_number, p.notes, p.created_at,

        i.invoice_number, i.due_date, i.paid_date, i.status AS invoice_status,
        i.period_month, i.period_year,
        i.amount AS invoice_amount, i.tax AS invoice_tax, i.total AS invoice_total,

        c.name AS cust_name, c.customer_id AS cid, c.phone AS cust_phone,
        c.address AS cust_address, c.email AS cust_email, c.installation_date,
        c.addon_id,

        pkg.name AS pkg_name, pkg.price AS pkg_price,

        (
          SELECT GROUP_CONCAT(
            CONCAT(p2.name, '||', p2.price)
            SEPARATOR '##'
          )
          FROM packages p2
          WHERE FIND_IN_SET(
            p2.id,
            REPLACE(REPLACE(REPLACE(REPLACE(c.addon_id,'[',''),']',''),'"',''),' ','')
          )
        ) AS addon_raw,

        u.name AS recorded_by_name

      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN packages pkg ON pkg.id = c.package_id
      LEFT JOIN users u ON u.id = p.recorded_by

      WHERE p.id = :id`,
        {
          replacements: { id: paymentId },
          type: sequelize.QueryTypes.SELECT,
        },
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Payment tidak ditemukan",
        });
      }

      let addon_detail = [];

      if (row.addon_raw) {
        addon_detail = row.addon_raw.split("##").map((x) => {
          const [name, price] = x.split("||");
          return {
            name,
            price: Number(price || 0),
          };
        });
      }

      const addon_total = addon_detail.reduce(
        (sum, a) => sum + (a.price || 0),
        0,
      );

      const company = {
        name:
          process.env.COMPANY_NAME || process.env.APP_NAME || "ISP Provider",
        address: process.env.COMPANY_ADDRESS || "",
        phone: process.env.COMPANY_PHONE || "",
        email: process.env.COMPANY_EMAIL || "",
        website: process.env.COMPANY_WEBSITE || "",
        footer:
          process.env.INVOICE_FOOTER ||
          "Terima kasih telah menggunakan layanan kami.",
      };

      const methodMap = {
        cash: "Tunai (Cash)",
        transfer: "Transfer Bank",
        dana: "DANA",
        ovo: "OVO",
        gopay: "GoPay",
        qris: "QRIS",
      };

      let methodLabel =
        methodMap[row.payment_method] ||
        row.payment_method?.toUpperCase() ||
        "Cash";

      const { loadTaxSettings } = require("../utils/taxHelper");
      const taxCfg = await loadTaxSettings();

      let invSubtotal =
        Number(row.invoice_amount || row.pkg_price || 0) + addon_total;

      let invTax = Number(row.invoice_tax || 0);
      let invTotal = Number(row.invoice_total || invSubtotal + invTax);

      if (invTax === 0 && invTotal > invSubtotal && invSubtotal > 0) {
        invTax = invTotal - invSubtotal;
      }

      if (!taxCfg.enabled) {
        invTax = 0;
        invTotal = invSubtotal;
      }

      const computedRate =
        invSubtotal > 0 && invTax > 0
          ? Math.round((invTax / invSubtotal) * 1000) / 10
          : taxCfg.rate;

      res.json({
        success: true,
        data: {
          ...row,

          addon_detail,
          addon_total,

          method_label: methodLabel,

          invoice_subtotal: invSubtotal,
          invoice_tax: invTax,
          invoice_total: invTotal,

          tax_label: taxCfg.label,
          tax_rate: computedRate,
          tax_applied: invTax > 0,

          company,
        },
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  }

  // ── Send invoice via WA ──────────────────────────────────────
  async sendWaInvoice(req, res) {
    try {
      const paymentId = req.params.id;
      const [row] = await sequelize.query(
        `SELECT p.id, p.amount, p.payment_method, p.payment_date,
                i.invoice_number, i.due_date, i.period_month, i.period_year,
                c.name AS cust_name, c.customer_id AS cid, c.phone AS cust_phone,
                pkg.name AS pkg_name
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN packages pkg ON pkg.id = c.package_id
         WHERE p.id = :id`,
        { replacements: { id: paymentId }, type: sequelize.QueryTypes.SELECT },
      );
      if (!row)
        return res
          .status(404)
          .json({ success: false, message: "Payment tidak ditemukan" });
      if (!row.cust_phone)
        return res.status(400).json({
          success: false,
          message: "Nomor HP pelanggan tidak tersedia",
        });

      const WAService = require("../services/WAService");
      const { WaSession } = require("../models");
      const session = await WaSession.findOne({
        where: { status: "connected" },
      });
      if (!session || !WAService.isConnected(session.session_id)) {
        return res.status(400).json({
          success: false,
          message: "Tidak ada session WA yang terhubung",
        });
      }

      const monthNames = [
        "",
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const periodeStr =
        (monthNames[row.period_month] || row.period_month) +
        " " +
        row.period_year;
      const tglBayar = new Date(
        row.payment_date + "T00:00:00",
      ).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const aktifHingga = new Date(
        row.due_date + "T00:00:00",
      ).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const fmtAmt = "Rp " + Number(row.amount).toLocaleString("id-ID");
      const appUrl = process.env.APP_URL || "http://localhost:3000";

      const msg =
        `*Invoice Pembayaran*\n\n` +
        `Halo *${row.cust_name}*,\nBerikut detail pembayaran Anda:\n\n` +
        `No Invoice : *${row.invoice_number}*\n` +
        `Paket      : ${row.pkg_name || "-"}\n` +
        `Periode    : ${periodeStr}\n` +
        `Jumlah     : *${fmtAmt}*\n` +
        `Tgl Bayar  : ${tglBayar}\n` +
        `Aktif s/d  : *${aktifHingga}*\n\n` +
        `_Terima kasih telah menggunakan layanan kami_ 🙏`;

      await WAService.sendMessage(
        session.session_id,
        row.cust_phone,
        msg,
        null,
      );
      res.json({
        success: true,
        message: "Invoice berhasil dikirim via WhatsApp ke " + row.cust_phone,
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ── Search customers for form ────────────────────────────────
  // async searchCustomers(req, res) {
  //   try {
  //     const { q } = req.query;
  //     const where = { status: { [Op.in]: ['active', 'isolated'] } };
  //     if (q) where[Op.or] = [
  //       { name: { [Op.like]: '%' + q + '%' } },
  //       { customer_id: { [Op.like]: '%' + q + '%' } },
  //       { phone: { [Op.like]: '%' + q + '%' } }
  //     ];
  //     const rows = await Customer.findAll({
  //       where,
  //       include: [{ model: Package, as: 'package', attributes: ['id','name','price'] }],
  //       attributes: ['id','customer_id','name','phone','status','billing_date','installation_date'],
  //       order: [['name','ASC']],
  //       limit: 30
  //     });
  //     res.json({ success: true, data: rows });
  //   } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  // }

  async searchCustomers(req, res) {
    try {
      const { q } = req.query;

      const where = {
        status: { [Op.in]: ["active", "isolated"] },
      };

      if (q) {
        where[Op.or] = [
          { name: { [Op.like]: "%" + q + "%" } },
          { customer_id: { [Op.like]: "%" + q + "%" } },
          { phone: { [Op.like]: "%" + q + "%" } },
        ];
      }

      const rows = await Customer.findAll({
        where,
        include: [
          {
            model: Package,
            as: "package",
            attributes: ["id", "name", "price"],
          },
        ],
        attributes: [
          "id",
          "customer_id",
          "name",
          "phone",
          "status",
          "billing_date",
          "installation_date",
          "addon_id",
        ],
        order: [["name", "ASC"]],
        limit: 30,
      });

      const data = [];

      for (const c of rows) {
        let addons = [];
        let addon_total = 0;

        let ids = [];

        if (Array.isArray(c.addon_id)) {
          ids = c.addon_id.map((id) => Number(id));
        } else {
          try {
            ids = JSON.parse(c.addon_id || "[]").map((id) => Number(id));
          } catch {
            ids = [];
          }
        }

        if (ids.length > 0) {
          addons = await Package.findAll({
            where: {
              id: { [Op.in]: ids },
            },
            attributes: ["id", "name", "price"],
          });

          addon_total = addons.reduce((sum, a) => {
            return sum + Number(a.price || 0);
          }, 0);
        }

        const package_price = Number(c.package?.price || 0);
        const total_price = package_price + addon_total;

        data.push({
          ...c.toJSON(),

          addons: addons.map((a) => a.toJSON()),

          addon_total,
          total_price,
        });
      }

      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  }
}

module.exports = new PaymentController();
