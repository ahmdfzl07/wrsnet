/**
 * portal.js — Routes Customer Portal
 */
const express = require("express");
const router = express.Router();
const { portalAuth } = require("../middleware/portalAuth");
const PortalCtrl = require("../controllers/CustomerPortalController");
const GenieacsController = require("../controllers/GenieacsController");
const db = require("../models");
const { LiveMessage } = db;

// ── Public pages ──────────────────────────────────────────────
router.get("/login", (req, res) =>
  res.render("portal/login", { title: "Customer Portal", layout: false }),
);

// ── Auth ──────────────────────────────────────────────────────
router.post("/api/auth/login", PortalCtrl.login);

// ── Public (no auth) ──────────────────────────────────────────
router.get("/api/public/meta", PortalCtrl.publicMeta);

// ── Protected pages ───────────────────────────────────────────
router.get("/", portalAuth, (req, res) =>
  res.render("portal/dashboard", {
    title: "Dashboard",
    layout: false,
    customer: req.portalUser,
  }),
);
router.get("/dashboard", portalAuth, (req, res) =>
  res.render("portal/dashboard", {
    title: "Dashboard",
    layout: false,
    customer: req.portalUser,
  }),
);

// Payment result pages (render halaman dedicated, bukan dashboard)
router.get("/payment/finish", (req, res) =>
  res.render("portal/payment-result", {
    title: "Status Pembayaran",
    layout: false,
    status: "finish",
    invoiceId: req.query.invoice || "",
  }),
);
router.get("/payment/pending", (req, res) =>
  res.render("portal/payment-result", {
    title: "Pembayaran Pending",
    layout: false,
    status: "pending",
    invoiceId: req.query.invoice || "",
  }),
);

// ── Protected API ─────────────────────────────────────────────
router.get("/api/dashboard", portalAuth, PortalCtrl.dashboard);
router.get("/api/announcements", portalAuth, PortalCtrl.announcements);
router.get("/api/packages", portalAuth, PortalCtrl.packageList);
router.get("/api/upgrade/status", portalAuth, PortalCtrl.checkUpgradeStatus);
router.post("/api/upgrade", portalAuth, PortalCtrl.requestUpgrade);
router.get("/api/traffic", portalAuth, PortalCtrl.traffic);
router.get("/api/signal", portalAuth, PortalCtrl.signal);
router.post("/api/reboot", portalAuth, PortalCtrl.reboot);
router.get("/api/billing", portalAuth, PortalCtrl.billing);
router.put("/api/password", portalAuth, PortalCtrl.changePassword);
router.put("/api/profile", portalAuth, PortalCtrl.updateProfile);

// WiFi (ONT via GenieACS)
router.get("/api/wifi", portalAuth, PortalCtrl.wifiStatus);
router.post("/api/wifi", portalAuth, PortalCtrl.wifiSet);

// Tiket (tetap ada tapi tidak di nav utama)
router.get("/api/tickets", portalAuth, PortalCtrl.ticketList);
router.post("/api/tickets", portalAuth, PortalCtrl.ticketCreate);

// Payment gateway
router.post("/api/pay", portalAuth, PortalCtrl.createPayment);
router.get("/api/invoice/:id/status", portalAuth, PortalCtrl.invoiceStatus);

// Push Notification (hybrid: Web Push / VAPID + FCM for Android APK)
router.get("/api/push/vapid-key", portalAuth, PortalCtrl.pushVapidKey);
router.get("/api/push/status", portalAuth, PortalCtrl.pushStatus);
router.post("/api/push/subscribe", PortalCtrl.pushSubscribe); // web, no auth (called from SW)
router.post("/api/push/subscribe-auth", portalAuth, PortalCtrl.pushSubscribe); // web, with auth
router.post("/api/push/unsubscribe", portalAuth, PortalCtrl.pushUnsubscribe);
router.post("/api/push/register-fcm", portalAuth, PortalCtrl.pushRegisterFcm); // Android APK
router.post(
  "/api/push/unregister-fcm",
  portalAuth,
  PortalCtrl.pushUnregisterFcm,
); // Android APK

// Webhooks (public — tidak pakai portalAuth, validasi internal)
router.post("/webhook/midtrans", PortalCtrl.midtransNotif);
router.post("/webhook/xendit", PortalCtrl.xenditNotif);
// Duitku kirim callback sebagai application/x-www-form-urlencoded.
// Express sudah pasang urlencoded() global di server.js, jadi cukup register handler.
router.post("/webhook/duitku", PortalCtrl.duitkuNotif);

const { Op } = require("sequelize");

