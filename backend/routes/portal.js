/**
 * portal.js — Routes Customer Portal
 */
const express = require('express');
const router  = express.Router();
const { portalAuth } = require('../middleware/portalAuth');
const PortalCtrl     = require('../controllers/CustomerPortalController');

// ── Public pages ──────────────────────────────────────────────
router.get('/login', (req, res) => res.render('portal/login', { title: 'Customer Portal', layout: false }));

// ── Auth ──────────────────────────────────────────────────────
router.post('/api/auth/login', PortalCtrl.login);

// ── Public (no auth) ──────────────────────────────────────────
router.get('/api/public/meta', PortalCtrl.publicMeta);

// ── Protected pages ───────────────────────────────────────────
router.get('/',         portalAuth, (req, res) => res.render('portal/dashboard', { title: 'Dashboard', layout: false, customer: req.portalUser }));
router.get('/dashboard',portalAuth, (req, res) => res.render('portal/dashboard', { title: 'Dashboard', layout: false, customer: req.portalUser }));

// Payment result pages (render halaman dedicated, bukan dashboard)
<<<<<<< HEAD
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
=======
router.get('/payment/finish',  (req, res) => res.render('portal/payment-result', {
  title: 'Status Pembayaran', layout: false, status: 'finish', invoiceId: req.query.invoice || ''
}));
router.get('/payment/pending', (req, res) => res.render('portal/payment-result', {
  title: 'Pembayaran Pending', layout: false, status: 'pending', invoiceId: req.query.invoice || ''
}));
>>>>>>> aed8107 (update full code dari vendor)

// ── Protected API ─────────────────────────────────────────────
router.get ('/api/dashboard',     portalAuth, PortalCtrl.dashboard);
router.get ('/api/announcements', portalAuth, PortalCtrl.announcements);
router.get ('/api/packages',        portalAuth, PortalCtrl.packageList);
router.get ('/api/upgrade/status',  portalAuth, PortalCtrl.checkUpgradeStatus);
router.post('/api/upgrade',         portalAuth, PortalCtrl.requestUpgrade);
router.get ('/api/traffic',       portalAuth, PortalCtrl.traffic);
router.get ('/api/signal',        portalAuth, PortalCtrl.signal);
router.post('/api/reboot',        portalAuth, PortalCtrl.reboot);
router.get ('/api/billing',       portalAuth, PortalCtrl.billing);
router.put ('/api/password',      portalAuth, PortalCtrl.changePassword);
router.put ('/api/profile',       portalAuth, PortalCtrl.updateProfile);

// WiFi (ONT via GenieACS)
router.get ('/api/wifi',          portalAuth, PortalCtrl.wifiStatus);
router.post('/api/wifi',          portalAuth, PortalCtrl.wifiSet);

// Tiket (tetap ada tapi tidak di nav utama)
router.get ('/api/tickets',       portalAuth, PortalCtrl.ticketList);
router.post('/api/tickets',       portalAuth, PortalCtrl.ticketCreate);

// Payment gateway
router.post('/api/pay',                   portalAuth, PortalCtrl.createPayment);
router.get ('/api/invoice/:id/status',    portalAuth, PortalCtrl.invoiceStatus);

// Push Notification (hybrid: Web Push / VAPID + FCM for Android APK)
router.get ('/api/push/vapid-key',       portalAuth, PortalCtrl.pushVapidKey);
router.get ('/api/push/status',          portalAuth, PortalCtrl.pushStatus);
router.post('/api/push/subscribe',                   PortalCtrl.pushSubscribe);       // web, no auth (called from SW)
router.post('/api/push/subscribe-auth',  portalAuth, PortalCtrl.pushSubscribe);       // web, with auth
router.post('/api/push/unsubscribe',     portalAuth, PortalCtrl.pushUnsubscribe);
router.post('/api/push/register-fcm',    portalAuth, PortalCtrl.pushRegisterFcm);     // Android APK
router.post('/api/push/unregister-fcm',  portalAuth, PortalCtrl.pushUnregisterFcm);   // Android APK

// Webhooks (public — tidak pakai portalAuth, validasi internal)
router.post('/webhook/midtrans',  PortalCtrl.midtransNotif);
router.post('/webhook/xendit',    PortalCtrl.xenditNotif);
// Duitku kirim callback sebagai application/x-www-form-urlencoded.
// Express sudah pasang urlencoded() global di server.js, jadi cukup register handler.
router.post('/webhook/duitku',    PortalCtrl.duitkuNotif);

module.exports = router;