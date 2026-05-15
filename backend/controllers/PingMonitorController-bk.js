/**
 * PingMonitorController.js
 *
 * Logic improvements:
 * - Per-IP STATE MACHINE: unknown → up/down dengan konfirmasi
 * - DOWN dikonfirmasi setelah CONFIRM_DOWN scan berturut gagal (anti false-positive)
 * - UP langsung saat 1 packet reply (recovery cepat)
 * - Riwayat RTT 10 hasil → avg latency lebih stabil
 * - Satu axios ping-client per-module, bukan per-call
 * - Semaphore concurrency bukan chunk (lebih efisien)
 * - Sync pakai bulk query + in-memory index, bukan N×DB queries
 */

"use strict";

const { getMikrotikInstance, getMikrotikInstanceByDevice } = require("../services/MikrotikService");
const { Customer, Package }   = require("../models");
const { Op }                  = require("sequelize");
const logger                  = require("../utils/logger");
const axios                   = require("axios");
const https                   = require("https");

// ── Helper: ambil device_id dari query/header ─────────────────
function resolveDeviceId(req) {
  const q = req.query?.device_id;
  const h = req.headers?.['x-device-id'];
  const v = q || h;
  return v ? parseInt(v) : null;
}

// Key untuk Map cache yang per-device (gunakan 'default' kalau null)
function deviceKey(deviceId) {
  return deviceId == null ? 'default' : String(deviceId);
}

// ── Konstanta ─────────────────────────────────────────────────
const PING_COUNT     = 4;     // packet per probe
const PING_INTERVAL  = "0.2"; // detik antar packet
const PING_TIMEOUT   = 15000; // ms timeout HTTP ke MikroTik
const CONFIRM_DOWN   = 2;     // butuh N scan gagal berturut untuk DOWN
const RTT_HISTORY    = 10;    // simpan N hasil RTT terakhir
const CONCURRENCY    = 4;     // max parallel probe ke MikroTik

// ── State store per-IP ────────────────────────────────────────
// ip → { status, consecutiveFail, consecutiveOk, rttHistory,
//         loss, sent, received, lastCheck, downSince, upSince }
const ipState = new Map();

function getIpState(ip) {
  if (!ipState.has(ip)) {
    ipState.set(ip, {
      status:          "unknown",
      consecutiveFail: 0,
      consecutiveOk:   0,
      rttHistory:      [],
      loss:            0,
      sent:            0,
      received:        0,
      lastCheck:       null,
      downSince:       null,
      upSince:         null,
    });
  }
  return ipState.get(ip);
}

// ── Ping client per-device (Map: deviceKey → axios instance) ──
// Tiap MikroTik beda baseURL+credential, jadi client di-cache per device.
const _pingClients = new Map();

async function getPingClientForDevice(deviceId) {
  const key = deviceKey(deviceId);
  if (_pingClients.has(key)) return _pingClients.get(key);

  const mt = await getMikrotikInstanceByDevice(deviceId);
  const client = axios.create({
    baseURL:    mt.baseURL,
    auth:       { username: mt.username, password: mt.password },
    timeout:    PING_TIMEOUT,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });
  _pingClients.set(key, client);
  return client;
}

function resetPingClient(deviceId = null) {
  if (deviceId === null) {
    _pingClients.clear();
  } else {
    _pingClients.delete(deviceKey(deviceId));
  }
}

// ── Parse response RouterOS /tool/ping ────────────────────────
// Format A: aggregate  { sent, received, avg-rtt, ... }
// Format B: array [ per-packet ..., summary ]
// Format C: array per-packet saja (tanpa summary)
function parseResponse(raw) {
  if (!raw) return null;
  const entries = Array.isArray(raw) ? raw : [raw];

  // Cari summary (entry dengan field "sent" bernilai angka)
  let summary = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e && typeof e === "object" && +e.sent > 0) { summary = e; break; }
  }

  if (summary) {
    return {
      sent:     +summary.sent     || PING_COUNT,
      received: +summary.received || 0,
      rtt:      parseRtt(summary["avg-rtt"] || summary["avg-rtt-ms"] || "0"),
    };
  }

  // Fallback: hitung dari per-packet
  let received = 0, rttSum = 0, rttN = 0;
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const st = (e.status || "").toLowerCase();
    if (st.includes("reply") || e["response-time"] != null) {
      received++;
      const rt = parseRtt(e["response-time"] || "0");
      if (rt > 0) { rttSum += rt; rttN++; }
    }
  }
  return {
    sent:     Math.max(entries.filter(e => e && typeof e === "object").length, received, PING_COUNT),
    received,
    rtt:      rttN > 0 ? rttSum / rttN : 0,
  };
}

