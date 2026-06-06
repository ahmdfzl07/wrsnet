const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  allowFinanceArea,
  blockFinanceArea,
  isFinanceRole,
} = require("../middleware/financeAccess");
const {
  allowNocArea,
  blockNocArea,
  isNocRole,
} = require("../middleware/nocAccess");

// Login page
router.get("/login", (req, res) => {
  res.render("pages/login", { title: "Login", layout: false });
});

// Root redirect — role-aware
router.get("/", authenticate, (req, res) => {
  const roleName = (req.user?.role?.name || "").toLowerCase();
  if (roleName === "technician") return res.redirect("/technician");
  if (roleName === "finance") return res.redirect("/finance");
  if (roleName === "noc") return res.redirect("/noc");
  return res.redirect("/dashboard");
});

// Dashboard utama — admin-only (role finance/noc di-redirect ke dashboard masing-masing)
router.get(
  "/dashboard",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) => {
    res.render("pages/dashboard", {
      title: "Dashboard",
      user: req.user,
      active: "dashboard",
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// NOC DASHBOARD — halaman utama role NOC
// Monitoring jaringan: traffic, PPPoE, OLT/ONT, devices, infrastructure.
// ═══════════════════════════════════════════════════════════════════
router.get("/noc", authenticate, allowNocArea, (req, res) => {
  res.render("pages/noc-dashboard", {
    title: "NOC Dashboard",
    user: req.user,
    active: "noc-dashboard",
  });
});
router.get("/noc/dashboard", authenticate, allowNocArea, (req, res) =>
  res.redirect("/noc"),
);

// ═══════════════════════════════════════════════════════════════════
// FINANCE DASHBOARD — halaman utama role finance
// ═══════════════════════════════════════════════════════════════════
router.get("/finance", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/finance-dashboard", {
    title: "Finance Dashboard",
    user: req.user,
    active: "finance-dashboard",
  });
});
router.get("/finance/dashboard", authenticate, allowFinanceArea, (req, res) =>
  res.redirect("/finance"),
);

// ─── MONITORING ─────────────────────────────────────────────
router.get(
  "/monitoring/traffic",
  authenticate,
  blockFinanceArea,
  (req, res) => {
    res.render("pages/traffic", {
      title: "Traffic Interface",
      user: req.user,
      active: "traffic",
    });
  },
);

router.get("/monitoring/pppoe", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/pppoe", {
    title: "PPPoE Sessions",
    user: req.user,
    active: "pppoe",
  });
});

router.get("/monitoring/queue", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/queue", {
    title: "Simple Queue",
    user: req.user,
    active: "queue",
  });
});

router.get("/monitoring/ippool", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/ippool", {
    title: "IP Pool Usage",
    user: req.user,
    active: "ippool",
  });
});

router.get(
  "/monitoring/firewall",
  authenticate,
  blockFinanceArea,
  (req, res) => {
    res.render("pages/firewall", {
      title: "Firewall Rules",
      user: req.user,
      active: "firewall",
    });
  },
);

router.get("/monitoring/olt", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/olt", {
    title: "OLT Management",
    user: req.user,
    active: "olt",
  });
});

router.get("/monitoring/ping", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/ping-monitor", {
    title: "Ping Monitor",
    user: req.user,
    active: "ping-monitor",
  });
});

router.get(
  "/monitoring/hotspot",
  authenticate,
  blockFinanceArea,
  (req, res) => {
    res.render("pages/hotspot", {
      title: "Hotspot Management",
      user: req.user,
      active: "hotspot",
    });
  },
);

// ─── ONT MANAGEMENT (GenieACS) - NEW ────────────────────────
router.get("/genieacs", authenticate, blockFinanceArea, async (req, res) => {
  try {
    const { AppSetting } = require("../models");
    const row = await AppSetting.findOne({
      where: { key: "genieacs_nbi_url" },
    });
    const genieacsUrl = row?.value || process.env.GENIEACS_NBI_URL || "";
    res.render("pages/genieacs", {
      title: "ONT Management",
      user: req.user,
      active: "genieacs",
      genieacsUrl,
    });
  } catch (e) {
    res.render("pages/genieacs", {
      title: "ONT Management",
      user: req.user,
      active: "genieacs",
      genieacsUrl: process.env.GENIEACS_NBI_URL || "",
    });
  }
});

