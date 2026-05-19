/**
 * HotspotService.js
 * Semua operasi MikroTik Hotspot via REST API (RouterOS v7+)
 * Dipanggil oleh HotspotController
 */

const { getMikrotikInstance, MikrotikService } = require('./MikrotikService');
const logger = require('../utils/logger');

class HotspotService {
  /**
   * @param {MikrotikService|object|null} configOrInstance
   *   Bisa berupa:
   *   - MikrotikService instance (dari getMikrotikInstanceByDevice / getMikrotikInstance)
   *   - Config object { host, port, username, password, useSSL }
   *   - null → pakai default instance dari env
   */
  constructor(configOrInstance = null) {
    if (configOrInstance instanceof MikrotikService) {
      // Reuse instance — paling efisien, kalau caller sudah resolve instance
      this.mt = configOrInstance;
    } else if (configOrInstance) {
      // Config object → buat instance baru
      this.mt = new MikrotikService(configOrInstance);
    } else {
      // Fallback ke default
      this.mt = getMikrotikInstance();
    }
  }

  // ─── HOTSPOT SERVER ──────────────────────────────────────────

  async getServers() {
    const list = await this.mt.get('/ip/hotspot');
    return (Array.isArray(list) ? list : []).map(s => ({
      id:          s['.id'],
      name:        s.name        || '',
      interface:   s.interface   || '',
      addressPool: s['address-pool'] || '',
      profile:     s.profile     || 'default',
      idleTimeout: s['idle-timeout']  || 'none',
      keepaliveTimeout: s['keepalive-timeout'] || '00:00:00',
      disabled:    s.disabled    === 'true',
      running:     s.invalid     !== 'true',
    }));
  }

  // ─── HOTSPOT PROFILES ────────────────────────────────────────

  async getProfiles() {
    const list = await this.mt.get('/ip/hotspot/profile');
    return (Array.isArray(list) ? list : []).map(p => ({
      id:           p['.id'],
      name:         p.name          || '',
      hotspotAddress: p['hotspot-address'] || '',
      dnsName:      p['dns-name']    || '',
      loginBy:      p['login-by']    || 'cookie,http-chap',
      rateLimit:    p['rate-limit']  || '',
      sharedUsers:  p['shared-users'] || '1',
      sessionTimeout: p['session-timeout'] || '',
      idleTimeout:  p['idle-timeout'] || '',
      macCookieTimeout: p['mac-cookie-timeout'] || '3d',
    }));
  }

  async createProfile(data) {
    const body = {
      name:           data.name,
      'rate-limit':   data.rateLimit   || '',
      'shared-users': String(data.sharedUsers || '1'),
      'session-timeout': data.sessionTimeout || '',
      'idle-timeout':  data.idleTimeout || '',
    };
    if (data.dnsName) body['dns-name'] = data.dnsName;
    return this.mt.put('/ip/hotspot/profile', body);
  }

  async updateProfile(id, data) {
    const body = {
      name:           data.name,
      'rate-limit':   data.rateLimit   || '',
      'shared-users': String(data.sharedUsers || '1'),
      'session-timeout': data.sessionTimeout || '',
      'idle-timeout':  data.idleTimeout || '',
    };
    if (data.dnsName !== undefined) body['dns-name'] = data.dnsName;
    return this.mt.patch(`/ip/hotspot/profile/${id}`, body);
  }

  async deleteProfile(id) {
    return this.mt.delete(`/ip/hotspot/profile/${id}`);
  }

  // ─── USER PROFILES (paket) ────────────────────────────────────

  async getUserProfiles() {
    const list = await this.mt.get('/ip/hotspot/user/profile');
    return (Array.isArray(list) ? list : []).map(p => ({
      id:           p['.id'],
      name:         p.name          || '',
      rateLimit:    p['rate-limit']  || '',
      sharedUsers:  p['shared-users'] || '1',
      sessionTimeout: p['session-timeout'] || '',
      idleTimeout:  p['idle-timeout'] || '',
      onLogin:      p['on-login']    || '',
      onLogout:     p['on-logout']   || '',
      addressList:  p['address-list'] || '',
      addMacCookie: p['add-mac-cookie'] === 'yes',
    }));
  }