// Normalisasi RTT ke ms: "1.5ms" → 1.5 | "1500us" → 1.5 | "1.5" → 1.5
function parseRtt(raw) {
  const s = String(raw || "0");
  const n = parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  return s.includes("us") ? n / 1000 : n;
}

// ── Probe satu IP + update state machine ─────────────────────
async function probeIP(ip, client) {
  const s   = getIpState(ip);
  const now = new Date().toISOString();

  let probe;
  try {
    const resp = await client.post("/tool/ping", {
      address:  ip,
      count:    String(PING_COUNT),
      interval: PING_INTERVAL,
    });
    probe = parseResponse(resp.data);
  } catch (err) {
    logger.debug(`PingMonitor probe ${ip}: ${err.message}`);
    probe = { sent: PING_COUNT, received: 0, rtt: 0 };
  }

  if (!probe) probe = { sent: PING_COUNT, received: 0, rtt: 0 };

  const reachable = probe.received > 0;

  // Update RTT history
  if (reachable && probe.rtt > 0) {
    s.rttHistory.push(probe.rtt);
    if (s.rttHistory.length > RTT_HISTORY) s.rttHistory.shift();
  }

  // State transitions
  if (reachable) {
    s.consecutiveFail = 0;
    s.consecutiveOk++;
    if (s.status !== "up") {
      logger.info(`PingMonitor: ${ip} UP (was ${s.status})`);
      s.status    = "up";
      s.upSince   = now;
      s.downSince = null;
    }
  } else {
    s.consecutiveOk   = 0;
    s.consecutiveFail++;
    // DOWN hanya dikonfirmasi setelah CONFIRM_DOWN kali berturut
    if (s.consecutiveFail >= CONFIRM_DOWN && s.status !== "down") {
      logger.info(`PingMonitor: ${ip} DOWN (${s.consecutiveFail}x fail)`);
      s.status    = "down";
      s.downSince = now;
      s.upSince   = null;
    }
  }

  s.sent      = probe.sent;
  s.received  = probe.received;
  s.loss      = probe.sent > 0 ? Math.round((1 - probe.received / probe.sent) * 100) : 100;
  s.lastCheck = now;

  return toResult(ip, s);
}

// Bangun objek result dari state
function toResult(ip, s) {
  const avgRtt = s.rttHistory.length > 0
    ? s.rttHistory.reduce((a, b) => a + b, 0) / s.rttHistory.length
    : 0;

  // Saat masih "unknown" tapi sudah pernah di-probe, tentukan dari fail/ok
  const displayStatus = s.status === "unknown" && s.lastCheck
    ? (s.consecutiveFail > 0 ? "down" : "up")
    : s.status;

  return {
    status:          displayStatus,
    latency:         +avgRtt.toFixed(1),
    latencyLast:     s.rttHistory.length ? +s.rttHistory[s.rttHistory.length - 1].toFixed(1) : 0,
    loss:            s.loss,
    sent:            s.sent,
    received:        s.received,
    consecutiveFail: s.consecutiveFail,
    downSince:       s.downSince,
    upSince:         s.upSince,
    lastCheck:       s.lastCheck,
  };
}

// ── Probe batch dengan semaphore (bukan chunking) ─────────────
// Semaphore lebih efisien: slot langsung diisi setelah selesai,
// tidak menunggu seluruh chunk selesai sebelum lanjut.
function probeBatch(ips, client) {
  return new Promise((resolve) => {
    const results = {};
    let idx = 0, active = 0;

    function next() {
      if (idx >= ips.length && active === 0) { resolve(results); return; }
      while (active < CONCURRENCY && idx < ips.length) {
        const ip = ips[idx++];
        active++;
        probeIP(ip, client)
          .then(r  => { results[ip] = r; })
          .catch(() => { results[ip] = toResult(ip, getIpState(ip)); })
          .finally(() => { active--; next(); });
      }
    }
    next();
  });
}

