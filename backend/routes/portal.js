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

router.get("/mikrotik/customer-traffic", async (req, res) => {
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
        (pppoeLc && sessionByName[pppoeLc]) || (ip && sessionByIP[ip]) || null;
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
        fetchErrors: Object.keys(fetchErrors).length ? fetchErrors : undefined,
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
});

module.exports = router;
