/**
 * NocController.js
 * ─────────────────────────────────────────────────────────────────
 * NOC Dashboard endpoints — DATA REAL dari MikroTik via API (binary
 * atau REST sesuai konfigurasi device). TIDAK menggunakan SNMP.
 *
 * Pattern mengikuti ResourceController & DeviceMonitorController:
 *   const mt = await getMikrotikInstanceByDevice(deviceId)
 *   const r  = await mt.getSystemResource()
 *
 * Endpoint:
 *   - GET /api/noc/overview                  → KPI aggregate dari DB
 *   - GET /api/noc/alerts                    → activity log + tickets
 *   - GET /api/noc/routers                   → list router untuk selector
 *   - GET /api/noc/router/:id/resource       → CPU/mem/uptime real-time
 *   - GET /api/noc/router/:id/realtime       → snapshot lengkap (cpu+pppoe+traffic)
 *   - GET /api/noc/router/:id/history?points → time-series dari ring buffer
 *   - GET /api/noc/ticket-stats              → breakdown tiket
 *
 * Ring buffer:
 *   Setiap call /realtime menyimpan snapshot ke in-memory buffer per
 *   router (max 60 entry). Buffer ini di-return /history untuk chart
 *   timeline tanpa polling berulang. Dihapus saat process restart.
 */
const { Op } = require('sequelize');
const {
  Customer, Device, InfrastructurePoint, Ticket, ActivityLog,
  NocMonitorPreset, sequelize
} = require('../models');
const { getMikrotikInstanceByDevice } = require('../services/MikrotikService');
const logger = require('../utils/logger');

// ═══ Ring buffer per router ═══════════════════════════════════════
const _history = new Map();
const HISTORY_MAX = 60;
function _pushHistory(deviceId, sample) {
  if (!deviceId) return;
  const key = Number(deviceId);
  let arr = _history.get(key);
  if (!arr) { arr = []; _history.set(key, arr); }
  arr.push(sample);
  while (arr.length > HISTORY_MAX) arr.shift();
}
function _getHistory(deviceId) {
  return _history.get(Number(deviceId)) || [];
}

class NocController {