router.get("/work-orders", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/work-orders", {
    title: "Work Order",
    user: req.user,
    active: "work-orders",
  });
});

router.get("/todos", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/todos", {
    title: "To Do List",
    user: req.user,
    active: "todos",
  });
});

router.get("/packages", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/packages", {
    title: "Paket Layanan",
    user: req.user,
    active: "packages",
  });
});

// ─── MANAGEMENT ─────────────────────────────────────────────
router.get("/customers", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/customers", {
    title: "Customers",
    user: req.user,
    active: "customers",
  });
});

router.get(
  "/customers/profile/:id",
  authenticate,
  allowFinanceArea,
  (req, res) => {
    res.render("pages/customer_profile", {
      title: "Profil Pelanggan",
      user: req.user,
      active: "customers",
      custId: req.params.id,
    });
  },
);

router.get(
  "/whatsapp",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) => {
    res.render("pages/whatsapp", {
      title: "WA Gateway",
      user: req.user,
      active: "whatsapp",
    });
  },
);

router.get("/billing", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/billing", {
    title: "Billing",
    user: req.user,
    active: "billing",
  });
});

router.get("/payments", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/payments", {
    title: "Pembayaran",
    user: req.user,
    active: "payments",
  });
});

router.get(
  "/message-logs",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) =>
    res.render("pages/message-logs", {
      title: "Message Logs",
      user: req.user,
      active: "message-logs",
    }),
);

router.get(
  "/broadcast",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) =>
    res.render("pages/broadcast", {
      title: "Broadcast",
      user: req.user,
      active: "broadcast",
    }),
);

router.get(
  "/wa/templates",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) =>
    res.render("pages/wa-templates", {
      title: "Template Pesan",
      user: req.user,
      active: "wa-templates",
    }),
);
router.get(
  "/wa/reminder",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) =>
    res.render("pages/wa-reminder", {
      title: "Automation Reminder",
      user: req.user,
      active: "wa-reminder",
    }),
);
router.get(
  "/wa/report",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) =>
    res.render("pages/wa-report", {
      title: "Automation Report",
      user: req.user,
      active: "wa-report",
    }),
);

// Helper: load invoice template settings (dengan fallback ke global app_settings)
async function loadInvoiceTpl() {
  const { AppSetting } = require("../models");
  const { Op } = require("sequelize");
  const rows = await AppSetting.findAll({
    where: { key: { [Op.like]: "invtpl_%" } },
  });
  const tpl = {};
  rows.forEach((r) => {
    tpl[r.key.replace("invtpl_", "")] = r.value;
  });

  // Fallback ke setting global Brand kalau template-specific belum di-set
  if (!tpl.logo_url) {
    const globalLogo = await AppSetting.findOne({ where: { key: "logo_url" } });
    if (globalLogo && globalLogo.value) tpl.logo_url = globalLogo.value;
  }
  if (!tpl.company_name) {
    const cn =
      (await AppSetting.findOne({ where: { key: "company_name" } })) ||
      (await AppSetting.findOne({ where: { key: "app_name" } }));
    if (cn && cn.value) tpl.company_name = cn.value;
  }
  if (!tpl.company_phone) {
    const cp = await AppSetting.findOne({ where: { key: "company_whatsapp" } });
    if (cp && cp.value) tpl.company_phone = cp.value;
  }
  return tpl;
}

router.get(
  "/invoice/inv/:invoiceId",
  authenticate,
  allowFinanceArea,
  async (req, res) => {
    const tpl = await loadInvoiceTpl();
    res.render("pages/invoice", {
      title: "Invoice",
      user: req.user,
      active: "billing",
      tpl,
    });
  },
);
router.get(
  "/invoice/:paymentId",
  authenticate,
  allowFinanceArea,
  async (req, res) => {
    const tpl = await loadInvoiceTpl();
    res.render("pages/invoice", {
      title: "Invoice",
      user: req.user,
      active: "payments",
      tpl,
    });
  },
);

