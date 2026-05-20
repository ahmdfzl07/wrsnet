/**
 * routes/api.js  (UPDATED - tambahkan mikrotik routes)
 * Tambahkan 2 baris ini di file api.js yang sudah ada:
 *
 *   const mikrotikRoutes = require('./mikrotik');
 *   router.use('/mikrotik', mikrotikRoutes);
 *
 * Letakkan sebelum 
// ===== TODO =====
const TodoController = require('../controllers/TodoController');

// ===== WORK ORDERS =====
const WOCtrl = require('../controllers/WorkOrderController');

module.exports = router;
 * Semua route existing tetap utuh.
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  authenticate,
  authorize,
  hasPermission,
} = require("../middleware/auth");
const { logActivity } = require("../middleware/activityLogger");
const { demoGuard } = require("../middleware/demoGuard");
const { apiBlockFinanceArea } = require("../middleware/financeAccess");
const { apiBlockNocArea } = require("../middleware/nocAccess");
const demoRoutes = require("./demo");

// Controllers (existing)
const AuthController = require("../controllers/AuthController");
const UserController = require("../controllers/UserController");
const CustomerController = require("../controllers/CustomerController");
const PackageController = require("../controllers/PackageController");
const BillingController = require("../controllers/BillingController");
const DeviceController = require("../controllers/DeviceController");
const InfrastructureController = require("../controllers/InfrastructureController");
const InfrastructureLinkController = require("../controllers/InfrastructureLinkController");
const OntController = require("../controllers/OntController");
const DashboardController = require("../controllers/DashboardController");
const DashboardLayoutController = require("../controllers/DashboardLayoutController");
const NotificationController = require("../controllers/NotificationController");
const ActivityLogController = require("../controllers/ActivityLogController");
const ResourceController = require("../controllers/ResourceController");
const TopologyController = require("../controllers/TopologyController");
const axios = require("axios");
const db = require("../models");
const Customer = db.Customer;
const Package = db.Package;

// ===== DEMO (public — /provision tidak butuh login) =====
router.use("/demo", demoRoutes);

// ===== AUTH =====
router.post("/auth/login", AuthController.login);
router.post("/auth/refresh", AuthController.refreshToken);
router.post("/auth/logout", authenticate, demoGuard, AuthController.logout);
router.get("/auth/profile", authenticate, demoGuard, AuthController.profile);
router.put(
  "/auth/profile",
  authenticate,
  demoGuard,
  AuthController.updateProfile,
);
router.put(
  "/auth/password",
  authenticate,
  demoGuard,
  AuthController.changePassword,
);

// ═══════════════════════════════════════════════════════════════════
// FINANCE ROLE — Path-prefix API block
// ─────────────────────────────────────────────────────────────────
// Role 'finance' DILARANG akses prefix-prefix di bawah ini. Pasang sebelum
// route handler aslinya supaya middleware ini tereksekusi duluan dan menolak
// request dengan 403 sebelum sampai ke controller.
// Aturan: cuma block prefix yang jelas-jelas modul admin. Endpoint shared
// (billing, payments, customers, packages, keuangan, laporan, dashboard,
// app-settings GET, notifications, auth/profile) tetap accessible.
// ═══════════════════════════════════════════════════════════════════
const _financeBlockedPrefixes = [
  "/mikrotik", // MikroTik commands
  "/genieacs", // TR-069 / ONT actions
  "/ont", // ONT actions
  "/devices", // Device CRUD (kecuali read — di-handle controller)
  "/firewall",
  "/olt",
  "/hotspot",
  "/pppoe",
  "/monitoring",
  "/ping-monitor",
  "/host-monitor",
  "/isolir",
  "/wa", // WA send/sessions/templates/reminder/report
  "/whatsapp",
  "/broadcast",
  "/message-logs", // log WA — admin only
  "/topology",
  "/tickets",
  "/todos",
  "/work-orders",
  "/assets",
  "/infrastructure",
  "/snmp",
  "/traffic",
  "/queue",
  "/ippool",
  "/voucher",
  "/voucher-template",
  "/invoice-template", // template editor — admin only (finance bisa lihat list invoice via /billing)
  "/notifications/admin",
  "/push",
  "/gps",
  "/technician-location",
  "/work-order",
  "/users", // user management — admin only
  "/roles",
  "/permissions",
  "/activity-logs",
  "/system",
  "/resources",
];
for (const p of _financeBlockedPrefixes) {
  router.use(p, authenticate, apiBlockFinanceArea);
}
// Settings: GET app-settings boleh (untuk load brand), tapi POST/PUT/DELETE ditolak
router.use("/app-settings", authenticate, (req, res, next) => {
  if (req.method === "GET") return next();
  return apiBlockFinanceArea(req, res, next);
});

// ═══════════════════════════════════════════════════════════════════
// NOC ROLE — API ACCESS RESTRICTIONS
// Role 'noc' fokus monitoring jaringan. TIDAK boleh akses modul billing,
// payments, customers (admin), packages, keuangan, settings, users, dll.
// API monitoring/devices/mikrotik/genieacs/hotspot tetap accessible.
// ═══════════════════════════════════════════════════════════════════
const _nocBlockedPrefixes = [
  "/billing", // billing & invoice
  "/payments", // pembayaran customer
  "/keuangan", // keuangan
  "/finance", // finance dashboard endpoints
  "/laporan", // laporan keuangan
  "/packages", // paket layanan (price)
  "/voucher",
  "/voucher-template",
  "/invoice-template",
  "/customers", // customer CRUD (NOC bisa cek dari monitoring)
  "/wa", // WA gateway full (NOC bisa lihat status, tapi tidak kirim)
  "/whatsapp",
  "/broadcast",
  "/message-logs",
  "/users",
  "/roles",
  "/permissions",
  "/activity-logs",
  "/system",
];
for (const p of _nocBlockedPrefixes) {
  router.use(p, authenticate, apiBlockNocArea);
}
// Settings: GET boleh, mutasi tidak
router.use("/app-settings", authenticate, (req, res, next) => {
  if (req.method === "GET") return next();
  return apiBlockNocArea(req, res, next);
});

// ===== DASHBOARD =====
router.get(
  "/dashboard/overview",
  authenticate,
  demoGuard,
  DashboardController.overview,
);
router.get(
  "/dashboard/top-customers",
  authenticate,
  demoGuard,
  DashboardController.topCustomersBandwidth,
);
router.get(
  "/dashboard/network-uptime",
  authenticate,
  demoGuard,
  DashboardController.networkUptime,
);
router.get(
  "/dashboard/ticket-stats",
  authenticate,
  demoGuard,
  DashboardController.ticketStats,
);
router.get(
  "/dashboard/bandwidth-trends",
  authenticate,
  demoGuard,
  DashboardController.bandwidthTrends,
);
router.get(
  "/dashboard/bandwidth-interfaces",
  authenticate,
  demoGuard,
  DashboardController.bandwidthInterfaces,
);
router.get(
  "/dashboard/customer-growth",
  authenticate,
  demoGuard,
  DashboardController.customerGrowth,
);
router.get(
  "/dashboard/revenue-forecast",
  authenticate,
  demoGuard,
  DashboardController.revenueForecast,
);

// Dashboard Layout Customization
router.get(
  "/dashboard/layout",
  authenticate,
  demoGuard,
  DashboardLayoutController.getLayout,
);
router.post(
  "/dashboard/layout",
  authenticate,
  demoGuard,
  DashboardLayoutController.saveLayout,
);
router.post(
  "/dashboard/layout/reset",
  authenticate,
  demoGuard,
  DashboardLayoutController.resetLayout,
);

// ===== USERS =====
router.get(
  "/users",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  UserController.index,
);
router.post(
  "/users",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("create", "user"),
  UserController.create,
);
router.get(
  "/users/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  UserController.show,
);
router.put(
  "/users/:id",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("update", "user"),
  UserController.update,
);
router.delete(
  "/users/:id",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("delete", "user"),
  UserController.destroy,
);

// ===== ROLES & PERMISSIONS =====
router.get("/roles", authenticate, demoGuard, UserController.getRoles);
router.post(
  "/roles",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("create", "role"),
  UserController.createRole,
);
router.put(
  "/roles/:id",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("update", "role"),
  UserController.updateRole,
);
router.delete(
  "/roles/:id",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("delete", "role"),
  UserController.deleteRole,
);
router.get(
  "/permissions",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  UserController.getPermissions,
);

// ===== CUSTOMERS =====
router.get("/customers", authenticate, demoGuard, CustomerController.index);
router.post(
  "/customers",
  authenticate,
  demoGuard,
  hasPermission("customer_create"),
  logActivity("create", "customer"),
  CustomerController.create,
);
router.get(
  "/customers/stats",
  authenticate,
  demoGuard,
  CustomerController.stats,
);
router.get(
  "/customers/map",
  authenticate,
  demoGuard,
  CustomerController.mapData,
);
router.get(
  "/customers/next-id",
  authenticate,
  demoGuard,
  CustomerController.nextCustomerId,
);
router.get(
  "/customers/check-id",
  authenticate,
  demoGuard,
  CustomerController.checkCustomerId,
);

// ── Customer Import / Export ──────────────────────────────────────────
const CustomerImportController = require("../controllers/CustomerImportController");
const customerImportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/imports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(
      null,
      `customer-import-${ts}${path.extname(file.originalname).toLowerCase()}`,
    );
  },
});
const customerImportUpload = multer({
  storage: customerImportStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Format tidak didukung. Gunakan .xlsx atau .xls"));
  },
});

router.get(
  "/customers/export",
  authenticate,
  demoGuard,
  hasPermission("customer_view"),
  CustomerImportController.exportExcel,
);

router.get(
  "/customers/import-template",
  authenticate,
  demoGuard,
  hasPermission("customer_view"),
  CustomerImportController.downloadTemplate,
);

router.post(
  "/customers/import-preview",
  authenticate,
  demoGuard,
  hasPermission("customer_create"),
  customerImportUpload.single("file"),
  CustomerImportController.importPreview,
);

router.post(
  "/customers/import-confirm",
  authenticate,
  demoGuard,
  hasPermission("customer_create"),
  logActivity("import", "customer"),
  CustomerImportController.importConfirm,
);

router.get("/customers/:id", authenticate, demoGuard, CustomerController.show);
router.put(
  "/customers/:id",
  authenticate,
  demoGuard,
  hasPermission("customer_update"),
  logActivity("update", "customer"),
  CustomerController.update,
);
router.delete(
  "/customers/:id",
  authenticate,
  demoGuard,
  hasPermission("customer_delete"),
  logActivity("delete", "customer"),
  CustomerController.destroy,
);

// ── Portal Credentials (admin-only) ───────────────────────────────────
// Admin mengubah customer_id & password yang dipakai pelanggan
// untuk login ke Customer Portal. Password di-bcrypt di controller —
// JANGAN pernah set portal_password via PUT /customers/:id generic.
router.get(
  "/customers/:id/portal-credentials",
  authenticate,
  demoGuard,
  hasPermission("customer_view"),
  CustomerController.getPortalCredentials,
);

router.post(
  "/customers/:id/portal-credentials",
  authenticate,
  demoGuard,
  hasPermission("customer_update"),
  logActivity("update", "customer_portal_credentials"),
  CustomerController.updatePortalCredentials,
);

router.post(
  "/customers/:id/portal-credentials/reset",
  authenticate,
  demoGuard,
  hasPermission("customer_update"),
  logActivity("reset", "customer_portal_password"),
  CustomerController.resetPortalPassword,
);

// ── PPPoE Username Rename (with optional MikroTik sync) ───────────────
// Endpoint khusus untuk rename pppoe_username, dengan opsi sync ke router.
// Lebih aman daripada PUT /customers/:id generic karena:
//   - Atomic: kalau sync router gagal, DB tidak ikut berubah
//   - Eksplisit: admin sadar konsekuensinya (disconnect customer saat rename)
//   - Audit-able: punya log activity sendiri
router.post(
  "/customers/:id/rename-pppoe",
  authenticate,
  demoGuard,
  hasPermission("customer_update"),
  logActivity("rename_pppoe", "customer"),
  CustomerController.renamePppoe,
);

// ===== PACKAGES =====
router.get("/packages/stats", authenticate, demoGuard, PackageController.stats);
router.get("/packages", authenticate, demoGuard, PackageController.index);
router.post(
  "/packages",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("create", "package"),
  PackageController.create,
);
router.get("/packages/:id", authenticate, demoGuard, PackageController.show);
router.put(
  "/packages/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("update", "package"),
  PackageController.update,
);
router.delete(
  "/packages/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("delete", "package"),
  PackageController.destroy,
);

// ===== BILLING =====
router.get(
  "/billing/invoices",
  authenticate,
  demoGuard,
  BillingController.listInvoices,
);
router.get(
  "/billing/invoices/:id",
  authenticate,
  demoGuard,
  BillingController.showInvoice,
);
router.post(
  "/billing/generate",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("generate", "invoice"),
  BillingController.generateInvoices,
);
router.post(
  "/billing/payment",
  authenticate,
  demoGuard,
  hasPermission("billing_payment"),
  logActivity("create", "payment"),
  BillingController.recordPayment,
);
router.post(
  "/billing/mark-overdue",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  BillingController.markOverdue,
);
router.post(
  "/billing/invoices/:id/reminder",
  authenticate,
  demoGuard,
  BillingController.sendReminder,
);
router.post(
  "/billing/invoices/:id/mark-paid",
  authenticate,
  demoGuard,
  BillingController.markPaid,
);
router.post(
  "/billing/bulk-reminder",
  authenticate,
  demoGuard,
  BillingController.bulkReminder,
);
router.get(
  "/billing/summary",
  authenticate,
  demoGuard,
  BillingController.financialSummary,
);
router.get("/billing/stats", authenticate, demoGuard, BillingController.stats);
router.get(
  "/billing/collection-stats",
  authenticate,
  demoGuard,
  BillingController.collectionStats,
);
router.get(
  "/billing/due-date-lists",
  authenticate,
  demoGuard,
  BillingController.dueDateLists,
);
router.get(
  "/billing/daily-transactions",
  authenticate,
  demoGuard,
  BillingController.dailyTransactions,
);
router.get(
  "/billing/recent-transactions",
  authenticate,
  demoGuard,
  BillingController.recentTransactions,
);

// ─── FINANCE DASHBOARD SUPPORT ENDPOINTS ───
const FinanceController = require("../controllers/FinanceController");
router.get(
  "/finance/activity",
  authenticate,
  demoGuard,
  FinanceController.activity,
);
router.get(
  "/finance/insights",
  authenticate,
  demoGuard,
  FinanceController.insights,
);
router.post(
  "/finance/quick-expense",
  authenticate,
  demoGuard,
  FinanceController.quickExpense,
);
router.get(
  "/finance/reminder-config",
  authenticate,
  demoGuard,
  FinanceController.reminderConfig,
);
router.post(
  "/finance/reminder-config",
  authenticate,
  demoGuard,
  FinanceController.toggleReminder,
);

// ─── NOC DASHBOARD SUPPORT ENDPOINTS ───
const NocController = require("../controllers/NocController");
router.get("/noc/overview", authenticate, demoGuard, NocController.overview);
router.get("/noc/alerts", authenticate, demoGuard, NocController.alerts);
router.get(
  "/noc/ticket-stats",
  authenticate,
  demoGuard,
  NocController.ticketStats,
);
// Router-specific endpoints (real-time data via MikroTik API)
router.get("/noc/routers", authenticate, demoGuard, NocController.routers);
router.get(
  "/noc/router/:id/resource",
  authenticate,
  demoGuard,
  NocController.routerResource,
);
router.get(
  "/noc/router/:id/realtime",
  authenticate,
  demoGuard,
  NocController.routerRealtime,
);
router.get(
  "/noc/router/:id/history",
  authenticate,
  demoGuard,
  NocController.routerHistory,
);
router.get(
  "/noc/router/:id/interfaces",
  authenticate,
  demoGuard,
  NocController.routerInterfaces,
);

// Monitor preset CRUD (user-scoped bandwidth chart cards)
router.get(
  "/noc/monitors",
  authenticate,
  demoGuard,
  NocController.listMonitors,
);
router.post(
  "/noc/monitors",
  authenticate,
  demoGuard,
  NocController.createMonitor,
);
router.patch(
  "/noc/monitors/:id",
  authenticate,
  demoGuard,
  NocController.updateMonitor,
);
router.delete(
  "/noc/monitors/:id",
  authenticate,
  demoGuard,
  NocController.deleteMonitor,
);
router.get(
  "/billing/unpaid-customers",
  authenticate,
  demoGuard,
  BillingController.unpaidCustomers,
);
router.get(
  "/billing/total-outstanding",
  authenticate,
  demoGuard,
  BillingController.totalOutstanding,
);

// ── Reset / Hapus Invoice (DESTRUCTIVE — superadmin only) ────
// Preview boleh admin (read-only); destroy hanya superadmin
router.get(
  "/billing/invoices/reset/preview",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  BillingController.previewResetInvoices,
);
router.post(
  "/billing/invoices/reset",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  logActivity("reset", "invoice"),
  BillingController.resetInvoices,
);
// Recalculate tax untuk invoice unpaid sesuai setting PPN saat ini
router.post(
  "/billing/recalculate-tax",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("recalculate", "invoice"),
  BillingController.recalculateTax,
);
// Preview generate — cek berapa customer aktif & punya paket sebelum generate
router.get(
  "/billing/generate/preview",
  authenticate,
  demoGuard,
  BillingController.previewGenerate,
);

// ── Logo & Favicon Upload ────────────────────────────────────────────
// (multer/path/fs sudah di-require di atas)
//
// Catatan implementasi (FIX bug "logo tidak terganti & menumpuk di aaPanel"):
//   1. Multer menyimpan dengan ekstensi asli (logo.png, logo.jpg, dst).
//      Kalau user upload .jpg lalu .png, file lama TIDAK akan ter-overwrite
//      karena nama filenya beda. Solusi: sebelum simpan baru, hapus SEMUA
//      file dengan prefix 'logo.' / 'favicon.' apa pun ekstensinya.
//   2. URL yang disimpan ke DB ditambah `?v=<timestamp>` agar browser
//      melakukan refresh resource walau pathnya sama. Sidebar, tab favicon,
//      preview di settings — semua otomatis ikut.
//   3. fileSync (writeFile manual) dipakai supaya rangkaian "hapus lama →
//      tulis baru" deterministik, bukan dua step yang bisa race.

const UPLOAD_DIR = path.join(__dirname, "../../frontend/public/uploads");
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Hapus semua file di UPLOAD_DIR yang basename-nya (tanpa ekstensi) cocok
 * dengan `baseName`. Aman terhadap ekstensi yang berbeda dari upload sebelumnya.
 */
