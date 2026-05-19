/**
 * portal.js — Routes Customer Portal
 */
const express = require("express");
const router = express.Router();
const { portalAuth } = require("../middleware/portalAuth");
const PortalCtrl = require("../controllers/CustomerPortalController");
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

// router.get("/api/chat/:room", portalAuth, async (req, res) => {
//   try {
//     const room = req.params.room;

//     const { LiveMessage } = require("../models");

//     const messages = await LiveMessage.findAll({
//       where: {
//         room: room,
//       },
//       order: [["created_at", "ASC"]],
//     });

//     res.json(messages);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json([]);
//   }
// });

// router.get("/api/chat-rooms", portalAuth, async (req, res) => {
//   try {
//     const { LiveMessage } = require("../models");
//     const { fn, col } = require("sequelize");

//     const rooms = await LiveMessage.findAll({
//       attributes: ["room", [fn("MAX", col("created_at")), "last_time"]],
//       group: ["room"],
//       order: [[fn("MAX", col("created_at")), "DESC"]],
//     });

//     res.json(rooms);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json([]);
//   }
// });

router.get("/api/chat-rooms", portalAuth, async (req, res) => {
  const { LiveMessage, Sequelize } = require("../models");
  const { fn, col } = Sequelize;

  const rooms = await LiveMessage.findAll({
    attributes: [
      "room",
      "name",
      [fn("SUM", Sequelize.literal("is_read = 0")), "unread"],
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

module.exports = router;