// Invoice Template Designer — customize tampilan invoice (warna, font, label, show/hide)
router.get(
  "/invoice-template",
  authenticate,
  allowFinanceArea,
  async (req, res) => {
    const { AppSetting } = require("../models");
    const { Op } = require("sequelize");
    const rows = await AppSetting.findAll({
      where: { key: { [Op.like]: "invtpl_%" } },
    });
    const tplSettings = {};
    rows.forEach((r) => {
      tplSettings[r.key] = r.value;
    });
    // Load global settings utk fallback (logo, company info dari Brand)
    const allRows = await AppSetting.findAll();
    const appSettings = {};
    allRows.forEach((r) => {
      appSettings[r.key] = r.value;
    });
    res.render("pages/invoice-template", {
      title: "Template Invoice",
      user: req.user,
      active: "invoice-template",
      tplSettings,
      appSettings,
    });
  },
);

// Preview Print — render invoice.ejs dengan flag preview mode + tpl settings
// Frontend invoice.ejs detect path ini lalu pakai data dummy (skip API fetch)
router.get(
  "/invoice-template/preview-print",
  authenticate,
  allowFinanceArea,
  async (req, res) => {
    const tpl = await loadInvoiceTpl();
    res.render("pages/invoice", {
      title: "Preview Template Invoice",
      user: req.user,
      active: "invoice-template",
      tpl,
    });
  },
);

// Voucher Template Designer — customize tampilan voucher print (warna, brand, label)
router.get(
  "/voucher-template",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  async (req, res) => {
    const { AppSetting } = require("../models");
    const { Op } = require("sequelize");
    const rows = await AppSetting.findAll({
      where: { key: { [Op.like]: "vtpl_%" } },
    });
    const tplSettings = {};
    rows.forEach((r) => {
      tplSettings[r.key] = r.value;
    });
    res.render("pages/voucher-template", {
      title: "Template Voucher",
      user: req.user,
      active: "voucher-template",
      tplSettings,
    });
  },
);

// Voucher Preview Print — buka window print sample voucher dengan template tersimpan
router.get(
  "/voucher-template/preview-print",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  async (req, res) => {
    const { AppSetting } = require("../models");
    const { Op } = require("sequelize");
    const rows = await AppSetting.findAll({
      where: { key: { [Op.like]: "vtpl_%" } },
    });
    const tpl = {};
    rows.forEach((r) => {
      tpl[r.key.replace("vtpl_", "")] = r.value;
    });
    res.render("pages/voucher-preview-print", {
      title: "Preview Print Voucher",
      user: req.user,
      active: "voucher-template",
      tpl,
    });
  },
);

// ── Tickets ─────────────────────────────────────────────────
router.get("/tickets", authenticate, blockFinanceArea, (req, res) =>
  res.render("pages/tickets", {
    title: "Tickets",
    user: req.user,
    active: "tickets",
  }),
);
router.get("/tickets/:id", authenticate, blockFinanceArea, (req, res) =>
  res.render("pages/ticket-detail", {
    title: "Detail Ticket",
    user: req.user,
    active: "tickets",
    ticketId: req.params.id,
  }),
);

router.get(
  "/monitoring/device-monitor",
  authenticate,
  blockFinanceArea,
  (req, res) => {
    res.render("pages/device-monitor", {
      title: "Device Monitor",
      user: req.user,
      active: "device-monitor",
    });
  },
);

router.get("/devices", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/devices", {
    title: "Devices",
    user: req.user,
    active: "devices",
  });
});

router.get("/devices/:id", authenticate, blockFinanceArea, (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) return res.redirect("/devices");
  res.render("pages/device-detail", {
    title: "Device Detail",
    user: req.user,
    active: "devices",
    deviceId: id,
  });
});

router.get("/assets", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/assets", {
    title: "Asset Management",
    user: req.user,
    active: "assets",
  });
});

router.get("/infrastructure", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/infrastructure", {
    title: "Infrastructure Map",
    user: req.user,
    active: "infrastructure",
  });
});

// ─── SYSTEM ──────────────────────────────────────────────────
router.get("/system/resources", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/resources", {
    title: "System Resource",
    user: req.user,
    active: "resources",
  });
});

router.get("/system/topology", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/topology", {
    title: "Topology",
    user: req.user,
    active: "topology",
  });
});

router.get(
  "/settings_old",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) => {
    res.render("pages/settings", {
      title: "Settings",
      user: req.user,
      active: "settings",
    });
  },
);

router.get(
  "/settings/users",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  (req, res) => {
    res.render("pages/users", {
      title: "User Management",
      user: req.user,
      active: "users",
    });
  },
);