// ════════════════════════════════════════════════════════════════
// Endpoints
// ════════════════════════════════════════════════════════════════

// GET /api/ping-monitor/customers
// ── Auto-sync throttle (per-device) ───────────────────────────
// Auto-sync triggered oleh frontend (GET /customers?autoSync=1) tidak boleh
// jalan setiap reload. 60 detik window cukup untuk capture PPPoE/queue change
// tanpa hammering MikroTik. Per-device karena tiap MikroTik di-throttle terpisah.
const _lastAutoSyncAt = new Map();  // deviceKey → timestamp ms
const AUTO_SYNC_THROTTLE_MS = 60 * 1000;

// In-memory cache untuk PPPoE active sessions — per-device.
// Diisi oleh syncFromMikrotik dan dipakai getCustomers untuk enrich IP
// customer yang PPPoE-only.
// deviceKey → { cache: Map<usernameLower, ip>, at: ms } | null
const _pppoeActive = new Map();

exports.getCustomers = async (req, res) => {
  try {
    const deviceId = resolveDeviceId(req);
    const dKey     = deviceKey(deviceId);

    // 1) Auto-sync (opsional, lewat ?autoSync=1) — silently best-effort
    //    Tidak blok response kalau MikroTik error. Per-device throttle.
    if (req.query.autoSync === "1") {
      const now = Date.now();
      const last = _lastAutoSyncAt.get(dKey) || 0;
      if (now - last >= AUTO_SYNC_THROTTLE_MS) {
        _lastAutoSyncAt.set(dKey, now);
        try { await _runSync(deviceId); }
        catch (e) { logger.warn(`PingMonitor auto-sync gagal (device=${dKey}): ${e.message}`); }
      }
    }

    // 2) Refresh PPPoE active cache (untuk enrich IP customer PPPoE-only).
    //    Per-device — cache MikroTik A tidak boleh dipakai untuk MikroTik B.
    //    Stale lebih dari 60 dtk → refresh; gagal → biarkan cache lama / null.
    const cur = _pppoeActive.get(dKey);
    if (!cur || (Date.now() - cur.at > 60 * 1000)) {
      try {
        const mt = await getMikrotikInstanceByDevice(deviceId);
        const list = await mt.get("/ppp/active");
        const cache = new Map();
        (Array.isArray(list) ? list : []).forEach(s => {
          const u = (s.name || "").toLowerCase();
          if (u && s.address) cache.set(u, s.address);
        });
        _pppoeActive.set(dKey, { cache, at: Date.now() });
      } catch (_) {
        // MikroTik tak terjangkau; biarkan cache lama dipakai (atau null).
      }
    }
    const pppoeActiveCache = _pppoeActive.get(dKey)?.cache || null;

    // 3) Query customer: yang punya static_ip ATAU pppoe_username.
    //    Sebelumnya cuma static_ip → customer PPPoE-only tidak muncul.
    const rows = await Customer.findAll({
      where: {
        status: { [Op.in]: ["active", "isolated"] },
        [Op.or]: [
          { static_ip:      { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } },
          { pppoe_username: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: "" }] } },
        ],
      },
      include: [{
        model:      Package,
        as:         "package",
        attributes: ["name", "speed_down", "speed_up"],
        required:   false,
      }],
      attributes: ["id","customer_id","name","static_ip","status",
                   "pppoe_username","address","package_id"],
      order: [["name", "ASC"]],
    });

    // 4) Build response: untuk customer tanpa static_ip, lookup IP dari
    //    PPPoE active cache. Kalau tetap tak ditemukan → ip kosong & status "no_ip".
    const data = rows.map(c => {
      let ip = c.static_ip || "";
      let ipSource = ip ? "static" : "";

      // PPPoE-only: cari IP dari active session
      if (!ip && c.pppoe_username && pppoeActiveCache) {
        const found = pppoeActiveCache.get(c.pppoe_username.toLowerCase());
        if (found) { ip = found; ipSource = "pppoe"; }
      }

      const s = ip ? ipState.get(ip) : null;
      return {
        id:          c.id,
        customer_id: c.customer_id,
        name:        c.name,
        ip,
        ip_source:   ipSource,                   // "static" | "pppoe" | ""
        has_ip:      !!ip,
        status:      c.status,
        pppoe:       c.pppoe_username || "-",
        address:     c.address        || "-",
        package:     c.package?.name  || "-",
        speed:       c.package
                       ? `${c.package.speed_down}/${c.package.speed_up} Mbps`
                       : "-",
        ping: ip
          ? (s ? toResult(ip, s) : { status: "unknown", latency: 0, loss: 0, lastCheck: null })
          : { status: "no_ip",   latency: 0, loss: 0, lastCheck: null },
      };
    });

    res.json({
      success:    true,
      data,
      total:      data.length,
      with_ip:    data.filter(x => x.has_ip).length,
      without_ip: data.filter(x => !x.has_ip).length,
    });
  } catch (e) {
    logger.error("PingMonitor getCustomers:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// GET /api/ping-monitor/all-customers
exports.getAllCustomers = async (req, res) => {
  try {
    const rows = await Customer.findAll({
      where:      { status: { [Op.in]: ["active", "isolated"] } },
      attributes: ["id","customer_id","name","static_ip","status","pppoe_username"],
      order:      [["name", "ASC"]],
    });
    const data = rows.map(c => ({
      id:          c.id,
      customer_id: c.customer_id,
      name:        c.name,
      ip:          c.static_ip    || "",
      pppoe:       c.pppoe_username || "",
      status:      c.status,
      hasIP:       !!(c.static_ip?.trim()),
    }));
    res.json({
      success:   true,
      data,
      total:     data.length,
      withIP:    data.filter(c => c.hasIP).length,
      withoutIP: data.filter(c => !c.hasIP).length,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/ping-monitor/ping-batch  { ips: [...] }
exports.pingBatch = async (req, res) => {
  const { ips } = req.body || {};
  if (!Array.isArray(ips) || ips.length === 0)
    return res.status(400).json({ success: false, message: "ips[] wajib diisi" });

  const deviceId = resolveDeviceId(req);

  let client;
  try { client = await getPingClientForDevice(deviceId); }
  catch (e) {
    return res.status(503).json({ success: false, message: "MikroTik tidak terhubung: " + e.message });
  }

  const results = await probeBatch(ips.slice(0, 50), client);
  res.json({ success: true, results, checkedAt: new Date().toISOString() });
};

// POST /api/ping-monitor/ping-single  { ip }
exports.pingSingle = async (req, res) => {
  const { ip } = req.body || {};
  if (!ip) return res.status(400).json({ success: false, message: "ip wajib diisi" });

  const deviceId = resolveDeviceId(req);

  let client;
  try { client = await getPingClientForDevice(deviceId); }
  catch (e) { return res.status(503).json({ success: false, message: "MikroTik tidak terhubung" }); }

  // Reset counter agar single-ping langsung reflektif
  const s = getIpState(ip);
  s.consecutiveFail = 0;
  s.consecutiveOk   = 0;

  const result = await probeIP(ip, client);
  res.json({ success: true, ip, ...result });
};

// GET /api/ping-monitor/summary
exports.summary = async (req, res) => {
  try {
    const rows = await Customer.findAll({
      where:      { status: { [Op.in]: ["active","isolated"] }, static_ip: { [Op.not]: null, [Op.ne]: "" } },
      attributes: ["static_ip"],
    });
    let up = 0, down = 0, unknown = 0;
    rows.forEach(c => {
      const s = ipState.get(c.static_ip);
      if (!s || s.status === "unknown") unknown++;
      else if (s.status === "up")        up++;
      else                               down++;
    });
    res.json({ success: true, total: rows.length, up, down, unknown, lastUpdate: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/ping-monitor/set-ip  { customerId, ip }
exports.setCustomerIP = async (req, res) => {
  const { customerId, ip } = req.body || {};
  if (!customerId || !ip)
    return res.status(400).json({ success: false, message: "customerId dan ip wajib" });
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))
    return res.status(400).json({ success: false, message: "Format IP tidak valid" });
  try {
    const c = await Customer.findByPk(customerId);
    if (!c) return res.status(404).json({ success: false, message: "Customer tidak ditemukan" });
    await c.update({ static_ip: ip });
    res.json({ success: true, message: `IP ${ip} disimpan untuk ${c.name}` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// POST /api/ping-monitor/sync-from-mikrotik
exports.syncFromMikrotik = async (req, res) => {
  try {
    const deviceId = resolveDeviceId(req);
    const result = await _runSync(deviceId);
    res.json({
      success: true,
      message: `Sync selesai: ${result.updated} diupdate, ${result.skipped} skip, ${result.notFound} tidak cocok`,
      ...result,
    });
  } catch (e) {
    res.status(503).json({ success: false, message: "MikroTik tidak terhubung: " + e.message });
  }
};

// Internal: shared sync logic. Throws kalau MikroTik error.
// Dipanggil oleh syncFromMikrotik (manual) dan getCustomers (auto, throttled).
async function _runSync(deviceId = null) {
  const mt = await getMikrotikInstanceByDevice(deviceId);
  resetPingClient(deviceId);

  const result = { updated: 0, skipped: 0, notFound: 0, errors: [], sources: [] };

  // Bulk load semua customer sekali — bukan N queries dalam loop
  const allCust = await Customer.findAll({
    where:      { status: { [Op.in]: ["active", "isolated"] } },
    attributes: ["id","name","pppoe_username","static_ip"],
  });

  // Index by pppoe_username (lowercase) dan by IP
  const byPPPoE = new Map();  // "username" → Customer
  const byIP    = new Map();  // "10.x.x.x" → Customer
  allCust.forEach(c => {
    if (c.pppoe_username) byPPPoE.set(c.pppoe_username.toLowerCase(), c);
    if (c.static_ip)      byIP.set(c.static_ip, c);
  });

  const applyIP = async (cust, newIP) => {
    if (!cust || !newIP) return "notFound";
    if (cust.static_ip === newIP) return "skipped";
    try {
      await cust.update({ static_ip: newIP });
      byIP.set(newIP, cust);  // update index
      return "updated";
    } catch (e) {
      result.errors.push(`${cust.name}: ${e.message}`);
      return "notFound";
    }
  };

  // 1. PPPoE active sessions
  try {
    const list = await mt.get("/ppp/active");
    const sessions = Array.isArray(list) ? list : [];
    result.sources.push(`PPPoE: ${sessions.length} sesi aktif`);
    // Update PPPoE active cache sekalian — supaya getCustomers berikutnya
    // bisa langsung enrich tanpa hit MikroTik lagi. Per-device.
    const cache = new Map();
    for (const s of sessions) {
      const uname = (s.name    || "").toLowerCase();
      const ip    =  s.address || "";
      if (!uname || !ip) continue;
      cache.set(uname, ip);
      const out = await applyIP(byPPPoE.get(uname), ip);
      result[out]++;
    }
    _pppoeActive.set(deviceKey(deviceId), { cache, at: Date.now() });
  } catch (e) { result.errors.push("PPPoE: " + e.message); }

  // 2. Simple Queue targets
  try {
    const list = await mt.get("/queue/simple");
    const queues = Array.isArray(list) ? list : [];
    result.sources.push(`Queue: ${queues.length} antrian`);
    for (const q of queues) {
      const target = (q.target || "").replace("/32","").trim();
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(target)) continue;
      if (byIP.has(target)) { result.skipped++; continue; }
      const qname = (q.name || "").toLowerCase().trim();
      // Exact match dulu, lalu partial
      const cust = byPPPoE.get(qname)
               || [...byPPPoE.entries()].find(([k]) => k.includes(qname) || qname.includes(k))?.[1];
      if (cust && !cust.static_ip) {
        const out = await applyIP(cust, target);
        result[out]++;
      } else {
        result.notFound++;
      }
    }
  } catch (e) { result.errors.push("Queue: " + e.message); }

  // 3. DHCP leases
  try {
    const list = await mt.get("/ip/dhcp-server/lease");
    if (Array.isArray(list)) {
      result.sources.push(`DHCP: ${list.length} lease`);
      for (const l of list) {
        const ip   = l.address || l["active-address"] || "";
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue;
        if (byIP.has(ip)) continue;
        const term = (l.hostname || l["host-name"] || l.comment || "").toLowerCase();
        if (!term) continue;
        const cust = byPPPoE.get(term)
                  || [...byPPPoE.entries()].find(([k]) => k.includes(term) || term.includes(k))?.[1];
        if (cust && !cust.static_ip) {
          const out = await applyIP(cust, ip);
          result[out]++;
        }
      }
    }
  } catch (_) {}

  return result;
}
