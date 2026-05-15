/**
 * HotspotController.js
 * REST API controller untuk semua fitur MikroTik Hotspot
 */

const HotspotService  = require('../services/HotspotService');
const { getMikrotikInstanceByDevice } = require('../services/MikrotikService');
const logger          = require('../utils/logger');

// Helper: ambil device_id dari query/header
function resolveDeviceId(req) {
  const q = req.query?.device_id;
  const h = req.headers?.['x-device-id'];
  const v = q || h;
  return v ? parseInt(v) : null;
}

// Async — resolve MikroTik instance dari tabel devices (kalau ada device_id)
// atau fallback ke env default. Pattern konsisten dengan InterfaceTrafficController.
async function getService(req) {
  // Backward-compat: kalau ada cfg override di middleware lama, tetap pakai itu
  const cfgOverride = req._mikrotikConfig || null;
  if (cfgOverride) return new HotspotService(cfgOverride);
  // Resolve instance per device_id (default kalau null).
  // HotspotService accept MikrotikService instance langsung sekarang —
  // tidak perlu lagi extract config & re-instantiate. Lebih efisien & menghindari
  // bug "lost config" kalau ada field di MikrotikService yang tidak ada di config.
  const mt = await getMikrotikInstanceByDevice(resolveDeviceId(req));
  return new HotspotService(mt);
}

const HotspotController = {

  // ─── STATS ────────────────────────────────────────────────
  async summary(req, res) {
    try {
      const svc  = await getService(req);
      const data = await svc.getSummary();
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Hotspot summary error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── SERVERS ──────────────────────────────────────────────
  async getServers(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getServers();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── PROFILES (hotspot server profile) ────────────────────
  async getProfiles(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getProfiles();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── USER PROFILES (paket voucher) ────────────────────────
  async getUserProfiles(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getUserProfiles();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createUserProfile(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.createUserProfile(req.body);
      res.json({ success: true, data, message: 'User profile berhasil dibuat' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateUserProfile(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.updateUserProfile(req.params.id, req.body);
      res.json({ success: true, data, message: 'User profile berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteUserProfile(req, res) {
    try {
      const svc = await getService(req);
      await svc.deleteUserProfile(req.params.id);
      res.json({ success: true, message: 'User profile berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── USERS ────────────────────────────────────────────────
  async getUsers(req, res) {
    try {
      const params = {};
      if (req.query.profile) params.profile = req.query.profile;
      if (req.query.server)  params.server  = req.query.server;
      const svc = await getService(req);
      const data = await svc.getUsers(params);
      res.json({ success: true, data, total: data.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createUser(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.createUser(req.body);
      res.json({ success: true, data, message: 'User hotspot berhasil dibuat' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateUser(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.updateUser(req.params.id, req.body);
      res.json({ success: true, data, message: 'User hotspot berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const svc = await getService(req);
      await svc.deleteUser(req.params.id);
      res.json({ success: true, message: 'User hotspot berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteBatch(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ success: false, message: 'IDs array required' });
      const svc = await getService(req);
      const result = await svc.deleteUserBatch(ids);
      res.json({ success: true, ...result, message: `${result.deleted} user dihapus` });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async enableUser(req, res) {
    try {
      const svc = await getService(req);
      await svc.enableUser(req.params.id);
      res.json({ success: true, message: 'User diaktifkan' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async disableUser(req, res) {
    try {
      const svc = await getService(req);
      await svc.disableUser(req.params.id);
      res.json({ success: true, message: 'User dinonaktifkan' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── GENERATE VOUCHERS ────────────────────────────────────
  async generateVouchers(req, res) {
    try {
      const { count, profile, server, prefix, passwordLength,
              comment, limitUptime, limitBytesTotal } = req.body;

      if (!count || count < 1 || count > 5000)
        return res.status(400).json({ success: false, message: 'Count harus antara 1-5000' });

      // Log untuk batch besar — supaya bisa di-trace di pm2 logs kalau lama
      if (count >= 100) {
        logger.info(`[Hotspot] generate ${count} voucher (profile=${profile||'default'}, server=${server||'all'})...`);
      }
      const t0 = Date.now();

      const svc = await getService(req);
      const result = await svc.generateVouchers({
        count: parseInt(count),
        profile: profile || 'default',
        server:  server  || 'all',
        prefix:  prefix  || 'vc',
        passwordLength: parseInt(passwordLength) || 8,
        comment,
        limitUptime,
        limitBytesTotal: parseInt(limitBytesTotal) || 0,
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (count >= 100) {
        logger.info(`[Hotspot] generate done: ${result.success}/${count} sukses, ${result.errors.length} gagal, ${elapsed}s`);
      }
      res.json({ success: true, ...result });
    } catch (err) {
      logger.error(`[Hotspot] generate failed: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── ACTIVE SESSIONS ──────────────────────────────────────
  async getActiveSessions(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getActiveSessions();
      res.json({ success: true, data, total: data.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async disconnectSession(req, res) {
    try {
      const svc = await getService(req);
      await svc.disconnectSession(req.params.id);
      res.json({ success: true, message: 'Sesi berhasil diputus' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async disconnectSessionBatch(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ success: false, message: 'IDs array required' });
      const svc = await getService(req);
      const result = await svc.disconnectSessionBatch(ids);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── HOSTS ────────────────────────────────────────────────
  async getHosts(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getHosts();
      res.json({ success: true, data, total: data.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── COOKIES ──────────────────────────────────────────────
  async getCookies(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getCookies();
      res.json({ success: true, data, total: data.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteCookie(req, res) {
    try {
      const svc = await getService(req);
      await svc.deleteCookie(req.params.id);
      res.json({ success: true, message: 'Cookie dihapus' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // ─── IP BINDING ───────────────────────────────────────────
  async getIpBindings(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.getIpBindings();
      res.json({ success: true, data, total: data.length });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createIpBinding(req, res) {
    try {
      const svc = await getService(req);
      const data = await svc.createIpBinding(req.body);
      res.json({ success: true, data, message: 'IP Binding berhasil dibuat' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteIpBinding(req, res) {
    try {
      const svc = await getService(req);
      await svc.deleteIpBinding(req.params.id);
      res.json({ success: true, message: 'IP Binding dihapus' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = HotspotController;