  /**
   * GET /api/noc/overview
   * Aggregate KPI dari DB.
   */
  async overview(req, res) {
    try {
      const custTotal     = await Customer.count().catch(() => 0);
      const custActive    = await Customer.count({ where:{ status:'active' } }).catch(() => 0);
      const custIsolated  = await Customer.count({ where:{ isolir_status:'isolated' } }).catch(() => 0);
      const custSuspended = await Customer.count({ where:{ status:'suspended' } }).catch(() => 0);

      let deviceTotal = 0, deviceOnline = 0, deviceOffline = 0;
      try {
        deviceTotal   = await Device.count();
        deviceOnline  = await Device.count({ where:{ status:'online' } });
        deviceOffline = deviceTotal - deviceOnline;
      } catch (_) {}

      let infraTotal = 0;
      try { infraTotal = await InfrastructurePoint.count(); } catch (_) {}

      let openTickets = 0;
      try {
        openTickets = await Ticket.count({
          where:{ status:{ [Op.in]:['open','in_progress'] } }
        });
      } catch (_) {}

      let ontTotal = 0, ontOnline = 0, ontOffline = 0;
      try {
        const GenieAcsService = require('../services/GenieacsService');
        if (GenieAcsService && typeof GenieAcsService.getStats === 'function') {
          const s = await GenieAcsService.getStats();
          ontTotal   = parseInt(s?.total   || 0);
          ontOnline  = parseInt(s?.online  || 0);
          ontOffline = parseInt(s?.offline || 0);
        }
      } catch (_) {}

      res.json({
        success:true,
        data:{
          timestamp: new Date().toISOString(),
          customers:      { total:custTotal, active:custActive, isolated:custIsolated, suspended:custSuspended },
          devices:        { total:deviceTotal, online:deviceOnline, offline:deviceOffline },
          ont:            { total:ontTotal, online:ontOnline, offline:ontOffline, health_pct: ontTotal > 0 ? Math.round((ontOnline/ontTotal)*1000)/10 : 0 },
          infrastructure: { total:infraTotal },
          tickets:        { open:openTickets },
        }
      });
    } catch (e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * GET /api/noc/alerts?limit=20
   */
  async alerts(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      let logs = [];
      try {
        logs = await ActivityLog.findAll({
          where:{ module:{ [Op.in]:['devices','monitoring','genieacs','pppoe','snmp','isolir','infrastructure'] } },
          order:[['createdAt','DESC']], limit
        });
      } catch (_) {}
      const items = logs.map(r => ({
        id:r.id, type:'log',
        action:r.action, module:r.module,
        description:r.description, target_type:r.target_type, target_id:r.target_id,
        created_at:r.createdAt,
        severity:_inferSeverity(r.action, r.description),
      }));

      let urgentTickets = [];
      try {
        // Priority enum di schema: low,medium,high,critical (no 'urgent')
        urgentTickets = await Ticket.findAll({
          where:{
            status:{ [Op.in]:['open','in_progress','pending'] },
            priority:{ [Op.in]:['high','critical'] }
          },
          order:[['createdAt','DESC']], limit:10
        });
      } catch (err) {
        logger.error('[NocController.alerts] Urgent tickets query failed: ' + (err.message || err));
      }
      const ticketItems = urgentTickets.map(t => ({
        id:t.id, type:'ticket',
        ticket_no:t.ticket_number, title:t.title,
        priority:t.priority, status:t.status,
        created_at:t.createdAt,
        severity: t.priority === 'critical' ? 'danger' : 'warning',
      }));

      const merged = [...items, ...ticketItems].sort((a,b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      res.json({ success:true, data:merged.slice(0, limit) });
    } catch (e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * GET /api/noc/routers
   * List router untuk selector dropdown.
   */
  async routers(req, res) {
    try {
      const baseAttrs = ['id','name','ip_address','api_port','api_protocol','is_active','status'];
      let hasIsPrimary = false;
      try {
        await Device.findOne({ where:{ is_primary:true }, attributes:['id'] });
        hasIsPrimary = true;
      } catch (_) {}

      let rows = [];
      try {
        rows = await Device.findAll({
          where:{ type:'router', is_active:true },
          attributes: hasIsPrimary ? [...baseAttrs, 'is_primary'] : baseAttrs,
          order: hasIsPrimary
            ? [['is_primary','DESC'], ['name','ASC']]
            : [['name','ASC']],
        });
      } catch (_) {
        // Fallback kalau kolom 'type' tidak ada
        rows = await Device.findAll({
          where:{ is_active:true },
          attributes: baseAttrs,
          order:[['name','ASC']]
        });
      }

      res.json({
        success:true,
        data: rows.map(r => ({
          id:           r.id,
          name:         r.name,
          ip_address:   r.ip_address,
          api_port:     r.api_port,
          api_protocol: r.api_protocol,
          status:       r.status,
          is_primary:   r.is_primary || false,
        }))
      });
    } catch (e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * GET /api/noc/router/:id/resource
   */
  async routerResource(req, res) {
    try {
      const deviceId = parseInt(req.params.id);
      if (!deviceId) return res.status(400).json({ success:false, message:'router id wajib' });

      const mt = await getMikrotikInstanceByDevice(deviceId);
      const [resource, identity] = await Promise.all([
        mt.getSystemResource(),
        mt.getSystemIdentity().catch(() => ({}))
      ]);

      const memUsed = (resource.totalMemory || 0) - (resource.freeMemory || 0);
      const memPct  = resource.totalMemory > 0
        ? Math.round((memUsed / resource.totalMemory) * 1000) / 10
        : 0;

      res.json({
        success:true,
        data:{
          identity:    identity.name || identity.identity || 'MikroTik',
          version:     resource.version,
          board:       resource.boardName,
          platform:    resource.platform,
          uptime:      resource.uptime,
          cpuLoad:     resource.cpuLoad,
          memoryTotal: resource.totalMemory,
          memoryFree:  resource.freeMemory,
          memoryUsed:  memUsed,
          memoryPct:   memPct,
        }
      });
    } catch (e) {
      logger.error('[NocController.routerResource]', e.message);
      res.status(500).json({ success:false, message:'Gagal ambil resource: ' + e.message });
    }
  }

  /**
   * GET /api/noc/router/:id/realtime
   * Snapshot lengkap: resource + PPPoE + traffic. Disimpan ke ring buffer.
   * Per-interface stats juga disimpan, supaya history bisa di-filter per
   * interface dari frontend tanpa polling baru.
   */
  async routerRealtime(req, res) {
    try {
      const deviceId = parseInt(req.params.id);
      if (!deviceId) return res.status(400).json({ success:false, message:'router id wajib' });

      const mt = await getMikrotikInstanceByDevice(deviceId);

      // Parallel fetch supaya cepat
      const [resource, identity, pppoe, ifaces] = await Promise.all([
        mt.getSystemResource(),
        mt.getSystemIdentity().catch(() => ({})),
        mt.getPPPoESessions().catch(() => []),
        mt.getInterfaces().catch(() => [])
      ]);

      const memUsed = (resource.totalMemory || 0) - (resource.freeMemory || 0);
      const memPct  = resource.totalMemory > 0
        ? Math.round((memUsed / resource.totalMemory) * 1000) / 10
        : 0;

      // Total traffic dari interface ether/sfp/wlan yang running, skip virtual
      // (pppoe-out, vlan, bridge) supaya tidak double-count.
      const physicalRunning = ifaces.filter(i =>
        i.running && !i.disabled && /^(ether|sfp|wlan)/i.test(i.type || '')
      );
      const sampleIfaces = physicalRunning.slice(0, 16).map(i => i.name);
      let totalRxBps = 0, totalTxBps = 0;
      const perIface = {}; // { name: { rxMbps, txMbps } }
      if (sampleIfaces.length) {
        try {
          const stats = await mt.getInterfacesBulkStats(sampleIfaces);
          for (const s of stats) {
            const rx = s.rxBitsPerSecond || 0;
            const tx = s.txBitsPerSecond || 0;
            totalRxBps += rx;
            totalTxBps += tx;
            perIface[s.name] = {
              rxMbps: Math.round((rx / 1e6) * 100) / 100,
              txMbps: Math.round((tx / 1e6) * 100) / 100,
            };
          }
        } catch (_) {}
      }
      const rxMbps = Math.round((totalRxBps / 1e6) * 100) / 100;
      const txMbps = Math.round((totalTxBps / 1e6) * 100) / 100;

      const ts = Date.now();
      _pushHistory(deviceId, {
        ts,
        cpu:    resource.cpuLoad || 0,
        memPct,
        pppoe:  pppoe.length,
        rxMbps, txMbps,
        perIface, // ← per-interface stats untuk filter di history
      });

      res.json({
        success:true,
        data:{
          timestamp: ts,
          identity:  identity.name || identity.identity || 'MikroTik',
          uptime:    resource.uptime,
          version:   resource.version,
          board:     resource.boardName,
          cpu:       resource.cpuLoad || 0,
          memoryTotal: resource.totalMemory,
          memoryFree:  resource.freeMemory,
          memoryUsed:  memUsed,
          memoryPct:   memPct,
          pppoeActive: pppoe.length,
          interfacesTotal:   ifaces.length,
          interfacesRunning: physicalRunning.length,
          interfacesSampled: sampleIfaces.length,
          totalRxMbps: rxMbps,
          totalTxMbps: txMbps,
          perIface, // current snapshot per interface
        }
      });
    } catch (e) {
      logger.error('[NocController.routerRealtime]', e.message);
      res.status(500).json({ success:false, message:'Gagal koneksi router: ' + e.message });
    }
  }

  /**
   * GET /api/noc/router/:id/interfaces
   * List interface fisik untuk selector (ether/sfp/wlan).
   * Comment di-include supaya user bisa identify (mis. "ether1-WAN").
   */
  async routerInterfaces(req, res) {
    try {
      const deviceId = parseInt(req.params.id);
      if (!deviceId) return res.status(400).json({ success:false, message:'router id wajib' });

      const mt = await getMikrotikInstanceByDevice(deviceId);
      const ifaces = await mt.getInterfaces();

      const filtered = (ifaces || [])
        .filter(i => /^(ether|sfp|wlan|bridge|vlan)/i.test(i.type || ''))
        .map(i => ({
          name:    i.name,
          type:    i.type,
          comment: i.comment || '',
          running: !!i.running,
          disabled:!!i.disabled,
          macAddress: i.macAddress,
        }));

      res.json({ success:true, data: filtered });
    } catch (e) {
      logger.error('[NocController.routerInterfaces]', e.message);
      res.status(500).json({ success:false, message:'Gagal ambil interface: ' + e.message });
    }
  }

  /**
   * GET /api/noc/router/:id/history?points=N&ifaces=ether1,sfp1
   * Return time-series dari ring buffer.
   * - Tanpa `ifaces` → bandwidth = total (semua interface fisik dijumlah)
   * - Dengan `ifaces` → bandwidth = sum hanya interface yang dipilih
   *   per setiap sample point.
   */
  async routerHistory(req, res) {
    try {
      const deviceId = parseInt(req.params.id);
      if (!deviceId) return res.status(400).json({ success:false, message:'router id wajib' });

      const N = Math.min(parseInt(req.query.points) || HISTORY_MAX, HISTORY_MAX);
      const buf = _getHistory(deviceId);
      const slice = buf.slice(-N);

      // Parse filter ifaces (comma-separated). Empty / '*' → semua.
      const raw = (req.query.ifaces || '').trim();
      const selected = (raw && raw !== '*')
        ? raw.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      // Hitung rx/tx per sample: kalau ada filter, sum dari sample.perIface
      // hanya untuk iface yang dipilih. Kalau tidak, pakai total agregat.
      function pickBandwidth(sample) {
        if (!selected) return { rx:sample.rxMbps || 0, tx:sample.txMbps || 0 };
        const pi = sample.perIface || {};
        let rx = 0, tx = 0;
        for (const name of selected) {
          if (pi[name]) {
            rx += pi[name].rxMbps || 0;
            tx += pi[name].txMbps || 0;
          }
        }
        return {
          rx: Math.round(rx * 100) / 100,
          tx: Math.round(tx * 100) / 100,
        };
      }

      const series = {
        cpu:     slice.map(s => ({ x:s.ts, y:s.cpu     })),
        mem:     slice.map(s => ({ x:s.ts, y:s.memPct  })),
        pppoe:   slice.map(s => ({ x:s.ts, y:s.pppoe   })),
        rx_mbps: slice.map(s => ({ x:s.ts, y:pickBandwidth(s).rx })),
        tx_mbps: slice.map(s => ({ x:s.ts, y:pickBandwidth(s).tx })),
      };
      res.json({
        success:true,
        data:series,
        points: slice.length,
        capacity: HISTORY_MAX,
        selected_ifaces: selected || [],
      });
    } catch (e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * GET /api/noc/ticket-stats
   */
  async ticketStats(req, res) {
    try {
      let stats = { byStatus:{}, byPriority:{}, recent:[], total:0 };
      try {
        // Field yang ada di schema (lihat Ticket.js): ticket_number, type,
        // priority, status, title, description, dll. Tidak ada 'subject'.
        const all = await Ticket.findAll({
          attributes:['id','ticket_number','title','status','priority','type','createdAt','updatedAt'],
          order:[['createdAt','DESC']], limit:200
        });
        stats.total = all.length;
        for (const t of all) {
          const s = (t.status   || 'unknown').toLowerCase();
          const p = (t.priority || 'medium').toLowerCase();
          stats.byStatus[s]   = (stats.byStatus[s]   || 0) + 1;
          stats.byPriority[p] = (stats.byPriority[p] || 0) + 1;
        }
        stats.recent = all.slice(0, 8).map(t => ({
          id: t.id,
          ticket_number: t.ticket_number,
          title:    t.title,
          status:   t.status,
          priority: t.priority,
          type:     t.type,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        }));
      } catch (err) {
        // Log error supaya gampang debug — sebelumnya silent fail yang
        // bikin section ticket tampak kosong padahal sebenarnya error
        // query.
        logger.error('[NocController.ticketStats] Query failed: ' + (err.message || err));
      }
      res.json({ success:true, data:stats });
    } catch (e) {
      res.status(500).json({ success:false, message:e.message });
    }
  }

  // ═══ NOC MONITOR PRESETS (bandwidth-chart cards) ═══════════════
  //
  // Setiap user bisa create multiple "monitor card" yang menampilkan
  // bandwidth chart untuk kombinasi interface tertentu per router.
  // Mis. "WAN 1", "WAN 2", "Distribusi". State tersimpan di DB jadi
  // persist antar session & antar device.

  /**
   * GET /api/noc/monitors
   * List semua preset milik user yang sedang login, sorted by position.
   */
  async listMonitors(req, res) {
    try {
      const userId = req.user && req.user.id;
      if (!userId) return res.status(401).json({ success:false, message:'Auth required' });

      const rows = await NocMonitorPreset.findAll({
        where: { user_id: userId },
        order: [['position','ASC'], ['id','ASC']],
        include: [{ model: Device, as: 'router', attributes:['id','name','ip_address'] }]
      });
      res.json({
        success:true,
        data: rows.map(r => ({
          id:       r.id,
          name:     r.name,
          router:   r.router ? { id:r.router.id, name:r.router.name, ip:r.router.ip_address } : null,
          router_id: r.router_id,
          ifaces:   Array.isArray(r.ifaces) ? r.ifaces : [],
          color:    r.color || '#3b82f6',
          position: r.position,
        }))
      });
    } catch (e) {
      logger.error('[NocController.listMonitors] ' + e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * POST /api/noc/monitors
   * Body: { name, router_id, ifaces:[], color? }
   */
  async createMonitor(req, res) {
    try {
      const userId = req.user && req.user.id;
      if (!userId) return res.status(401).json({ success:false, message:'Auth required' });

      const { name, router_id, ifaces, color } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success:false, message:'Nama monitor wajib diisi' });
      }
      if (!router_id) {
        return res.status(400).json({ success:false, message:'Router wajib dipilih' });
      }
      if (!Array.isArray(ifaces) || !ifaces.length) {
        return res.status(400).json({ success:false, message:'Pilih minimal 1 interface' });
      }

      // Position = max(existing) + 1 supaya muncul di akhir
      const maxPos = await NocMonitorPreset.max('position', { where:{ user_id:userId } }) || 0;

      const row = await NocMonitorPreset.create({
        user_id:   userId,
        router_id: parseInt(router_id),
        name:      String(name).trim().slice(0, 80),
        ifaces:    ifaces.map(s => String(s).slice(0, 64)).slice(0, 32),
        color:     color || '#3b82f6',
        position:  maxPos + 1,
      });

      res.json({
        success:true,
        data:{
          id: row.id, name: row.name, router_id: row.router_id,
          ifaces: row.ifaces, color: row.color, position: row.position,
        }
      });
    } catch (e) {
      logger.error('[NocController.createMonitor] ' + e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * PATCH /api/noc/monitors/:id
   * Body: any of { name, router_id, ifaces, color, position }
   * Hanya owner yang boleh update.
   */
  async updateMonitor(req, res) {
    try {
      const userId = req.user && req.user.id;
      if (!userId) return res.status(401).json({ success:false, message:'Auth required' });

      const id = parseInt(req.params.id);
      const row = await NocMonitorPreset.findOne({ where:{ id, user_id:userId } });
      if (!row) return res.status(404).json({ success:false, message:'Monitor tidak ditemukan' });

      const updates = {};
      if (req.body.name !== undefined)      updates.name      = String(req.body.name).trim().slice(0, 80);
      if (req.body.router_id !== undefined) updates.router_id = parseInt(req.body.router_id);
      if (req.body.color !== undefined)     updates.color     = String(req.body.color).slice(0, 20);
      if (req.body.position !== undefined)  updates.position  = parseInt(req.body.position) || 0;
      if (Array.isArray(req.body.ifaces)) {
        updates.ifaces = req.body.ifaces.map(s => String(s).slice(0, 64)).slice(0, 32);
      }

      await row.update(updates);
      res.json({ success:true, data: { id:row.id, ...updates } });
    } catch (e) {
      logger.error('[NocController.updateMonitor] ' + e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }

  /**
   * DELETE /api/noc/monitors/:id
   */
  async deleteMonitor(req, res) {
    try {
      const userId = req.user && req.user.id;
      if (!userId) return res.status(401).json({ success:false, message:'Auth required' });

      const id = parseInt(req.params.id);
      const row = await NocMonitorPreset.findOne({ where:{ id, user_id:userId } });
      if (!row) return res.status(404).json({ success:false, message:'Monitor tidak ditemukan' });

      await row.destroy();
      res.json({ success:true });
    } catch (e) {
      logger.error('[NocController.deleteMonitor] ' + e.message);
      res.status(500).json({ success:false, message:e.message });
    }
  }
}

function _inferSeverity(action, desc) {
  const a = String(action || '').toLowerCase();
  const d = String(desc   || '').toLowerCase();
  if (/down|offline|fail|error|disconnect|critical|crash/.test(a + ' ' + d)) return 'danger';
  if (/warn|slow|degrade|retry/.test(a + ' ' + d)) return 'warning';
  if (/restore|recover|up|online|connect/.test(a + ' ' + d)) return 'success';
  return 'info';
}

module.exports = new NocController();