function cleanupOldBrandFiles(baseName) {
  try {
    ensureUploadDir();
    const files = fs.readdirSync(UPLOAD_DIR);
    files.forEach((f) => {
      // Match "logo.xxx" tapi BUKAN "logo-something.xxx" (hindari hapus file lain)
      const stem = path.parse(f).name; // tanpa ext
      if (stem === baseName) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, f));
        } catch (e) {
          console.warn("[brand-upload] gagal hapus", f, e.message);
        }
      }
    });
  } catch (e) {
    console.warn("[brand-upload] cleanup error:", e.message);
  }
}

// Multer pakai memoryStorage — kita tulis file manual SETELAH cleanup,
// supaya tidak ada window di mana file lama & baru sama-sama eksis.
const brandMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
  fileFilter: (req, file, cb) => {
    // Filter ditangani di handler (logo & favicon punya allow-list berbeda)
    cb(null, true);
  },
});

router.post(
  "/upload/logo",
  authenticate,
  demoGuard,
  brandMemoryUpload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada file" });

      const allowed = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: "Format tidak didukung. Gunakan PNG/JPG/SVG/WebP",
        });
      }
      // Multer sudah enforce 2MB via limits, tapi jaga-jaga:
      if (req.file.size > 2 * 1024 * 1024) {
        return res
          .status(400)
          .json({ success: false, message: "Ukuran logo maksimal 2MB" });
      }

      ensureUploadDir();
      // 1) Hapus semua file logo.* lama (ekstensi apa pun)
      cleanupOldBrandFiles("logo");
      // 2) Tulis file baru
      const filename = "logo" + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

      // 3) URL dengan cache-bust → memaksa browser fetch versi baru
      const version = Date.now();
      const logoUrl = `/uploads/${filename}?v=${version}`;

      const { AppSetting } = require("../models");
      await AppSetting.upsert({
        key: "logo_url",
        value: logoUrl,
        type: "string",
      });
      if (typeof global._invalidateAppSettingsCache === "function") {
        global._invalidateAppSettingsCache();
      }
      res.json({
        success: true,
        url: logoUrl,
        message: "Logo berhasil diupload",
      });
    } catch (e) {
      console.error("[upload/logo]", e);
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// Hapus logo (revert ke default ikon)
router.delete("/upload/logo", authenticate, demoGuard, async (req, res) => {
  try {
    cleanupOldBrandFiles("logo");
    const { AppSetting } = require("../models");
    await AppSetting.destroy({ where: { key: "logo_url" } });
    if (typeof global._invalidateAppSettingsCache === "function") {
      global._invalidateAppSettingsCache();
    }
    res.json({ success: true, message: "Logo dikembalikan ke default" });
  } catch (e) {
    console.error("[upload/logo DELETE]", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Favicon Upload ──────────────────────────────────────────────────
// Favicon yang tampil di tab browser. Format direkomendasikan: .ico, .png (32x32 atau 64x64).
router.post(
  "/upload/favicon",
  authenticate,
  demoGuard,
  brandMemoryUpload.single("favicon"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada file" });
      }

      const allowed = [".ico", ".png", ".svg", ".jpg", ".jpeg"];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: "Format tidak didukung. Gunakan ICO/PNG/SVG/JPG",
        });
      }
      if (req.file.size > 1 * 1024 * 1024) {
        return res
          .status(400)
          .json({ success: false, message: "Ukuran favicon maksimal 1MB" });
      }

      ensureUploadDir();
      cleanupOldBrandFiles("favicon");
      const filename = "favicon" + ext;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

      const version = Date.now();
      const faviconUrl = `/uploads/${filename}?v=${version}`;

      const { AppSetting } = require("../models");
      await AppSetting.upsert({
        key: "favicon_url",
        value: faviconUrl,
        type: "string",
      });
      if (typeof global._invalidateAppSettingsCache === "function") {
        global._invalidateAppSettingsCache();
      }
      res.json({
        success: true,
        url: faviconUrl,
        message:
          "Favicon berhasil diupload. Refresh halaman untuk melihat perubahan di tab browser.",
      });
    } catch (e) {
      console.error("[upload/favicon]", e);
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// Hapus favicon (revert ke default)
router.delete("/upload/favicon", authenticate, demoGuard, async (req, res) => {
  try {
    cleanupOldBrandFiles("favicon");
    const { AppSetting } = require("../models");
    await AppSetting.destroy({ where: { key: "favicon_url" } });
    if (typeof global._invalidateAppSettingsCache === "function") {
      global._invalidateAppSettingsCache();
    }
    res.json({ success: true, message: "Favicon dikembalikan ke default" });
  } catch (e) {
    console.error("[upload/favicon DELETE]", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Portal Hero Image Upload (untuk halaman login customer portal) ─
const portalHeroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../frontend/public/uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "portal-hero" + ext);
  },
});
const portalHeroUpload = multer({
  storage: portalHeroStorage,
  limits: { fileSize: 4 * 1024 * 1024 }, // max 4MB (image bisa lebih besar dari logo)
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Format tidak didukung. Gunakan PNG/JPG/WebP"));
  },
});

router.post(
  "/upload/portal-hero",
  authenticate,
  demoGuard,
  portalHeroUpload.single("hero"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada file" });
      const heroUrl = "/uploads/" + req.file.filename + "?v=" + Date.now(); // cache-bust
      const { AppSetting } = require("../models");
      await AppSetting.upsert({
        key: "portal_hero_image",
        value: heroUrl,
        type: "string",
      });
      res.json({
        success: true,
        url: heroUrl,
        message: "Foto hero berhasil diupload",
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

router.delete(
  "/upload/portal-hero",
  authenticate,
  demoGuard,
  async (req, res) => {
    try {
      const { AppSetting } = require("../models");
      await AppSetting.upsert({
        key: "portal_hero_image",
        value: "",
        type: "string",
      });
      res.json({ success: true, message: "Foto hero dihapus" });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// ── Upload Foto ODP/Infrastruktur ────────────────────────────
const infraPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../frontend/public/uploads/infra");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(
      null,
      "infra_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2, 7) +
        ext,
    );
  },
});
const infraPhotoUpload = multer({
  storage: infraPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else cb(new Error("Format tidak didukung. Gunakan PNG/JPG/WebP"));
  },
});

router.post(
  "/upload/infra-photo",
  authenticate,
  demoGuard,
  infraPhotoUpload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada file" });
      const url = "/uploads/infra/" + req.file.filename;
      res.json({ success: true, url, message: "Foto berhasil diupload" });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// ── Upload Logo Metode Pembayaran (bank/e-wallet/QRIS) ──────
const paymentLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../frontend/public/uploads/payment");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(
      null,
      "pay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7) + ext,
    );
  },
});
const paymentLogoUpload = multer({
  storage: paymentLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase()))
      cb(null, true);
    else cb(new Error("Format tidak didukung. Gunakan PNG/JPG/SVG/WebP"));
  },
});

