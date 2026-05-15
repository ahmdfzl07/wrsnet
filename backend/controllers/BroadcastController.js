/**
 * BroadcastController.js
 * WA Broadcast dengan sistem anti-block (interval delay per pesan)
 */
const { WaBroadcast, WaTemplate, Customer, Package, WaSession, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const logger = require('../utils/logger');

// ── Helpers ──────────────────────────────────────────────────
function normalizePhone(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
}

function renderTemplate(msg, cust) {
  return (msg || '')
    .replace(/\{nama\}/g,   cust.name || '')
    .replace(/\{cid\}/g,    cust.customer_id || cust.cid || '')
    .replace(/\{paket\}/g,  cust.package?.name || cust.paket || '–')
    .replace(/\{harga\}/g,  'Rp ' + Number(cust.package?.price || cust.harga || 0).toLocaleString('id-ID'))
    .replace(/\{phone\}/g,  cust.phone || '');
}

async function getTargets(bc) {
  const filter = bc.target_filter || {};
  let where = { phone: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } };

  switch (bc.target_type) {
    case 'active':
      where.status = 'active'; break;
    case 'overdue':
      where.status = 'active';
      // Cari yang punya invoice overdue/unpaid
      const overdueIds = await sequelize.query(
        "SELECT DISTINCT customer_id FROM invoices WHERE status IN ('unpaid','overdue') AND due_date < CURDATE()",
        { type: sequelize.QueryTypes.SELECT }
      );
      where.id = { [Op.in]: overdueIds.map(r => r.customer_id) };
      break;
    case 'by_package':
      if (filter.package_id) where.package_id = filter.package_id;
      break;
    case 'custom':
      if (filter.mode === 'manual' && filter.phones?.length) {
        // Nomor manual — kembalikan langsung tanpa query customer
        return filter.phones.map(p => ({
          id: null, name: 'Pelanggan', customer_id: '', phone: normalizePhone(p),
          package: null
        }));
      }
      if (filter.customer_ids?.length) where.id = { [Op.in]: filter.customer_ids };
      break;
    // 'all' → no filter
  }

  const rows = await Customer.findAll({
    where,
    include: [{ model: Package, as: 'package', attributes: ['name','price'], required: false }],
    attributes: ['id','name','customer_id','phone','status'],
    order: [['name','ASC']]
  });
  return rows.map(r => r.toJSON());
}

async function countTargets(targetType, filter) {
  try {
    if (targetType === 'custom' && filter?.mode === 'manual') return (filter.phones||[]).length;
    if (targetType === 'custom' && filter?.customer_ids) return filter.customer_ids.length;
    const where = { phone: { [Op.ne]: '' } };
    if (targetType === 'active')   where.status = 'active';
    if (targetType === 'overdue')  { where.status = 'active'; }
    if (targetType === 'by_package' && filter?.package_id) where.package_id = filter.package_id;
    return await Customer.count({ where });
  } catch(e) { return 0; }
}

class BroadcastController {