  async createUserProfile(data) {
    // RouterOS REST API menolak string kosong untuk field time/rate
    // ("invalid time value for argument session-timeout"). Jadi field
    // hanya disertakan kalau benar-benar terisi — sisanya pakai default
    // MikroTik (0 = unlimited).
    const body = { name: data.name };
    const rate    = (data.rateLimit       || '').trim();
    const shared  = (data.sharedUsers     || '').toString().trim();
    const session = (data.sessionTimeout  || '').trim();
    const idle    = (data.idleTimeout     || '').trim();
    const addrLst = (data.addressList     || '').trim();
    if (rate)    body['rate-limit']      = rate;
    if (shared)  body['shared-users']    = shared;
    if (session) body['session-timeout'] = session;
    if (idle)    body['idle-timeout']    = idle;
    if (addrLst) body['address-list']    = addrLst;
    body['add-mac-cookie'] = data.addMacCookie ? 'yes' : 'no';
    return this.mt.put('/ip/hotspot/user/profile', body);
  }

  async updateUserProfile(id, data) {
    // Untuk PATCH, hanya update field yang dikirim user.
    // String kosong → kirim '0' (= reset ke default) bukan '' (yang akan ditolak).
    const body = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.rateLimit       !== undefined) body['rate-limit']      = String(data.rateLimit      || '').trim() || '0';
    if (data.sharedUsers     !== undefined) body['shared-users']    = String(data.sharedUsers    || '1').trim();
    if (data.sessionTimeout  !== undefined) body['session-timeout'] = String(data.sessionTimeout || '').trim() || '0';
    if (data.idleTimeout     !== undefined) body['idle-timeout']    = String(data.idleTimeout    || '').trim() || 'none';
    if (data.addressList     !== undefined) body['address-list']    = String(data.addressList    || '').trim();
    return this.mt.patch(`/ip/hotspot/user/profile/${id}`, body);
  }

  async deleteUserProfile(id) {
    return this.mt.delete(`/ip/hotspot/user/profile/${id}`);
  }

  // ─── USERS (voucher / permanent) ─────────────────────────────

  async getUsers(params = {}) {
    const list = await this.mt.get('/ip/hotspot/user');
    let users = (Array.isArray(list) ? list : []).map(u => ({
      id:        u['.id'],
      name:      u.name     || '',
      password:  u.password || '',
      profile:   u.profile  || 'default',
      server:    u.server   || 'all',
      address:   u.address  || '',
      macAddress: u['mac-address'] || '',
      limitUptime: u['limit-uptime']    || '',
      limitBytesIn:  parseInt(u['limit-bytes-in'])  || 0,
      limitBytesOut: parseInt(u['limit-bytes-out']) || 0,
      limitBytesTotal: parseInt(u['limit-bytes-total']) || 0,
      bytesIn:   parseInt(u['bytes-in'])  || 0,
      bytesOut:  parseInt(u['bytes-out']) || 0,
      uptime:    u.uptime   || '0s',
      disabled:  u.disabled === 'true',
      comment:   u.comment  || '',
    }));
    if (params.profile) users = users.filter(u => u.profile === params.profile);
    if (params.server)  users = users.filter(u => u.server  === params.server || u.server === 'all');
    return users;
  }

  async createUser(data) {
    const body = {
      name:     data.name,
      password: data.password || '',
      profile:  data.profile  || 'default',
      server:   data.server   || 'all',
      comment:  data.comment  || '',
    };
    if (data.address)    body.address     = data.address;
    if (data.macAddress) body['mac-address'] = data.macAddress;
    if (data.limitUptime)      body['limit-uptime']      = data.limitUptime;
    if (data.limitBytesIn)     body['limit-bytes-in']    = String(data.limitBytesIn);
    if (data.limitBytesOut)    body['limit-bytes-out']   = String(data.limitBytesOut);
    if (data.limitBytesTotal)  body['limit-bytes-total'] = String(data.limitBytesTotal);
    return this.mt.put('/ip/hotspot/user', body);
  }

  async updateUser(id, data) {
    const body = {};
    if (data.name     !== undefined) body.name     = data.name;
    if (data.password !== undefined) body.password = data.password;
    if (data.profile  !== undefined) body.profile  = data.profile;
    if (data.server   !== undefined) body.server   = data.server;
    if (data.comment  !== undefined) body.comment  = data.comment;
    if (data.address  !== undefined) body.address  = data.address;
    if (data.disabled !== undefined) body.disabled = data.disabled ? 'true' : 'false';
    if (data.limitUptime    !== undefined) body['limit-uptime']      = data.limitUptime;
    if (data.limitBytesIn   !== undefined) body['limit-bytes-in']    = String(data.limitBytesIn);
    if (data.limitBytesOut  !== undefined) body['limit-bytes-out']   = String(data.limitBytesOut);
    if (data.limitBytesTotal!== undefined) body['limit-bytes-total'] = String(data.limitBytesTotal);
    return this.mt.patch(`/ip/hotspot/user/${id}`, body);
  }

  async deleteUser(id) {
    return this.mt.delete(`/ip/hotspot/user/${id}`);
  }

  async deleteUserBatch(ids) {
    const results = await Promise.allSettled(ids.map(id => this.mt.delete(`/ip/hotspot/user/${id}`)));
    const ok  = results.filter(r => r.status === 'fulfilled').length;
    const err = results.filter(r => r.status === 'rejected').length;
    return { deleted: ok, failed: err };
  }

  async enableUser(id)  { return this.mt.patch(`/ip/hotspot/user/${id}`, { disabled: 'false' }); }
  async disableUser(id) { return this.mt.patch(`/ip/hotspot/user/${id}`, { disabled: 'true'  }); }

  // Bulk generate vouchers — chunked parallel agar batch besar tidak butuh
  // 200+ detik. RouterOS REST handle baik concurrency 5-10 PUT bersamaan.
  // Chunk default 8 — di-tune untuk kompromi antara kecepatan & beban MikroTik.
  async generateVouchers(options) {
    const {
      count = 10, profile = 'default', server = 'all',
      prefix = 'vc', passwordLength = 8, comment = '',
      limitUptime = '', limitBytesTotal = 0,
    } = options;

    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    const genRandom = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    // Pre-generate username/password supaya unique check bisa dilakukan
    // sebelum kirim ke MikroTik. Pakai Set untuk pastikan dalam batch ini
    // tidak ada duplikat (kalau pakai prefix sama + length kecil).
    const items = [];
    const seen  = new Set();
    while (items.length < count) {
      const username = `${prefix}-${genRandom(passwordLength)}`;
      if (seen.has(username)) continue;
      seen.add(username);
      items.push({ username, password: genRandom(passwordLength) });
    }

    const vouchers = [];
    const errors   = [];
    const CHUNK    = 8;  // concurrent PUT per batch

    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const results = await Promise.allSettled(chunk.map(async ({ username, password }) => {
        const body = {
          name: username, password, profile, server,
          comment: comment || `Generated ${new Date().toLocaleDateString('id-ID')}`,
        };
        if (limitUptime)         body['limit-uptime']      = limitUptime;
        if (limitBytesTotal > 0) body['limit-bytes-total'] = String(limitBytesTotal);
        await this.mt.put('/ip/hotspot/user', body);
        return { username, password, profile, server };
      }));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') vouchers.push(r.value);
        else errors.push({ username: chunk[idx].username, error: r.reason?.message || 'Unknown error' });
      });
    }

    return { vouchers, errors, total: count, success: vouchers.length };
  }

  // ─── ACTIVE SESSIONS ─────────────────────────────────────────

  async getActiveSessions() {
    const list = await this.mt.get('/ip/hotspot/active');
    return (Array.isArray(list) ? list : []).map(s => ({
      id:        s['.id'],
      user:      s.user      || '',
      address:   s.address   || '',
      macAddress: s['mac-address'] || '',
      loginBy:   s['login-by'] || '',
      uptime:    s.uptime    || '0s',
      idleTime:  s['idle-time'] || '0s',
      bytesIn:   parseInt(s['bytes-in'])  || 0,
      bytesOut:  parseInt(s['bytes-out']) || 0,
      packetIn:  parseInt(s['packets-in'])  || 0,
      packetOut: parseInt(s['packets-out']) || 0,
      server:    s.server    || '',
      comment:   s.comment   || '',
    }));
  }

  async disconnectSession(id) {
    return this.mt.post(`/ip/hotspot/active/${id}/remove`, {});
  }

  async disconnectSessionBatch(ids) {
    const results = await Promise.allSettled(ids.map(id => this.mt.post(`/ip/hotspot/active/${id}/remove`, {})));
    return { disconnected: results.filter(r => r.status === 'fulfilled').length };
  }

  // ─── HOST LIST (semua device yang pernah connect) ─────────────

  async getHosts() {
    const list = await this.mt.get('/ip/hotspot/host');
    return (Array.isArray(list) ? list : []).map(h => ({
      id:        h['.id'],
      macAddress: h['mac-address'] || '',
      address:   h.address   || '',
      toAddress: h['to-address'] || '',
      server:    h.server    || '',
      bridgePort: h['bridge-port'] || '',
      uptime:    h.uptime    || '',
      authorized: h.authorized === 'true',
      bypassed:  h.bypassed   === 'true',
      comment:   h.comment    || '',
    }));
  }

  // ─── COOKIE / IP BINDING ─────────────────────────────────────

  async getCookies() {
    const list = await this.mt.get('/ip/hotspot/cookie');
    return (Array.isArray(list) ? list : []).map(c => ({
      id:        c['.id'],
      user:      c.user      || '',
      domain:    c.domain    || '',
      address:   c.address   || '',
      macAddress: c['mac-address'] || '',
      expiresAt: c['expires-at']  || '',
      comment:   c.comment   || '',
    }));
  }

  async deleteCookie(id) { return this.mt.delete(`/ip/hotspot/cookie/${id}`); }

  async getIpBindings() {
    const list = await this.mt.get('/ip/hotspot/ip-binding');
    return (Array.isArray(list) ? list : []).map(b => ({
      id:        b['.id'],
      macAddress: b['mac-address'] || '',
      address:   b.address   || '',
      toAddress: b['to-address'] || '',
      server:    b.server    || '',
      type:      b.type      || 'regular',   // regular | bypassed | blocked
      comment:   b.comment   || '',
      disabled:  b.disabled  === 'true',
    }));
  }

  async createIpBinding(data) {
    const body = {
      type:    data.type    || 'regular',
      server:  data.server  || 'all',
      comment: data.comment || '',
    };
    if (data.macAddress) body['mac-address'] = data.macAddress;
    if (data.address)    body.address     = data.address;
    if (data.toAddress)  body['to-address'] = data.toAddress;
    return this.mt.put('/ip/hotspot/ip-binding', body);
  }

  async deleteIpBinding(id) { return this.mt.delete(`/ip/hotspot/ip-binding/${id}`); }

  // ─── STATS / SUMMARY ─────────────────────────────────────────

  async getSummary() {
    const [servers, users, active, hosts] = await Promise.allSettled([
      this.getServers(),
      this.getUsers(),
      this.getActiveSessions(),
      this.getHosts(),
    ]);

    const sv = servers.status  === 'fulfilled' ? servers.value  : [];
    const us = users.status    === 'fulfilled' ? users.value    : [];
    const ac = active.status   === 'fulfilled' ? active.value   : [];
    const hs = hosts.status    === 'fulfilled' ? hosts.value    : [];

    return {
      totalServers:  sv.length,
      totalUsers:    us.length,
      activeUsers:   ac.length,
      disabledUsers: us.filter(u => u.disabled).length,
      totalHosts:    hs.length,
      totalBytesIn:  ac.reduce((s, x) => s + x.bytesIn,  0),
      totalBytesOut: ac.reduce((s, x) => s + x.bytesOut, 0),
    };
  }
}

module.exports = HotspotService;