router.post(
  "/upload/payment-logo",
  authenticate,
  demoGuard,
  paymentLogoUpload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "Tidak ada file" });
      const url = "/uploads/payment/" + req.file.filename;
      res.json({ success: true, url, message: "Logo berhasil diupload" });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// ── Isolir Management ───────────────────────────────────────
const IsolirCtrl = require("../controllers/IsolirController");
router.get("/isolir/stats", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.stats(r, s),
);
router.get("/isolir/devices", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listDevices(r, s),
);
router.get("/isolir/available-devices", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listAvailableDevices(r, s),
);
router.post("/isolir/devices", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.saveDevice(r, s),
);
router.put("/isolir/devices/:id", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.saveDevice(r, s),
);
router.delete("/isolir/devices/:id", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.deleteDevice(r, s),
);
router.post("/isolir/devices/:id/ping", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.testConnection(r, s),
);
router.post(
  "/isolir/devices/:id/setup-firewall",
  authenticate,
  demoGuard,
  (r, s) => IsolirCtrl.setupFirewall(r, s),
);
router.get("/isolir/isolated", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listIsolated(r, s),
);
router.get("/isolir/eligible", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listEligible(r, s),
);
router.get("/isolir/due-alerts", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.dueAlerts(r, s),
);
router.post("/isolir/customers/:id/isolir", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.isolir(r, s),
);
router.post("/isolir/customers/:id/restore", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.restore(r, s),
);
router.post("/isolir/run-auto", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.runAutoIsolir(r, s),
);
router.get("/isolir/logs", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.getLogs(r, s),
);
router.get("/isolir/settings", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.getSettings(r, s),
);
router.post("/isolir/settings", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.saveSettings(r, s),
);

// ── Bypass list (situs/IP yang masih boleh diakses pelanggan diisolir) ──
router.get("/isolir/bypass/global", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listGlobalBypass(r, s),
);
router.post("/isolir/bypass/global", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.addGlobalBypass(r, s),
);
router.delete("/isolir/bypass/global/:id", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.deleteGlobalBypass(r, s),
);
router.get("/isolir/devices/:id/bypass", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.listRouterBypass(r, s),
);
router.post("/isolir/devices/:id/bypass", authenticate, demoGuard, (r, s) =>
  IsolirCtrl.addRouterBypass(r, s),
);
router.delete(
  "/isolir/devices/:id/bypass/:entryId",
  authenticate,
  demoGuard,
  (r, s) => IsolirCtrl.deleteRouterBypass(r, s),
);
router.get(
  "/isolir/devices/:id/bypass-merged",
  authenticate,
  demoGuard,
  (r, s) => IsolirCtrl.previewMergedBypass(r, s),
);
router.post(
  "/isolir/devices/:id/sync-bypass",
  authenticate,
  demoGuard,
  (r, s) => IsolirCtrl.syncBypass(r, s),
);