  // ── Stats ────────────────────────────────────────────────────
  async stats(req, res) {
    try {
      const [total, completed, running, scheduled, draft, failed, cancelled] = await Promise.all([
        WaBroadcast.count(),
        WaBroadcast.count({ where: { status: 'completed' } }),
        WaBroadcast.count({ where: { status: 'running' } }),
        WaBroadcast.count({ where: { status: 'scheduled' } }),
        WaBroadcast.count({ where: { status: 'draft' } }),
        WaBroadcast.count({ where: { status: 'failed' } }),
        WaBroadcast.count({ where: { status: 'cancelled' } }),
      ]);
      const [sentRow] = await sequelize.query(
        "SELECT COALESCE(SUM(total_sent),0) AS total FROM wa_broadcast",
        { type: sequelize.QueryTypes.SELECT }
      );
      res.json({ success: true, data: { total, completed, running, scheduled, draft, failed, cancelled, total_sent: parseInt(sentRow?.total||0) } });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── List ─────────────────────────────────────────────────────
  async list(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const where = {};
      if (status) where.status = status;
      const offset = (parseInt(page)-1) * parseInt(limit);
      const { count, rows } = await WaBroadcast.findAndCountAll({
        where, offset, limit: parseInt(limit),
        order: [['created_at','DESC']]
      });
      // Attach creator name
      const userIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))];
      let userMap = {};
      if (userIds.length) {
        const users = await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id','name'] });
        users.forEach(u => { userMap[u.id] = u.name; });
      }
      const data = rows.map(r => ({ ...r.toJSON(), created_by_name: userMap[r.created_by] || '–' }));
      res.json({ success: true, data, total: count, page: parseInt(page), limit: parseInt(limit) });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── Create ───────────────────────────────────────────────────
  async create(req, res) {
    try {
      const { title, template_id, message: msgBody, target_type, target_filter,
              scheduled_at, send_interval, manual_numbers, customer_ids } = req.body;

      if (!title || !msgBody) return res.status(400).json({ success: false, message: 'Judul dan pesan wajib diisi' });

      let filter = target_filter || null;
      let finalType = target_type || 'all';

      // Handle manual numbers
      if (target_type === 'custom' && manual_numbers) {
        const phones = manual_numbers.split(/[\n,;]+/)
          .map(p => normalizePhone(p.trim())).filter(p => p.length >= 10);
        if (!phones.length) return res.status(400).json({ success: false, message: 'Tidak ada nomor valid' });
        filter = { mode: 'manual', phones: [...new Set(phones)] };
      }
      // Handle selected customer IDs
      if (target_type === 'custom' && customer_ids?.length) {
        const custs = await Customer.findAll({ where: { id: { [Op.in]: customer_ids } }, attributes: ['phone'] });
        const phones = custs.map(c => normalizePhone(c.phone)).filter(p => p.length >= 10);
        filter = { mode: 'custom_select', phones: [...new Set(phones)], customer_ids };
      }

      const interval  = Math.max(8, parseInt(send_interval) || 10);
      const totalTgt  = await countTargets(finalType, filter);
      const status    = scheduled_at ? 'scheduled' : 'draft';

      const bc = await WaBroadcast.create({
        title, template_id: template_id || null,
        message: msgBody, target_type: finalType,
        target_filter: filter,
        status, scheduled_at: scheduled_at || null,
        total_targets: totalTgt,
        send_interval: interval,
        created_by: req.user?.id || null
      });

      res.status(201).json({ success: true, data: bc, message: `Broadcast dibuat dengan ${totalTgt} target` });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── Send Now (draft → scheduled → run) ───────────────────────
  async sendNow(req, res) {
    try {
      const bc = await WaBroadcast.findByPk(req.params.id);
      if (!bc) return res.status(404).json({ success: false, message: 'Broadcast tidak ditemukan' });
      if (!['draft','scheduled'].includes(bc.status)) {
        return res.status(400).json({ success: false, message: `Tidak bisa kirim broadcast berstatus ${bc.status}` });
      }
      // Jalankan async tanpa tunggu
      bc.update({ status: 'running', scheduled_at: new Date(), started_at: new Date() });
      this._runBroadcast(bc.id).catch(e => logger.error('[Broadcast] run error:', e.message));
      res.json({ success: true, message: 'Broadcast mulai dijalankan' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── Cancel ───────────────────────────────────────────────────
  async cancel(req, res) {
    try {
      const bc = await WaBroadcast.findByPk(req.params.id);
      if (!bc) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });
      if (!['draft','scheduled','running'].includes(bc.status)) {
        return res.status(400).json({ success: false, message: 'Tidak bisa dibatalkan' });
      }
      await bc.update({ status: 'cancelled' });
      res.json({ success: true, message: 'Broadcast dibatalkan' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── Delete ───────────────────────────────────────────────────
  async destroy(req, res) {
    try {
      const bc = await WaBroadcast.findByPk(req.params.id);
      if (!bc) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });
      await bc.destroy();
      res.json({ success: true, message: 'Broadcast dihapus' });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ── Count targets preview ────────────────────────────────────
  async previewCount(req, res) {
    try {
      const { target_type, package_id, manual_numbers } = req.query;
      let filter = null;
      if (target_type === 'by_package' && package_id) filter = { package_id: parseInt(package_id) };
      if (target_type === 'custom' && manual_numbers) {
        const phones = manual_numbers.split(/[\n,;]+/).map(p => normalizePhone(p.trim())).filter(p => p.length >= 10);
        filter = { mode: 'manual', phones };
      }
      const count = await countTargets(target_type || 'all', filter);
      res.json({ success: true, count });
    } catch(e) { res.json({ success: true, count: 0 }); }
  }

  // ── Run broadcast (anti-block engine) ────────────────────────
  async _runBroadcast(broadcastId) {
    const bc = await WaBroadcast.findByPk(broadcastId);
    if (!bc || bc.status === 'cancelled') return;

    const WAService = require('../services/WAService');
    const session   = await WaSession.findOne({ where: { status: 'connected' } });
    if (!session || !WAService.isConnected(session.session_id)) {
      await bc.update({ status: 'failed' });
      logger.error(`[Broadcast #${bc.id}] No WA session connected`);
      return;
    }

    const targets = await getTargets(bc);
    await bc.update({ total_targets: targets.length, started_at: new Date() });

    if (!targets.length) {
      await bc.update({ status: 'completed', completed_at: new Date() });
      return;
    }

    const interval = Math.max(8, bc.send_interval || 10) * 1000; // convert to ms
    let sent = 0, failed = 0;

    logger.info(`[Broadcast #${bc.id}] Starting: ${targets.length} targets, interval ${bc.send_interval}s`);

    for (const cust of targets) {
      // Cek apakah dibatalkan di tengah jalan
      const fresh = await WaBroadcast.findByPk(bc.id, { attributes: ['status'] });
      if (fresh?.status === 'cancelled') {
        logger.info(`[Broadcast #${bc.id}] Cancelled mid-run at ${sent} sent`);
        break;
      }

      try {
        const phone = normalizePhone(cust.phone);
        if (!phone) { failed++; continue; }
        const msg = renderTemplate(bc.message, cust);
        await WAService.sendMessage(session.session_id, phone, msg, null);
        sent++;
        // Update progress tiap 10 pesan
        if (sent % 10 === 0) await bc.update({ total_sent: sent });
        logger.debug(`[Broadcast #${bc.id}] Sent ${sent}/${targets.length} → ${phone}`);
      } catch(e) {
        failed++;
        logger.warn(`[Broadcast #${bc.id}] Failed to send: ${e.message}`);
      }

      // ── ANTI-BLOCK: delay antar pesan + random jitter ─────
      // Base interval + random 0-2 detik jitter untuk menghindari pattern
      if (sent + failed < targets.length) {
        const jitter = Math.floor(Math.random() * 2000);
        await new Promise(r => setTimeout(r, interval + jitter));
      }
    }

    await bc.update({
      status: 'completed',
      total_sent: sent,
      total_failed: failed,
      completed_at: new Date()
    });
    logger.info(`[Broadcast #${bc.id}] Done: ${sent} sent, ${failed} failed`);
  }
}

module.exports = new BroadcastController();