router.get("/logs", authenticate, blockFinanceArea, (req, res) => {
  res.render("pages/logs", {
    title: "Activity Logs",
    user: req.user,
    active: "logs",
  });
});

router.get("/keuangan", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/keuangan", {
    title: "Keuangan",
    user: req.user,
    active: "keuangan",
  });
});

router.get("/laporan/print", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/laporan-print", {
    title: "Cetak Laporan",
    user: req.user,
    active: "laporan",
  });
});

router.get("/laporan", authenticate, allowFinanceArea, (req, res) => {
  res.render("pages/laporan", {
    title: "Laporan Keuangan",
    user: req.user,
    active: "laporan",
  });
});

router.get("/isolir", authenticate, blockFinanceArea, (req, res) =>
  res.render("pages/isolir", {
    title: "Isolir Management",
    user: req.user,
    active: "isolir",
  }),
);

router.get(
  "/settings",
  authenticate,
  blockFinanceArea,
  blockNocArea,
  async (req, res) => {
    try {
      const { AppSetting } = require("../models");
      // Ambil SEMUA setting — biar semua field di page settings (brand, umum, payment, dll) ter-populate
      const rows = await AppSetting.findAll();
      const appSettings = {};
      rows.forEach((r) => {
        appSettings[r.key] = r.value;
      });
      res.render("pages/settings", {
        title: "Settings",
        user: req.user,
        active: "settings",
        appSettings,
      });
    } catch (e) {
      res.render("pages/settings", {
        title: "Settings",
        user: req.user,
        active: "settings",
        appSettings: {},
      });
    }
  },
);

// ── GPS Tracking ─────────────────────────────────────────────
router.get("/gps-tracking", authenticate, blockFinanceArea, (req, res) =>
  res.render("pages/gps-tracking", {
    title: "GPS Tracking",
    user: req.user,
    active: "gps-tracking",
  }),
);

router.get("/technician-tracking", authenticate, blockFinanceArea, (req, res) =>
  res.render("pages/technician-tracking", {
    title: "Field Tracking",
    user: req.user,
    active: "technician-tracking",
    layout: false,
  }),
);

// ── Portal Teknisi ──────────────────────────────────────────
// Dashboard utama untuk tim teknisi lapangan.
// Role 'technician' masuk langsung ke sini; admin & superadmin juga
// boleh akses untuk keperluan QA / preview.
router.get("/technician", authenticate, (req, res) => {
  const roleName = (req.user?.role?.name || "").toLowerCase();
  if (!/technician|admin|superadmin/.test(roleName)) {
    return res
      .status(403)
      .send("Akses ditolak: portal ini khusus untuk teknisi.");
  }
  res.render("pages/technician-dashboard", {
    title: "Portal Teknisi",
    user: req.user,
    active: "technician-dashboard",
    layout: false,
  });
});

// Alias agar /technician/dashboard juga valid
router.get("/technician/dashboard", authenticate, (req, res) =>
  res.redirect("/technician"),
);

// ═══════════════════════════════════════════════════════════════════
// Tambahkan di backend/routes/web.js setelah route /technician
// ═══════════════════════════════════════════════════════════════════

// Halaman detail ticket untuk teknisi
router.get("/technician/ticket/:id", authenticate, (req, res) => {
  const roleName = (req.user?.role?.name || "").toLowerCase();
  if (!/technician|admin|superadmin/.test(roleName)) {
    return res.status(403).send("Akses ditolak");
  }
  res.render("pages/technician-ticket-detail", {
    title: "Detail Ticket",
    user: req.user,
    active: "technician-dashboard",
    layout: false,
    ticketId: req.params.id,
  });
});

router.get("/user", (req, res) => {
  res.render("pages/users", {
    title: "User Management",
    active: "users",
    appName: "WRSNET",
    user: req.user || null,
  });
});

// const SalesController = require('../controllers/SalesController');

// router.get('/sales', SalesController.index);

router.get("/register", (req, res) => {
  res.render("pages/register");
});

const AgenController = require('../controllers/AgenController');

router.get('/portal/agen/login-agen', (req, res) => {
  res.render('portal/agen/login-agen', {
    title: 'Login Agen',
    appName: 'WRSNET'
  });
});
module.exports = router;