// ── App Settings (brand, general, company, payment-gateway, tax) ─
router.post("/app-settings", authenticate, demoGuard, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    // Whitelist setting keys yang boleh diubah lewat endpoint ini
    const allowed = [
      "brand_mode",
      "app_name",
      "app_tagline",
      "logo_url",
      "company_name",
      "company_whatsapp",
      "snmp_community",
      "poll_interval",
      // Portal customer branding
      "portal_hero_image",
      "portal_hero_overlay",
      "portal_welcome_title",
      "portal_welcome_sub",
      // Note: payment_accounts punya endpoint tersendiri (di bawah)
      "payment_gateway_enabled",
      "payment_gateway_provider",
      "payment_gateway_env",
      "payment_gateway_server_key",
      "payment_gateway_client_key",
      "payment_gateway_callback_token",
      // Duitku-specific: merchantCode (dipisah dari server_key yang dipakai sebagai apiKey)
      "payment_gateway_merchant_code",
      // Tax / PPN settings
      "tax_enabled",
      "tax_rate",
      "tax_mode",
      "tax_label",
      // Auto-generate invoice (cron tiap awal bulan)
      "auto_generate_invoice",
      // Invoice template designer (semua key prefix invtpl_)
      "invtpl_primary_color",
      "invtpl_accent_color",
      "invtpl_text_color",
      "invtpl_font_family",
      "invtpl_paper_size",
      "invtpl_header_style",
      "invtpl_show_logo",
      "invtpl_logo_url",
      "invtpl_company_name",
      "invtpl_company_tagline",
      "invtpl_company_address",
      "invtpl_company_phone",
      "invtpl_company_email",
      "invtpl_show_subtotal",
      "invtpl_show_tax",
      "invtpl_show_due_date",
      "invtpl_show_signature",
      "invtpl_show_active_until",
      "invtpl_show_payment_method",
      "invtpl_show_bank_info",
      "invtpl_footer_text",
      "invtpl_thank_you_text",
      "invtpl_invoice_label",
      "invtpl_section_recipient_label",
      "invtpl_section_detail_label",
      // Voucher template designer (semua key prefix vtpl_)
      "vtpl_primary_color",
      "vtpl_primary_dark",
      "vtpl_accent_color",
      "vtpl_company_name",
      "vtpl_tagline",
      "vtpl_logo_url",
      "vtpl_label_username",
      "vtpl_label_password",
      "vtpl_label_profile",
      "vtpl_label_duration",
      "vtpl_label_price",
      "vtpl_show_wifi",
      "vtpl_show_price",
      "vtpl_show_duration",
      "vtpl_show_profile",
      "vtpl_show_footer",
      "vtpl_columns",
      "vtpl_footer_text",
    ];
    let taxChanged = false;
    let brandChanged = false;
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await AppSetting.upsert({
          key,
          value: String(req.body[key] || ""),
          type: "string",
        });
        if (key.startsWith("tax_")) taxChanged = true;
        if (key === "app_name" || key === "company_name") brandChanged = true;
      }
    }
    // Reset cache PPN agar perubahan langsung berlaku
    if (taxChanged) {
      try {
        require("../utils/taxHelper").invalidateCache();
      } catch (_) {}
    }
    // Reset cache companyInfo agar variable {perusahaan} di template WA
    // langsung pakai nama baru (tanpa menunggu TTL 30 detik habis)
    if (brandChanged) {
      try {
        require("../utils/companyInfo").clearCompanyNameCache();
      } catch (_) {}
    }
    // Invalidate cache app-settings di server.js supaya perubahan
    // app_name/logo/favicon langsung terlihat di title browser & UI
    if (typeof global._invalidateAppSettingsCache === "function") {
      global._invalidateAppSettingsCache();
    }
    res.json({ success: true, message: "Pengaturan disimpan" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get("/app-settings", authenticate, demoGuard, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    const rows = await AppSetting.findAll();
    const data = {};
    rows.forEach((r) => {
      data[r.key] = r.value;
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Tax Settings (public read) ──────────────────────────────
// Endpoint kecil untuk frontend (admin & portal) yang butuh tahu rate PPN saat ini.
// Tidak butuh auth karena hanya membocorkan info publik (rate, label, enabled).
router.get("/app-settings/tax", async (req, res) => {
  try {
    const { loadTaxSettings } = require("../utils/taxHelper");
    const cfg = await loadTaxSettings();
    res.json({
      success: true,
      data: {
        enabled: cfg.enabled,
        rate: cfg.rate,
        mode: cfg.mode,
        label: cfg.label,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Payment Gateway: Test Configuration ──────────────────────
// Validate server_key dengan dummy API call — tanpa bikin invoice beneran
router.post(
  "/app-settings/payment-gateway/test",
  authenticate,
  demoGuard,
  async (req, res) => {
    try {
      const axios = require("axios");
      const crypto = require("crypto");
      const { AppSetting } = require("../models");
      const rows = await AppSetting.findAll({
        where: {
          key: [
            "payment_gateway_enabled",
            "payment_gateway_provider",
            "payment_gateway_env",
            "payment_gateway_server_key",
            "payment_gateway_client_key",
            "payment_gateway_merchant_code",
          ],
        },
      });
      const cfg = {};
      rows.forEach((r) => {
        cfg[r.key] = r.value;
      });

      const provider = cfg.payment_gateway_provider || "midtrans";
      const env = cfg.payment_gateway_env || "sandbox";
      const srvKey = cfg.payment_gateway_server_key || "";
      const cliKey = cfg.payment_gateway_client_key || "";
      const merchantCode = cfg.payment_gateway_merchant_code || "";
      const isProd = env === "production";

      const result = { provider, env, checks: [] };
      const addCheck = (label, pass, detail) =>
        result.checks.push({ label, pass, detail });

      // ── Check 1: Key format ──
      if (!srvKey) {
        addCheck(
          "Server Key terisi",
          false,
          "Field kosong. Isi di form di atas dan klik Simpan.",
        );
        return res.json({
          success: false,
          message: "Server Key belum diisi",
          data: result,
        });
      }
      addCheck("Server Key terisi", true, `${srvKey.length} karakter`);

      if (provider === "midtrans") {
        // Midtrans menerima key dengan prefix "Mid-server-" atau "SB-Mid-server-".
        // Environment ditentukan oleh URL endpoint (bukan prefix), jadi validasi tidak terlalu ketat.
        const formatOk = /^(SB-)?Mid-server-/.test(srvKey);
        addCheck(
          `Format key Midtrans`,
          formatOk,
          formatOk
            ? `Key dimulai "${srvKey.slice(0, srvKey.indexOf("-server-") + 8)}..." — format valid`
            : `Key harus dimulai "Mid-server-" atau "SB-Mid-server-". Saat ini "${srvKey.slice(0, 15)}..."`,
        );
        if (!formatOk)
          return res.json({
            success: false,
            message: "Format Server Key tidak dikenali",
            data: result,
          });

        if (cliKey) {
          const cliOk = /^(SB-)?Mid-client-/.test(cliKey);
          addCheck(
            "Client Key format",
            cliOk,
            cliOk ? "OK" : 'Harus dimulai "Mid-client-" atau "SB-Mid-client-"',
          );
        } else {
          addCheck(
            "Client Key terisi",
            false,
            "Wajib untuk Snap.js di portal customer",
          );
        }
      } else if (provider === "xendit") {
        const expectPrefix = isProd ? "xnd_production_" : "xnd_development_";
        const formatOk = srvKey.startsWith(expectPrefix);
        addCheck(
          `Format key sesuai ${env}`,
          formatOk,
          formatOk ? "OK" : `Harus dimulai "${expectPrefix}"`,
        );
        if (!formatOk)
          return res.json({
            success: false,
            message: "Format Secret API Key tidak sesuai environment",
            data: result,
          });
      } else if (provider === "duitku") {
        // Duitku punya 2 credentials wajib: Merchant Code (DXXXXX) + API Key (hex 32 char umumnya)
        addCheck(
          "Merchant Code terisi",
          !!merchantCode,
          merchantCode ? `${merchantCode}` : "Field kosong",
        );
        if (!merchantCode) {
          return res.json({
            success: false,
            message: "Merchant Code Duitku belum diisi",
            data: result,
          });
        }
        const mcOk = /^[A-Z0-9]{3,15}$/i.test(merchantCode);
        addCheck(
          "Format Merchant Code",
          mcOk,
          mcOk
            ? "OK"
            : "Harus alfanumerik 3-15 karakter (contoh: DXXXXX / DSXXXXX)",
        );
        if (!mcOk)
          return res.json({
            success: false,
            message: "Format Merchant Code tidak valid",
            data: result,
          });

        const keyOk = srvKey.length >= 16;
        addCheck(
          "Panjang API Key",
          keyOk,
          keyOk
            ? `${srvKey.length} karakter`
            : "API Key Duitku terlalu pendek (minimum 16 karakter)",
        );
        if (!keyOk)
          return res.json({
            success: false,
            message: "API Key Duitku terlalu pendek",
            data: result,
          });
      }

      // ── Check 2: API call dummy (Midtrans ping, Xendit GET balance) ──
      const auth = Buffer.from(srvKey + ":").toString("base64");
      try {
        if (provider === "midtrans") {
          // Midtrans tidak punya /ping, tapi kita coba request invalid transaction untuk trigger validation
          // kalau key salah → 401, kalau key benar → 400 "validation_messages" (itu artinya auth ok)
          const testUrl = isProd
            ? "https://api.midtrans.com/v2/status/dummy-order-id"
            : "https://api.sandbox.midtrans.com/v2/status/dummy-order-id";
          await axios
            .get(testUrl, {
              headers: {
                Authorization: `Basic ${auth}`,
                Accept: "application/json",
              },
              timeout: 10000,
              validateStatus: (s) => s < 500,
            })
            .then((r) => {
              if (r.status === 401) {
                addCheck(
                  "Midtrans auth",
                  false,
                  "Server Key ditolak (401). Cek ulang di dashboard Midtrans.",
                );
                throw new Error("401");
              }
              if (
                r.status === 404 ||
                (r.data && r.data.status_code === "404")
              ) {
                // 404 "Transaction doesn't exist" = auth OK
                addCheck(
                  "Midtrans auth",
                  true,
                  "Server Key valid (API merespons)",
                );
              } else {
                addCheck(
                  "Midtrans auth",
                  true,
                  `API merespons: HTTP ${r.status}`,
                );
              }
            });
        } else if (provider === "xendit") {
          const r = await axios.get("https://api.xendit.co/balance", {
            headers: { Authorization: `Basic ${auth}` },
            timeout: 10000,
            validateStatus: (s) => s < 500,
          });
          if (r.status === 401) {
            addCheck("Xendit auth", false, "Secret API Key ditolak (401).");
            throw new Error("401");
          } else if (r.status === 200) {
            addCheck(
              "Xendit auth",
              true,
              `Saldo ${r.data?.balance ? "Rp " + r.data.balance.toLocaleString("id-ID") : "terbaca"}`,
            );
          } else {
            addCheck(
              "Xendit auth",
              false,
              `HTTP ${r.status}: ${r.data?.message || "unknown"}`,
            );
            throw new Error("Xendit " + r.status);
          }
        } else if (provider === "duitku") {
          // Duitku tidak punya endpoint /ping. Kita pakai /transactionStatus dengan
          // merchantOrderId acak: kalau key benar → response statusCode='01' "Transaction not found"
          // (atau kadang HTTP 200 dgn statusMessage relevan); kalau signature salah → "Wrong signature".
          const dummyOrderId = "TEST-CFG-" + Date.now();
          const sig = crypto
            .createHash("md5")
            .update(merchantCode + dummyOrderId + srvKey)
            .digest("hex");
          const tsUrl = isProd
            ? "https://passport.duitku.com/webapi/api/merchant/transactionStatus"
            : "https://sandbox.duitku.com/webapi/api/merchant/transactionStatus";
          const r = await axios.post(
            tsUrl,
            {
              merchantCode,
              merchantOrderId: dummyOrderId,
              signature: sig,
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: 10000,
              validateStatus: (s) => s < 500,
            },
          );
          // Response Duitku biasanya HTTP 200 dengan body JSON.
          // Kalau auth salah: { Message: "Wrong signature" } HTTP 400, atau
          // statusCode='01' / 'Wrong signature' / 'Merchant not found'.
          const data = r.data || {};
          const msg = (data.Message || data.statusMessage || "")
            .toString()
            .toLowerCase();
          const authBad =
            msg.includes("wrong signature") ||
            msg.includes("invalid signature") ||
            msg.includes("merchant not found") ||
            msg.includes("unauthorized") ||
            r.status === 401 ||
            r.status === 403;
          if (authBad) {
            addCheck(
              "Duitku auth",
              false,
              `Auth ditolak: ${data.Message || data.statusMessage || "HTTP " + r.status}. Cek Merchant Code & API Key.`,
            );
            throw new Error("Duitku auth");
          }
          // Selain itu = key valid (transaksi tidak ditemukan = expected).
          addCheck(
            "Duitku auth",
            true,
            `API merespons: ${data.statusMessage || data.Message || "HTTP " + r.status} (auth OK)`,
          );
        }
      } catch (e) {
        const allPass = result.checks.every((c) => c.pass);
        return res.json({
          success: allPass,
          message: allPass ? "OK" : "Gagal verifikasi: " + e.message,
          data: result,
        });
      }

      // ── Check 3: Webhook URL reachable (basic — info saja) ──
      const baseUrl =
        process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const webhookUrl = `${baseUrl}/portal/webhook/${provider}`;
      addCheck(
        "Webhook URL",
        true,
        webhookUrl + " (pastikan sudah diset di dashboard " + provider + ")",
      );

      const allPass = result.checks.every((c) => c.pass);
      res.json({
        success: allPass,
        message: allPass
          ? "Konfigurasi OK — siap terima pembayaran"
          : "Ada item yang perlu diperbaiki",
        data: result,
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// ── Payment Accounts (metode pembayaran untuk portal customer) ──
router.get("/payment-accounts", authenticate, demoGuard, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    const row = await AppSetting.findOne({
      where: { key: "payment_accounts" },
    });
    let list = [];
    if (row && row.value) {
      try {
        list = JSON.parse(row.value);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
    }
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.put("/payment-accounts", authenticate, demoGuard, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    const accounts = Array.isArray(req.body.accounts) ? req.body.accounts : [];

    // Sanitasi & validasi minimal
    const clean = accounts
      .filter(
        (a) =>
          a &&
          typeof a === "object" &&
          ["bank", "ewallet", "qris"].includes(a.type),
      )
      .map((a) => ({
        type: String(a.type),
        provider: String(a.provider || "")
          .toLowerCase()
          .slice(0, 40),
        account_number: String(a.account_number || "").slice(0, 80),
        account_owner: String(a.account_owner || "").slice(0, 120),
        logo_url: String(a.logo_url || "").slice(0, 500),
        is_active: a.is_active !== false,
      }));

    await AppSetting.upsert({
      key: "payment_accounts",
      value: JSON.stringify(clean),
      type: "json",
    });

    res.json({ success: true, message: "Tersimpan", data: clean });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Message Logs ────────────────────────────────────────────
const MessageLogController = require("../controllers/MessageLogController");
router.get("/message-logs/stats", authenticate, demoGuard, (req, res) =>
  MessageLogController.stats(req, res),
);
router.get("/message-logs/outgoing", authenticate, demoGuard, (req, res) =>
  MessageLogController.outgoing(req, res),
);
router.get("/message-logs/outgoing/:id", authenticate, demoGuard, (req, res) =>
  MessageLogController.getOutgoingDetail(req, res),
);
router.get("/message-logs/incoming", authenticate, demoGuard, (req, res) =>
  MessageLogController.incoming(req, res),
);
router.get("/message-logs/chart", authenticate, demoGuard, (req, res) =>
  MessageLogController.chart(req, res),
);
router.get("/message-logs/breakdown", authenticate, demoGuard, (req, res) =>
  MessageLogController.typeBreakdown(req, res),
);

// ── Broadcast ───────────────────────────────────────────────
const BroadcastController = require("../controllers/BroadcastController");
router.get("/broadcast/stats", authenticate, demoGuard, (req, res) =>
  BroadcastController.stats(req, res),
);
router.get("/broadcast/list", authenticate, demoGuard, (req, res) =>
  BroadcastController.list(req, res),
);
router.post(
  "/broadcast",
  authenticate,
  demoGuard,
  logActivity("create", "broadcast"),
  (req, res) => BroadcastController.create(req, res),
);
router.post("/broadcast/:id/send-now", authenticate, demoGuard, (req, res) =>
  BroadcastController.sendNow(req, res),
);
router.post("/broadcast/:id/cancel", authenticate, demoGuard, (req, res) =>
  BroadcastController.cancel(req, res),
);
router.delete(
  "/broadcast/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  (req, res) => BroadcastController.destroy(req, res),
);
router.get("/broadcast/count-targets", authenticate, demoGuard, (req, res) =>
  BroadcastController.previewCount(req, res),
);

// ── WA Features: Templates, Reminder, Report ────────────────
const {
  templates,
  reminder,
  report,
} = require("../controllers/WaFeaturesController");
router.get("/wa/templates", authenticate, demoGuard, templates.list);
router.post("/wa/templates", authenticate, demoGuard, templates.create);
router.put("/wa/templates/:id", authenticate, demoGuard, templates.update);
router.patch(
  "/wa/templates/:id/toggle",
  authenticate,
  demoGuard,
  templates.toggle,
);
router.delete("/wa/templates/:id", authenticate, demoGuard, templates.destroy);
router.post(
  "/wa/templates/preview",
  authenticate,
  demoGuard,
  templates.preview,
);

// ── Report template save/load ────────────────────────────────
router.get("/wa/report/template", authenticate, demoGuard, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    const row = await AppSetting.findOne({ where: { key: "report_template" } });
    res.json({ success: true, template: row?.value || "" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.post(
  "/wa/report/template",
  authenticate,
  demoGuard,
  async (req, res) => {
    try {
      const { AppSetting } = require("../models");
      const { template } = req.body;
      await AppSetting.upsert({
        key: "report_template",
        value: template,
        type: "text",
      });
      res.json({ success: true, message: "Template disimpan" });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

router.get("/wa/reminders", authenticate, demoGuard, reminder.list);
router.post("/wa/reminders/seed", authenticate, demoGuard, reminder.seed);
router.post("/wa/reminders/save", authenticate, demoGuard, reminder.save);
router.post("/wa/reminders/run-now", authenticate, demoGuard, reminder.runNow);
router.post(
  "/wa/reminders/test-send",
  authenticate,
  demoGuard,
  reminder.testSend,
);

router.get("/wa/report/settings", authenticate, demoGuard, report.getSettings);
router.post(
  "/wa/report/settings",
  authenticate,
  demoGuard,
  report.saveSettings,
);
router.get("/wa/report/preview", authenticate, demoGuard, report.preview);
router.post("/wa/report/send-now", authenticate, demoGuard, report.sendNow);

// Payment page endpoints
const PaymentController = require("../controllers/PaymentController");
router.get("/payments/stats", authenticate, demoGuard, PaymentController.stats);
router.get(
  "/payments/chart",
  authenticate,
  demoGuard,
  PaymentController.chartData,
);
router.get("/payments/list", authenticate, demoGuard, PaymentController.list);
router.get(
  "/payments/check-paid",
  authenticate,
  demoGuard,
  PaymentController.checkPaid,
);
router.post(
  "/payments/record",
  authenticate,
  demoGuard,
  logActivity("create", "payment"),
  PaymentController.record,
);
router.delete(
  "/payments/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("delete", "payment"),
  PaymentController.destroy,
);
router.get(
  "/payments/customers",
  authenticate,
  demoGuard,
  PaymentController.searchCustomers,
);
router.get(
  "/payments/:id/invoice-data",
  authenticate,
  demoGuard,
  PaymentController.invoiceData,
);
router.get(
  "/invoices/:id/invoice-data",
  authenticate,
  demoGuard,
  PaymentController.invoiceDataByInvoiceId,
);
router.post(
  "/payments/:id/send-wa-invoice",
  authenticate,
  demoGuard,
  PaymentController.sendWaInvoice,
);

// ===== DEVICES =====
router.get("/devices", authenticate, demoGuard, DeviceController.index);
router.post(
  "/devices",
  authenticate,
  demoGuard,
  hasPermission("device_create"),
  logActivity("create", "device"),
  DeviceController.create,
);
router.get("/devices/stats", authenticate, demoGuard, DeviceController.stats);
router.get(
  "/devices/monitoring",
  authenticate,
  demoGuard,
  DeviceController.monitoringOverview,
);
router.get(
  "/devices/mikrotik-list",
  authenticate,
  demoGuard,
  DeviceController.mikrotikList,
);
router.post(
  "/devices/test",
  authenticate,
  demoGuard,
  DeviceController.testConnectionByConfig,
);
router.get("/devices/:id", authenticate, demoGuard, DeviceController.show);
router.get(
  "/devices/:id/traffic",
  authenticate,
  demoGuard,
  DeviceController.trafficData,
);
router.get(
  "/devices/:id/interfaces",
  authenticate,
  demoGuard,
  DeviceController.interfaces,
);
router.get(
  "/devices/:id/interface-stats",
  authenticate,
  demoGuard,
  DeviceController.interfaceStats,
);
router.get(
  "/devices/:id/live-data",
  authenticate,
  demoGuard,
  DeviceController.liveData,
);
router.post(
  "/devices/:id/test-connection",
  authenticate,
  demoGuard,
  DeviceController.testConnection,
);
router.post(
  "/devices/:id/set-primary",
  authenticate,
  demoGuard,
  hasPermission("device_update"),
  DeviceController.setPrimary,
);
router.put(
  "/devices/:id",
  authenticate,
  demoGuard,
  hasPermission("device_update"),
  logActivity("update", "device"),
  DeviceController.update,
);
router.delete(
  "/devices/:id",
  authenticate,
  demoGuard,
  hasPermission("device_delete"),
  logActivity("delete", "device"),
  DeviceController.destroy,
);

// ===== INFRASTRUCTURE =====
router.get(
  "/infrastructure",
  authenticate,
  demoGuard,
  InfrastructureController.index,
);
router.post(
  "/infrastructure",
  authenticate,
  demoGuard,
  hasPermission("infra_create"),
  logActivity("create", "infrastructure"),
  InfrastructureController.create,
);
router.get(
  "/infrastructure/map",
  authenticate,
  demoGuard,
  InfrastructureController.mapData,
);
router.get(
  "/infrastructure/stats",
  authenticate,
  demoGuard,
  InfrastructureController.stats,
);
router.get(
  "/infrastructure/customer/:id/rx-power",
  authenticate,
  demoGuard,
  (r, s) => InfrastructureController.getCustomerRxPower(r, s),
);
router.get("/infrastructure/pop/:id/devices", authenticate, demoGuard, (r, s) =>
  InfrastructureController.getPopDevices(r, s),
);
router.get(
  "/infrastructure/:id",
  authenticate,
  demoGuard,
  InfrastructureController.show,
);
router.put(
  "/infrastructure/:id",
  authenticate,
  demoGuard,
  hasPermission("infra_update"),
  logActivity("update", "infrastructure"),
  InfrastructureController.update,
);
router.delete(
  "/infrastructure/:id",
  authenticate,
  demoGuard,
  hasPermission("infra_delete"),
  logActivity("delete", "infrastructure"),
  InfrastructureController.destroy,
);

// ===== INFRASTRUCTURE LINKS =====
router.get("/infrastructure-links", authenticate, demoGuard, (r, s) =>
  InfrastructureLinkController.index(r, s),
);
router.post("/infrastructure-links", authenticate, demoGuard, (r, s) =>
  InfrastructureLinkController.create(r, s),
);
router.put("/infrastructure-links/:id", authenticate, demoGuard, (r, s) =>
  InfrastructureLinkController.update(r, s),
);
router.delete("/infrastructure-links/:id", authenticate, demoGuard, (r, s) =>
  InfrastructureLinkController.destroy(r, s),
);

// ===== CUSTOMER TRAFFIC (MikroTik Queue + PPPoE → Customer mapping) =====
router.get(
  "/mikrotik/customer-traffic",
  authenticate,
  demoGuard,
  async (req, res) => {
    try {
      const {
        getMikrotikInstanceByDevice,
      } = require("../services/MikrotikService");
      const { Customer, Package } = require("../models");
      // Pakai device resolver yang sama dengan halaman /monitoring/queue:
      //   - eksplisit deviceId via ?device_id atau header X-Device-Id
      //   - auto-pick is_primary=true → router pertama aktif → fallback ke .env default
      // Penting agar instance MikroTik (host/credential) selalu sinkron dengan tabel
      // `devices` di DB. Sebelumnya pakai getMikrotikInstance() singleton yang hanya
      // baca env, sehingga setelah restart server kadang nge-target host yang salah
      // padahal halaman queue tetap jalan.
      const resolveDeviceId = () => {
        const v = req.query?.device_id || req.headers?.["x-device-id"];
        if (v == null || v === "") return null;
        const n = parseInt(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const mt = await getMikrotikInstanceByDevice(resolveDeviceId());

      // Fetch semua data sekaligus: queue + PPPoE sessions + ARP table + DHCP leases
      const [queues, sessions, arpRes, dhcpRes] = await Promise.allSettled([
        mt.getQueues(),
        mt.getPPPoESessions(),
        mt.get("/ip/arp"), // ARP table = IP aktif di jaringan saat ini
        mt.get("/ip/dhcp-server/lease"), // DHCP leases = IP yang sedang disewa
      ]);

      // Tracking error per-source untuk diagnosis. Promise.allSettled menelan
      // semua error diam-diam — kalau salah satu fail (mis. getQueues timeout),
      // gejalanya di frontend cuma "withQueue: 0" tanpa indikasi penyebab.
      const fetchErrors = {};
      if (queues.status === "rejected")
        fetchErrors.queues = queues.reason?.message || String(queues.reason);
      if (sessions.status === "rejected")
        fetchErrors.sessions =
          sessions.reason?.message || String(sessions.reason);
      if (arpRes.status === "rejected")
        fetchErrors.arp = arpRes.reason?.message || String(arpRes.reason);
      if (dhcpRes.status === "rejected")
        fetchErrors.dhcp = dhcpRes.reason?.message || String(dhcpRes.reason);
      if (Object.keys(fetchErrors).length) {
        const logger = require("../utils/logger");
        logger.warn(
          `[customer-traffic] partial fetch failure host=${mt.host}: ${JSON.stringify(fetchErrors)}`,
        );
      }

      const queueData = queues.status === "fulfilled" ? queues.value || [] : [];
      const sessionData =
        sessions.status === "fulfilled" ? sessions.value || [] : [];
      const arpData =
        arpRes.status === "fulfilled"
          ? Array.isArray(arpRes.value)
            ? arpRes.value
            : []
          : [];
      const dhcpData =
        dhcpRes.status === "fulfilled"
          ? Array.isArray(dhcpRes.value)
            ? dhcpRes.value
            : []
          : [];

      // Build lookup maps
      //
      // Dynamic queue PPPoE bernama "<pppoe-USERNAME>" atau kadang "pppoe-USERNAME"
      // (tergantung versi RouterOS & format response REST API). Index by:
      //   - target (IP)        → match simple queue manual yang target-nya IP
      //   - name (lowercase)   → match queue manual yang dibuat dgn nama = pppoe username
      //   - pppoe variants     → match dynamic queue dgn nama "<pppoe-XXX>" / "pppoe-XXX"
      const queueByTarget = {},
        queueByName = {},
        queueByPPPoEUser = {};
      queueData.forEach((q) => {
        const targets = (q.target || "")
          .split(",")
          .map((t) => t.trim().split("/")[0]);
        targets.forEach((ip) => {
          if (ip) queueByTarget[ip] = q;
        });
        if (q.name) queueByName[q.name.toLowerCase()] = q;
        // Ekstrak PPPoE username dari nama queue dynamic.
        // Pola:
        //   "<pppoe-USERNAME>"      → versi RouterOS lama, dgn kurung siku
        //   "<pppoe-USERNAME-N>"    → multi-session (Only One = no), N = 1, 2, ...
        //   "pppoe-USERNAME"        → kadang REST v7 tidak include kurung siku
        // Strip kurung siku dulu, baru match pola pppoe-XXX[-N].
        const nameLower = (q.name || "").toLowerCase();
        const stripped = nameLower.replace(/^</, "").replace(/>$/, "");
        const m = stripped.match(/^pppoe-(.+?)(?:-\d+)?$/);
        if (m && m[1]) queueByPPPoEUser[m[1]] = q;
      });

      const sessionByName = {},
        sessionByIP = {};
      sessionData.forEach((s) => {
        if (s.name) sessionByName[s.name.toLowerCase()] = s;
        if (s.address) sessionByIP[s.address] = s;
      });

      // ARP: IP yang ada di ARP table = device aktif di jaringan
      // Filter: hanya yang dynamic/reachable (bukan failed/incomplete)
      const arpByIP = {};
      arpData.forEach((a) => {
        const ip = a.address || a["address"];
        const st = (a.status || "").toLowerCase();
        if (ip && st !== "failed" && st !== "incomplete") {
          arpByIP[ip] = {
            mac: a["mac-address"] || "",
            interface: a.interface || "",
            status: st,
          };
        }
      });

      // DHCP leases: aktif = status bound
      const dhcpByIP = {},
        dhcpByMac = {};
      dhcpData.forEach((d) => {
        const ip = d.address || d["address"];
        const mac = d["mac-address"] || "";
        const st = (d.status || "").toLowerCase();
        if (ip)
          dhcpByIP[ip] = {
            hostname: d.hostname || "",
            status: st,
            active: st === "bound",
          };
        if (mac) dhcpByMac[mac] = { ip, status: st, active: st === "bound" };
      });

      // Include semua customer kecuali yang dihapus/berhenti permanen.
      // Customer 'isolated' tetap relevan — mereka punya queue khusus (rate-limit
      // turun) untuk traffic monitoring saat masa isolir. Customer 'suspended'
      // juga bisa punya sesi/queue aktif. Hanya 'inactive' yang biasanya tidak
      // perlu (tapi kita tetap include — biaya filter rendah, dan kalau ada
      // anomaly traffic justru perlu kelihatan).
      const { Op } = require("sequelize");
      const customers = await Customer.findAll({
        attributes: [
          "id",
          "customer_id",
          "name",
          "static_ip",
          "pppoe_username",
          "status",
          "latitude",
          "longitude",
        ],
        include: [
          {
            model: Package,
            as: "package",
            attributes: ["name", "price"],
            required: false,
          },
        ],
        where: {
          status: { [Op.in]: ["active", "isolated", "suspended", "inactive"] },
        },
      });

      const parseK = (v) => {
        v = v || "0";
        if (v.endsWith("M")) return parseFloat(v) * 1000000;
        if (v.endsWith("k") || v.endsWith("K")) return parseFloat(v) * 1000;
        return parseFloat(v) || 0;
      };

      const result = customers.map((cust) => {
        const ip = cust.static_ip || null;
        const pppoe = cust.pppoe_username || null;
        const pppoeLc = pppoe ? pppoe.toLowerCase() : null;

        // Cari sesi PPPoE aktif dulu — IP-nya dipakai sebagai fallback target lookup.
        const session =
          (pppoeLc && sessionByName[pppoeLc]) ||
          (ip && sessionByIP[ip]) ||
          null;
        const sessionIP = session?.address || null;

        // Queue lookup, prioritas dari yang paling spesifik:
        //   1. Simple queue manual dgn target = static IP customer
        //   2. Simple queue manual dgn target = IP yg di-assign sesi PPPoE aktif
        //   3. Dynamic queue PPPoE dgn nama "<pppoe-USERNAME>" / "pppoe-USERNAME"
        //   4. Simple queue manual yang namanya persis = pppoe username
        //   5. Simple queue dgn comment yang mengandung pppoe username
        const queue =
          (ip && queueByTarget[ip]) ||
          (sessionIP && queueByTarget[sessionIP]) ||
          (pppoeLc && queueByPPPoEUser[pppoeLc]) ||
          (pppoeLc && queueByName[pppoeLc]) ||
          (pppoeLc &&
            queueData.find(
              (q) => q.comment && q.comment.toLowerCase().includes(pppoeLc),
            )) ||
          null;

        const qRateIn = queue ? parseInt(queue.rateIn || 0) : 0;
        const qRateOut = queue ? parseInt(queue.rateOut || 0) : 0;

        // Multi-signal online detection (most reliable first):
        // 1. PPPoE active session (strongest signal — confirmed connected)
        const byPPPoE = !!session;
        // 2. ARP table entry exists (device responded to ARP recently)
        const byARP = ip ? !!arpByIP[ip] : false;
        // 3. DHCP lease is bound
        const byDHCP = ip ? !!dhcpByIP[ip]?.active : false;
        // 4. Queue has non-zero traffic (was active recently)
        const byQueue = qRateIn + qRateOut > 0;

        const isOnline = byPPPoE || byARP || byDHCP || byQueue;
        const onlineSource = byPPPoE
          ? "pppoe"
          : byARP
            ? "arp"
            : byDHCP
              ? "dhcp"
              : byQueue
                ? "queue"
                : null;

        let maxDown = 0,
          maxUp = 0;
        if (queue?.maxLimit) {
          const parts = queue.maxLimit.split("/");
          maxUp = parseK(parts[0]);
          maxDown = parseK(parts[1] || parts[0]);
        }

        return {
          id: cust.id,
          customer_id: cust.customer_id,
          name: cust.name,
          ip,
          pppoe,
          latitude: cust.latitude,
          longitude: cust.longitude,
          package: cust.package?.name || null,
          online: isOnline,
          onlineSource: onlineSource,
          uptime: session?.uptime || null,
          rateDown: qRateIn,
          rateUp: qRateOut,
          maxDown,
          maxUp,
          utilDown:
            maxDown > 0
              ? Math.min(100, Math.round((qRateIn / maxDown) * 100))
              : 0,
          utilUp:
            maxUp > 0 ? Math.min(100, Math.round((qRateOut / maxUp) * 100)) : 0,
          bytesDown: queue ? parseInt(queue.bytesIn || 0) : 0,
          bytesUp: queue ? parseInt(queue.bytesOut || 0) : 0,
          queueName: queue?.name || null,
          queueId: queue?.id || null,
          disabled: queue?.disabled || false,
        };
      });

      res.json({
        success: true,
        data: result,
        meta: {
          total: result.length,
          online: result.filter((r) => r.online).length,
          withQueue: result.filter((r) => r.queueName).length,
          pppoeActive: sessionData.length,
          timestamp: new Date(),
          // Surfacing fetch errors agar frontend & user langsung tahu kalau
          // salah satu source (queue/session/arp/dhcp) gagal. Object kosong
          // = semua sukses.
          fetchErrors: Object.keys(fetchErrors).length
            ? fetchErrors
            : undefined,
          queueCount: queueData.length,
        },
        // Debug info: kirim ringkasan queue/session jika ?debug=1, untuk
        // membantu diagnosis kalau ada customer yang seharusnya online tapi
        // tidak match. Tidak expose data sensitif (password dsb).
        ...(req.query.debug === "1"
          ? {
              debug: {
                mtHost: mt.host,
                mtPort: mt.port,
                queueCount: queueData.length,
                dynamicQueueCount: queueData.filter((q) => q.dynamic).length,
                pppoeQueueSamples: queueData
                  .filter((q) => /pppoe-/i.test(q.name || ""))
                  .slice(0, 5)
                  .map((q) => ({
                    name: q.name,
                    target: q.target,
                    dynamic: q.dynamic,
                    rateIn: q.rateIn,
                    rateOut: q.rateOut,
                  })),
                sessionSamples: sessionData.slice(0, 5).map((s) => ({
                  name: s.name,
                  address: s.address,
                  interface: s.interface,
                })),
                pppoeUserKeys: Object.keys(queueByPPPoEUser).slice(0, 20),
                customersWithPPPoE: customers
                  .filter((c) => c.pppoe_username)
                  .slice(0, 10)
                  .map((c) => ({
                    id: c.id,
                    name: c.name,
                    pppoe: c.pppoe_username,
                    matchedQueue:
                      queueByPPPoEUser[c.pppoe_username.toLowerCase()]?.name ||
                      null,
                  })),
              },
            }
          : {}),
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },
);

// ===== ONT / GenieACS =====
router.get("/ont", authenticate, demoGuard, OntController.index);
router.get("/ont/stats", authenticate, demoGuard, OntController.stats);
router.get("/ont/:id", authenticate, demoGuard, OntController.show);
router.post(
  "/ont/sync",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("sync", "ont"),
  OntController.syncFromGenieACS,
);
router.post(
  "/ont/:id/reboot",
  authenticate,
  demoGuard,
  hasPermission("ont_reboot"),
  logActivity("reboot", "ont"),
  OntController.reboot,
);
router.get(
  "/ont/:id/parameters",
  authenticate,
  demoGuard,
  OntController.getParameters,
);

// ===== NOTIFICATIONS =====
router.get(
  "/notifications",
  authenticate,
  demoGuard,
  NotificationController.index,
);
router.get(
  "/notifications/unread-count",
  authenticate,
  demoGuard,
  NotificationController.unreadCount,
);
router.put(
  "/notifications/:id/read",
  authenticate,
  demoGuard,
  NotificationController.markRead,
);
router.put(
  "/notifications/read-all",
  authenticate,
  demoGuard,
  NotificationController.markAllRead,
);

// ===== ACTIVITY LOGS =====
router.get(
  "/activity-logs",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  ActivityLogController.index,
);

// ===== MIKROTIK (NEW) =====
const mikrotikRoutes = require("./mikrotik");
router.use("/mikrotik", authenticate, demoGuard, mikrotikRoutes);

// ===== WA GATEWAY =====
const waRoutes = require("./wa");
router.use("/wa", authenticate, demoGuard, waRoutes);

// ===== KEUANGAN =====
const KeuanganController = require("../controllers/KeuanganController");
router.get("/keuangan/summary", authenticate, demoGuard, (r, s) =>
  KeuanganController.summary(r, s),
);
router.post("/keuangan/sync-payments", authenticate, demoGuard, (r, s) =>
  KeuanganController.syncPayments(r, s),
);
router.get("/keuangan/categories", authenticate, demoGuard, (r, s) =>
  KeuanganController.categories(r, s),
);
router.get("/keuangan/:id", authenticate, demoGuard, (r, s) =>
  KeuanganController.show
    ? KeuanganController.show(r, s)
    : s.json({ success: false, message: "Not implemented" }),
);
router.get("/keuangan", authenticate, demoGuard, (r, s) =>
  KeuanganController.index(r, s),
);
router.post("/keuangan", authenticate, demoGuard, (r, s) =>
  KeuanganController.store(r, s),
);
router.put("/keuangan/:id/lunas", authenticate, demoGuard, (r, s) =>
  KeuanganController.markLunas(r, s),
);
router.put("/keuangan/:id", authenticate, demoGuard, (r, s) =>
  KeuanganController.update(r, s),
);
router.delete("/keuangan/:id", authenticate, demoGuard, (r, s) =>
  KeuanganController.destroy(r, s),
);

// ===== LAPORAN KEUANGAN =====
const LaporanController = require("../controllers/LaporanController");
router.get(
  "/laporan/summary",
  authenticate,
  demoGuard,
  LaporanController.summary,
);

// ===== PING MONITOR =====
const PingMonitorController = require("../controllers/PingMonitorController");
router.get(
  "/ping-monitor/customers",
  authenticate,
  demoGuard,
  PingMonitorController.getCustomers,
);
router.get(
  "/ping-monitor/all-customers",
  authenticate,
  demoGuard,
  PingMonitorController.getAllCustomers,
);
router.post(
  "/ping-monitor/ping-batch",
  authenticate,
  demoGuard,
  PingMonitorController.pingBatch,
);
router.post(
  "/ping-monitor/ping-single",
  authenticate,
  demoGuard,
  PingMonitorController.pingSingle,
);
router.get(
  "/ping-monitor/summary",
  authenticate,
  demoGuard,
  PingMonitorController.summary,
);
router.post(
  "/ping-monitor/sync-from-mikrotik",
  authenticate,
  demoGuard,
  PingMonitorController.syncFromMikrotik,
);
router.post(
  "/ping-monitor/set-ip",
  authenticate,
  demoGuard,
  PingMonitorController.setCustomerIP,
);

// ===== OLT MANAGEMENT =====
const OltController = require("../controllers/OltController");
router.get(
  "/olt",
  authenticate,
  demoGuard,
  OltController.index.bind(OltController),
);
router.post(
  "/olt",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  OltController.create.bind(OltController),
);
router.put(
  "/olt/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  OltController.update.bind(OltController),
);
router.delete(
  "/olt/:id",
  authenticate,
  demoGuard,
  authorize("superadmin"),
  OltController.destroy.bind(OltController),
);
router.post(
  "/olt/sync-all",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  OltController.syncAll.bind(OltController),
);
router.post(
  "/olt/:id/test",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  OltController.test.bind(OltController),
);
router.post(
  "/olt/:id/sync",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  OltController.sync.bind(OltController),
);

// ===== TICKETS =====
try {
  const ticketRoutes = require("./tickets");
  router.use("/tickets", authenticate, demoGuard, ticketRoutes);
  console.log("[api.js] ✓ Ticket routes loaded");
} catch (e) {
  console.error("[api.js] ✗ Ticket routes FAILED:", e.message);
  router.use("/tickets", (req, res) =>
    res.status(503).json({
      success: false,
      message: "Ticket module not available: " + e.message,
    }),
  );
}

// ===== DEVICE MONITOR =====
const deviceMonitorRoutes = require("./deviceMonitor");
router.use("/device-monitor", authenticate, demoGuard, deviceMonitorRoutes);

// ===== GENIEACS ONT MANAGEMENT =====
const genieacsRoutes = require("./genieacs");
router.use("/genieacs", authenticate, demoGuard, genieacsRoutes);

// ===== ASSET MANAGEMENT =====
const AssetController = require("../controllers/AssetController");
// Categories
router.get("/assets/categories", authenticate, demoGuard, (r, s) =>
  AssetController.getCategories(r, s),
);
router.post(
  "/assets/categories",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  (r, s) => AssetController.createCategory(r, s),
);
router.put(
  "/assets/categories/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  (r, s) => AssetController.updateCategory(r, s),
);
router.delete(
  "/assets/categories/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  (r, s) => AssetController.destroyCategory(r, s),
);
// Assets
router.get("/assets/stats", authenticate, demoGuard, (r, s) =>
  AssetController.stats(r, s),
);
router.get("/assets", authenticate, demoGuard, (r, s) =>
  AssetController.index(r, s),
);
router.post(
  "/assets",
  authenticate,
  demoGuard,
  logActivity("create", "asset"),
  (r, s) => AssetController.create(r, s),
);
router.get("/assets/:id", authenticate, demoGuard, (r, s) =>
  AssetController.show(r, s),
);
router.put(
  "/assets/:id",
  authenticate,
  demoGuard,
  logActivity("update", "asset"),
  (r, s) => AssetController.update(r, s),
);
router.delete(
  "/assets/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("delete", "asset"),
  (r, s) => AssetController.destroy(r, s),
);
router.post("/assets/:id/photo", authenticate, demoGuard, (r, s) =>
  AssetController.uploadPhoto(r, s),
);
router.get("/assets/:id/history", authenticate, demoGuard, (r, s) =>
  AssetController.history(r, s),
);
router.post(
  "/assets/:id/assign",
  authenticate,
  demoGuard,
  logActivity("assign", "asset"),
  (r, s) => AssetController.assign(r, s),
);
router.post(
  "/assets/:id/unassign",
  authenticate,
  demoGuard,
  logActivity("unassign", "asset"),
  (r, s) => AssetController.unassign(r, s),
);

// ===== SYSTEM RESOURCES =====
router.get(
  "/resources/router",
  authenticate,
  demoGuard,
  ResourceController.getRouterResources,
);
router.get(
  "/resources/server",
  authenticate,
  demoGuard,
  ResourceController.getServerResources,
);
router.get(
  "/resources/all",
  authenticate,
  demoGuard,
  ResourceController.getAllResources,
);

// ===== TOPOLOGY =====
router.get(
  "/topology/devices",
  authenticate,
  demoGuard,
  TopologyController.getDevices,
);
router.post(
  "/topology/devices",
  authenticate,
  demoGuard,
  TopologyController.addDevice,
);
router.put(
  "/topology/devices/:id",
  authenticate,
  demoGuard,
  TopologyController.updateDevice,
);
router.put(
  "/topology/devices/:id/position",
  authenticate,
  demoGuard,
  TopologyController.updatePosition,
);
router.delete(
  "/topology/devices/:id",
  authenticate,
  demoGuard,
  TopologyController.deleteDevice,
);
router.get(
  "/topology/connections",
  authenticate,
  demoGuard,
  TopologyController.getConnections,
);
router.post(
  "/topology/connections",
  authenticate,
  demoGuard,
  TopologyController.addConnection,
);
router.delete(
  "/topology/connections/:id",
  authenticate,
  demoGuard,
  TopologyController.deleteConnection,
);
router.post(
  "/topology/devices/:id/refresh",
  authenticate,
  demoGuard,
  TopologyController.refreshDevice,
);
router.post(
  "/topology/refresh-all",
  authenticate,
  demoGuard,
  TopologyController.refreshAllDevices,
);

// ===== TODO =====
const TodoController = require("../controllers/TodoController");
router.get("/todos/stats", authenticate, demoGuard, (r, s) =>
  TodoController.stats(r, s),
);
router.get("/todos", authenticate, demoGuard, (r, s) =>
  TodoController.index(r, s),
);
router.post("/todos", authenticate, demoGuard, (r, s) =>
  TodoController.create(r, s),
);
router.get("/todos/:id", authenticate, demoGuard, (r, s) =>
  TodoController.show(r, s),
);
router.put("/todos/:id", authenticate, demoGuard, (r, s) =>
  TodoController.update(r, s),
);
router.patch("/todos/:id/status", authenticate, demoGuard, (r, s) =>
  TodoController.updateStatus(r, s),
);
router.delete("/todos/:id", authenticate, demoGuard, (r, s) =>
  TodoController.destroy(r, s),
);

// ===== WORK ORDERS =====
const WOCtrl = require("../controllers/WorkOrderController");
router.get("/work-orders/stats", authenticate, demoGuard, WOCtrl.stats);
router.get("/work-orders", authenticate, demoGuard, WOCtrl.index);
router.post("/work-orders", authenticate, demoGuard, WOCtrl.create);
router.get("/work-orders/:id", authenticate, demoGuard, WOCtrl.show);
router.put("/work-orders/:id", authenticate, demoGuard, WOCtrl.update);
router.post(
  "/work-orders/:id/photos",
  authenticate,
  demoGuard,
  WOCtrl.uploadMiddleware,
  WOCtrl.uploadPhotos,
);
router.delete(
  "/work-orders/:id/photos/:photoIndex",
  authenticate,
  demoGuard,
  WOCtrl.deletePhoto,
);
router.delete("/work-orders/:id", authenticate, demoGuard, WOCtrl.destroy);

// ===== ANNOUNCEMENTS (Pengumuman Portal) =====
const AnnCtrl = require("../controllers/AnnouncementController");
router.get("/announcements", authenticate, demoGuard, AnnCtrl.list);
router.post("/announcements", authenticate, demoGuard, AnnCtrl.create);
router.put("/announcements/:id", authenticate, demoGuard, AnnCtrl.update);
router.patch(
  "/announcements/:id/toggle",
  authenticate,
  demoGuard,
  AnnCtrl.toggle,
);
router.delete("/announcements/:id", authenticate, demoGuard, AnnCtrl.destroy);

// ===== PUSH NOTIFICATION (Admin → Customer Portal) =====
const PushNotifCtrl = require("../controllers/PushNotificationController");
router.get("/push-notif/stats", authenticate, demoGuard, PushNotifCtrl.stats);
router.post(
  "/push-notif/preview-targets",
  authenticate,
  demoGuard,
  PushNotifCtrl.previewTargets,
);
router.get(
  "/push-notif/customers",
  authenticate,
  demoGuard,
  PushNotifCtrl.customerList,
);
router.get("/push-notif/list", authenticate, demoGuard, PushNotifCtrl.list);
router.post(
  "/push-notif/send",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  logActivity("create", "push_notif"),
  PushNotifCtrl.send,
);
router.post(
  "/push-notif/:id/retry",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.retry,
);
router.post(
  "/push-notif/:id/cancel",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.cancel,
);
router.delete(
  "/push-notif/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.destroy,
);
// Templates
router.get(
  "/push-notif/templates",
  authenticate,
  demoGuard,
  PushNotifCtrl.listTemplates,
);
router.post(
  "/push-notif/templates",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.createTemplate,
);
router.put(
  "/push-notif/templates/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.updateTemplate,
);
router.delete(
  "/push-notif/templates/:id",
  authenticate,
  demoGuard,
  authorize("superadmin", "admin"),
  PushNotifCtrl.deleteTemplate,
);

router.post("/qontak/send-invoice", async (req, res) => {
  try {
    const { customer_id } = req.body;

    const customer = await Customer.findByPk(customer_id, {
      include: [
        {
          model: Package,
          as: "package",
        },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer tidak ditemukan",
      });
    }

    let phone = customer.phone.replace(/\D/g, "");

    if (phone.startsWith("0")) {
      phone = "62" + phone.slice(1);
    }

    const packagePrice = Number(customer.package?.price || 0).toLocaleString(
      "id-ID",
    );

    const dueDate = customer.due_date
      ? new Date(customer.due_date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

    const payload = {
      to_name: customer.name,

      to_number: phone,

      channel_integration_id: process.env.QONTAK_CHANNEL_ID,

      message_template_id: process.env.QONTAK_TEMPLATE_ID,

      language: {
        code: "id",
      },

      parameters: {
        body: [
          {
            key: "1",
            value_text: customer.name,
          },
          {
            key: "2",
            value_text: dueDate,
          },
          {
            key: "3",
            value_text: customer.package?.name || "-",
          },
          {
            key: "4",
            value_text: packagePrice,
          },
        ],
      },
    };

    console.log("PAYLOAD:");
    console.log(JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://service-chat.qontak.com/api/open/v1/broadcasts/whatsapp/direct",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.QONTAK_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("QONTAK SUCCESS:");
    console.log(response.data);

    return res.json({
      success: true,
      message: "Invoice berhasil dikirim",
      data: response.data,
    });
  } catch (err) {
    console.log("========== ERROR ==========");
    console.log(JSON.stringify(err?.response?.data, null, 2));

    return res.status(500).json({
      success: false,
      message: "Gagal kirim invoice",
      error: err?.response?.data || err.message,
    });
  }
});

// ===== GPS TRACKING =====
const trackingRoutes = require("./tracking");
router.use("/tracking", authenticate, demoGuard, trackingRoutes);

module.exports = router;