router.get("/api/chat-rooms", portalAuth, async (req, res) => {
  const { LiveMessage, Sequelize } = require("../models");
  const { fn, col, literal } = Sequelize;

  const rooms = await LiveMessage.findAll({
    attributes: [
      "room",
      "name",
      [
        fn(
          "SUM",
          literal(
            `CASE WHEN is_read = 0 AND type = 'customer' THEN 1 ELSE 0 END`,
          ),
        ),
        "unread",
      ],
      [fn("MAX", col("created_at")), "last_time"],
    ],
    group: ["room"],
    order: [[fn("MAX", col("created_at")), "DESC"]],
  });

  res.json(rooms);
});
router.get("/api/chat/:room", portalAuth, async (req, res) => {
  try {
    const room = req.params.room;

    const { LiveMessage } = require("../models");

    const messages = await LiveMessage.findAll({
      where: { room },
      order: [["created_at", "ASC"]],
    });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});
router.post("/api/chat/read", portalAuth, async (req, res) => {
  try {
    const { room } = req.body;

    await LiveMessage.update(
      { is_read: true },
      {
        where: {
          room,
          is_read: false,
        },
      },
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post("/api/chat/read-customer/:room", portalAuth, async (req, res) => {
  try {
    const { room } = req.params;

    if (!room) {
      return res.status(400).json({
        success: false,
        message: "Room is required",
      });
    }

    const updated = await LiveMessage.update(
      { is_read: true },
      {
        where: {
          room: room,
          is_read: false,
          type: "admin",
        },
      },
    );

    res.json({
      success: true,
      updated,
      message: "Chat marked as read",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to update read status",
    });
  }
});

// GENIEACS
// ---- Device Detail ----
router.get("/api/genieacs/devices/:id", GenieacsController.getDevice);

router.post("/api/genieacs/devices/:id/wifi", GenieacsController.setWifi);
router.post(
  "/api/genieacs/devices/:id/reboot",
  GenieacsController.rebootDevice,
);
router.post(
  "/api/genieacs/devices/:id/factory-reset",
  GenieacsController.factoryReset,
);
router.post(
  "/api/genieacs/devices/:id/refresh",
  GenieacsController.refreshDevice,
);
router.get("/api/genieacs/devices", GenieacsController.getDevices);
router.get("/api/genieacs/stats", GenieacsController.getStats);
router.get("/api/genieacs/devices/:id", GenieacsController.getDevice);
router.get("/api/genieacs/devices/:id/clients", GenieacsController.getClients);
router.get(
  "/api/genieacs/devices/:id/bandwidth",
  GenieacsController.getBandwidth,
);
router.get(
  "/api/genieacs/devices/:id/rx-history",
  GenieacsController.getRxHistory,
);

let mikrotikCache = {
  queues: [],
  sessions: [],
  ts: 0,
};

const CACHE_TTL = 3000;

router.get("/mikrotik/customer-traffic", async (req, res) => {
  try {
    const {
      getMikrotikInstanceByDevice,
    } = require("../services/MikrotikService");
    const { Customer, Package } = require("../models");
    const { Op } = require("sequelize");

    const resolveDeviceId = () => {
      const v = req.query?.device_id || req.headers?.["x-device-id"];
      if (!v) return null;
      const n = parseInt(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const mt = await getMikrotikInstanceByDevice(resolveDeviceId());

    const customerId = req.query.customer_id || req.headers["x-customer-id"];

    const now = Date.now();

    if (!mikrotikCache.ts || now - mikrotikCache.ts > CACHE_TTL) {
      const [q, s] = await Promise.allSettled([
        mt.getQueues(),
        mt.getPPPoESessions(),
      ]);

      mikrotikCache.queues = q.status === "fulfilled" ? q.value : [];
      mikrotikCache.sessions = s.status === "fulfilled" ? s.value : [];
      mikrotikCache.ts = now;
    }

    const queueData = mikrotikCache.queues;
    const sessionData = mikrotikCache.sessions;

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
        ...(customerId ? { customer_id: customerId } : {}),
      },
      limit: 1,
    });

    const cust = customers[0];

    if (!cust) {
      return res.json({ success: true, data: null });
    }

    const ip = cust.static_ip;
    const pppoe = cust.pppoe_username?.toLowerCase();

    const session =
      sessionData.find(
        (s) =>
          (pppoe && s.name?.toLowerCase() === pppoe) ||
          (ip && s.address === ip),
      ) || null;

    const queue =
      queueData.find(
        (q) =>
          (ip && q.target?.includes(ip)) ||
          (pppoe && q.name?.toLowerCase().includes(pppoe)),
      ) || null;

    const rateDown = queue ? parseInt(queue.rateIn || 0) : 0;
    const rateUp = queue ? parseInt(queue.rateOut || 0) : 0;

    return res.json({
      success: true,
      data: {
        id: cust.id,
        customer_id: cust.customer_id,
        name: cust.name,
        ip,
        pppoe: cust.pppoe_username,
        package: cust.package?.name || null,

        online: !!session || rateDown + rateUp > 0,

        rateDown,
        rateUp,

        bytesDown: queue ? parseInt(queue.bytesIn || 0) : 0,
        bytesUp: queue ? parseInt(queue.bytesOut || 0) : 0,

        uptime: session?.uptime || null,
        queueName: queue?.name || null,
      },
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

module.exports = router;
