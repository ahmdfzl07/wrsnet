/**
 * WAService.js - Baileys Multi Session Manager
 */

let makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Boom, Browsers;
let baileysReady = false;

try {
  const baileys = require('@whiskeysockets/baileys');
  makeWASocket              = baileys.default;
  DisconnectReason          = baileys.DisconnectReason;
  useMultiFileAuthState     = baileys.useMultiFileAuthState;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  Browsers                  = baileys.Browsers;
  Boom = require('@hapi/boom').Boom;
  baileysReady = true;
} catch (e) {
  console.error('[WAService] Baileys tidak tersedia:', e.message);
}

const QRCode = require('qrcode');
const path   = require('path');
const fs     = require('fs');
const logger = require('../utils/logger');

const sessions = new Map();  // sessionId -> sock
const qrStore  = new Map();  // sessionId -> { raw, image, timestamp }

const AUTH_DIR = path.join(__dirname, '../../uploads/wa_auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

function getAuthDir(sid) {
  const d = path.join(AUTH_DIR, sid);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function clearStaleAuth(sessionId) {
  const authDir = getAuthDir(sessionId);
  const credsPath = path.join(authDir, 'creds.json');
  if (!fs.existsSync(credsPath)) return false;
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    // creds dengan registered: false = belum pernah berhasil login, harus dihapus
    if (creds.registered === false) {
      logger.warn('[WA] Detected stale/unregistered creds for ' + sessionId + ', clearing auth dir...');
      fs.rmSync(authDir, { recursive: true, force: true });
      fs.mkdirSync(authDir, { recursive: true });
      return true;
    }
  } catch (e) {
    // creds.json korup, hapus juga
    logger.warn('[WA] Corrupt creds.json for ' + sessionId + ', clearing...');
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
    return true;
  }
  return false;
}

async function createSession(sessionId, io, onMessage, isReconnect) {
  if (!baileysReady) {
    logger.error('[WA] Baileys belum terinstall');
    if (io) io.emit('wa:status:' + sessionId, { status: 'disconnected' });
    return null;
  }
  if (sessions.has(sessionId)) return sessions.get(sessionId);

  // Bersihkan creds stale sebelum mulai — hanya saat fresh start, bukan saat reconnect setelah scan
  if (!isReconnect) clearStaleAuth(sessionId);

  const { state, saveCreds } = await useMultiFileAuthState(getAuthDir(sessionId));
  let version;
  try {
    const result = await fetchLatestBaileysVersion();
    version = result.version;
  } catch (e) {
    logger.warn('[WA] Gagal fetch versi Baileys, pakai fallback: ' + e.message);
    version = [2, 3000, 1023333]; // fallback versi stabil
  }
  logger.info('[WA] Starting session ' + sessionId + ' v' + version.join('.'));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '20.0.04'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 3,
  });

  sessions.set(sessionId, sock);

  let isNewLogin = false; // track apakah QR baru saja di-scan

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (update.isNewLogin) isNewLogin = true;

    if (qr) {
      console.log('\n[WA] QR ready for ' + sessionId + ' — scan now!\n');
      let qrImage = null;
      try {
        qrImage = await QRCode.toDataURL(qr, { width: 256, margin: 1, errorCorrectionLevel: 'H' });
      } catch (e) {}
      qrStore.set(sessionId, { raw: qr, image: qrImage, ts: Date.now() });
      if (io) io.emit('wa:qr:' + sessionId, { qrImage, ts: Date.now() });
      try {
        const { WaSession } = require('../models');
        await WaSession.update({ qr_code: qr, status: 'connecting' }, { where: { session_id: sessionId } });
      } catch (e) {}
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      logger.info('[WA] Session ' + sessionId + ' closed. LoggedOut:' + loggedOut + ' code:' + code);
      sessions.delete(sessionId);
      qrStore.delete(sessionId);

      // code 515 = WhatsApp minta restart protocol
      if (code === 515) {
        const delay = isNewLogin ? 2000 : 15000; // setelah scan: reconnect cepat; otherwise lebih lama
        logger.info('[WA] Code 515 for ' + sessionId + ' (isNewLogin:' + isNewLogin + '), reconnecting in ' + delay + 'ms...');
        const wasNewLogin = isNewLogin;
        isNewLogin = false;
        setTimeout(() => createSession(sessionId, io, onMessage, wasNewLogin), delay);
        return;
      }

      try {
        const { WaSession } = require('../models');
        await WaSession.update({ status: 'disconnected', qr_code: null }, { where: { session_id: sessionId } });
      } catch (e) {}
      if (io) io.emit('wa:status:' + sessionId, { status: 'disconnected' });

      // Notifikasi session terputus
      try {
        const NotifSvc = require('./NotificationService');
        const reason = loggedOut ? 'Logout dari perangkat WA' : `Error code: ${code||'unknown'}`;
        await NotifSvc.pushAll({
          type:      'wa_disconnected',
          title:     `WA Session Terputus: ${sessionId}`,
          message:   reason + (loggedOut ? ' — Perlu scan QR ulang' : ' — Mencoba reconnect...'),
          severity:  loggedOut ? 'critical' : 'warning',
          action_url: '/whatsapp'
        });
      } catch(ne) {}

      if (!loggedOut) {
        logger.info('[WA] Reconnecting ' + sessionId + ' in 5s...');
        setTimeout(() => createSession(sessionId, io, onMessage, true), 5000);
      } else {
        // loggedOut = WhatsApp reject sesi ini → hapus creds lama dan generate QR baru
        logger.info('[WA] Logged out ' + sessionId + ', clearing auth and re-generating QR in 3s...');
        try { fs.rmSync(getAuthDir(sessionId), { recursive: true, force: true }); } catch (e) {}
        setTimeout(() => createSession(sessionId, io, onMessage), 3000);
      }
    }

    if (connection === 'open') {
      // Ekstrak nomor HP dari user.id: format "628xxx:50@s.whatsapp.net"
      // split ':')[0] mengambil bagian nomor, strip non-digit
      const rawId = sock.user?.id || '';
      const phone = rawId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || '';
      logger.info('[WA] Session ' + sessionId + ' connected! Phone: ' + phone + ' (raw: ' + rawId + ')');
      qrStore.delete(sessionId);
      try {
        const { WaSession } = require('../models');
        await WaSession.update(
          { status: 'connected', qr_code: null, phone_number: phone, last_seen: new Date() },
          { where: { session_id: sessionId } }
        );
      } catch (e) {}
      if (io) io.emit('wa:status:' + sessionId, { status: 'connected', phone });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── ACK / Delivery receipt tracking ─────────────────────────
  // Baileys emit 'messages.update' setiap kali status pesan berubah.
  // Mapping status code Baileys → status enum WaMessage:
  //   0 ERROR       → 'failed'
  //   1 PENDING     → 'pending'
  //   2 SERVER_ACK  → 'sent'       (centang 1 — sampai ke server WA)
  //   3 DELIVERY_ACK→ 'delivered'  (centang 2 abu — sampai ke HP penerima)
  //   4 READ        → 'read'       (centang 2 biru — sudah dibaca)
  //   5 PLAYED      → 'read'       (untuk voice note yang sudah diputar)
  const ACK_MAP = { 0:'failed', 1:'pending', 2:'sent', 3:'delivered', 4:'read', 5:'read' };
  sock.ev.on('messages.update', async (updates) => {
    try {
      const { WaMessage } = require('../models');
      for (const u of updates || []) {
        if (!u.key || !u.key.fromMe) continue; // hanya track pesan kita yg dikirim
        const statusCode = u.update?.status;
        if (statusCode == null) continue;
        const newStatus = ACK_MAP[statusCode];
        if (!newStatus) continue;
        const waId = u.key.id;
        if (!waId) continue;

        // Update DB — hanya naik level, tidak boleh turun (delivered → sent jangan)
        const levels = { pending:0, sent:1, delivered:2, read:3, failed:-1 };
        const row = await WaMessage.findOne({
          where: { session_id: sessionId, wa_message_id: waId, direction: 'outbound' }
        });
        if (!row) continue;
        const curLevel = levels[row.status] ?? 0;
        const newLevel = levels[newStatus] ?? 0;
        if (newStatus !== 'failed' && newLevel <= curLevel) continue; // sudah di status lebih tinggi

        await row.update({ status: newStatus });

        if (io) io.emit('wa:ack:' + sessionId, {
          wa_message_id: waId,
          status: newStatus,
          to: u.key.remoteJid || '',
          ts: Date.now()
        });
      }
    } catch (e) {
      logger.error('[WA] messages.update handler error: ' + e.message);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid || '';

      // ── Filter: hanya proses chat pribadi ──────────────────
      // Skip grup (@g.us)
      if (remoteJid.endsWith('@g.us'))          continue;
      // Skip WA Status / Stories (status@broadcast)
      if (remoteJid === 'status@broadcast')     continue;
      // Skip broadcast list
      if (remoteJid.endsWith('@broadcast'))     continue;
      // Skip newsletter / channel
      if (remoteJid.endsWith('@newsletter'))    continue;
      // Skip reaction messages
      if (msg.message?.reactionMessage)         continue;
      // Skip protocol/ephemeral messages
      if (msg.message?.protocolMessage)         continue;
      if (msg.message?.ephemeralMessage)        continue;
      // ────────────────────────────────────────────────────────
      
      // Ekstrak nomor dari JID
      let from = remoteJid.split('@')[0].split(':')[0];
      // Simpan raw JID untuk reply
      const replyJid = remoteJid;
      
      // Jika format @lid, coba resolve ke nomor HP asli
      if (remoteJid.includes('@lid')) {
        try {
          // Coba dari verifiedBizAccount atau bizPrivacyStatus
          const phoneHint = msg.verifiedBizAccount?.phoneNumber ||
                           msg.bizPrivacyStatus?.phoneNumber || null;
          if (phoneHint) {
            from = phoneHint.replace(/[^0-9]/g, '');
          } else {
            // Coba resolve via sock.onWhatsApp (async, mungkin lambat)
            try {
              const result = await sock.onWhatsApp(remoteJid);
              if (result && result[0]?.jid) {
                const resolvedJid = result[0].jid;
                if (!resolvedJid.includes('@lid')) {
                  from = resolvedJid.split('@')[0].split(':')[0];
                }
              }
            } catch(e2) {
              // onWhatsApp gagal, keep LID sebagai identifier
            }
          }
        } catch(e) {}
      }
      
      // ── Ekstrak konten pesan (text atau media) ──
      const msgContent = msg.message || {};
      const text = msgContent.conversation
        || msgContent.extendedTextMessage?.text
        || msgContent.imageMessage?.caption
        || msgContent.videoMessage?.caption
        || msgContent.documentMessage?.caption
        || '';

      // Deteksi tipe pesan
      let msgType = 'text';
      if (msgContent.imageMessage)    msgType = 'image';
      else if (msgContent.videoMessage)    msgType = 'video';
      else if (msgContent.documentMessage) msgType = 'document';
      else if (msgContent.audioMessage || msgContent.pttMessage) msgType = 'audio';
      else if (msgContent.stickerMessage) msgType = 'sticker';

      // Skip jika tidak ada konten sama sekali
      if (!text && msgType === 'text') continue;
      if (!from) continue;

      try {
        const { WaMessage, WaAutoReply, WaSession, Customer } = require('../models');
        const { Op } = require('sequelize');
        const session  = await WaSession.findOne({ where: { session_id: sessionId } });

        // Multi-format phone lookup
        let customer = null;
        if (from && from.length >= 9) {
          const last9  = from.slice(-9);
          const last10 = from.slice(-10);
          const from0  = from.startsWith('62') ? '0' + from.slice(2) : null;
          const orConds = [
            { phone: from },
            { phone: { [Op.like]: '%' + last9 } },
            { phone: { [Op.like]: '%' + last10 } },
          ];
          if (from0) orConds.push({ phone: from0 });
          customer = await Customer.findOne({ where: { [Op.or]: orConds } });
        }

        // ── Download media jika ada ──
        let mediaUrl = null;
        if (['image','video','document','audio','sticker'].includes(msgType)) {
          try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(
              msg, 'buffer', {},
              {
                logger: require('pino')({ level: 'silent' }),
                reuploadRequest: sock.updateMediaMessage
                  ? sock.updateMediaMessage.bind(sock)
                  : undefined
              }
            );
            if (buffer) {
              const ext = msgType === 'image' ? 'jpg'
                : msgType === 'video' ? 'mp4'
                : msgType === 'audio' ? 'ogg'
                : msgType === 'sticker' ? 'webp'
                : (msgContent.documentMessage?.fileName?.split('.').pop() || 'bin');
              const fname = 'wa_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
              const mediaDir = path.join(AUTH_DIR, '..', 'media');
              if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
              fs.writeFileSync(path.join(mediaDir, fname), buffer);
              mediaUrl = '/uploads/media/' + fname;
            }
          } catch(me) {
            logger.warn('[WA] Media download failed: ' + me.message);
          }
        }

        // Simpan pushName untuk kontak LID
        const pushName = msg.pushName || '';
        const jidSuffix = replyJid.includes('@lid') ? '|jid:' + replyJid + (pushName ? '|name:' + pushName : '') : '';

        // Push notifikasi WA masuk
        try {
          const NotifSvc = require('./NotificationService');
          const sName = session?.name || sessionId;
          await NotifSvc.notifyWaIncoming(from, text || ('[' + msgType + ']'), sName);
        } catch(ne) {}

        await WaMessage.create({
          session_id: sessionId,
          direction: 'inbound',
          from_number: from,
          to_number: session?.phone_number || '',
          message: text || ('[' + msgType + ']'),
          message_type: msgType,
          media_url: mediaUrl,
          status: 'delivered',
          wa_message_id: (msg.key.id || '') + jidSuffix,
          push_name: pushName || null,
          customer_id: customer?.id || null
        });

        if (io) io.emit('wa:message:' + sessionId, {
          direction: 'inbound', from, text: text || ('[' + msgType + ']'),
          message_type: msgType, media_url: mediaUrl, pushName,
          replyJid: replyJid.includes('@lid') ? replyJid : null,
          customer: customer ? { id: customer.id, name: customer.name } : null,
          timestamp: new Date()
        });

        if (session?.auto_reply_enabled) {
          const rules = await WaAutoReply.findAll({ where: { session_id: sessionId, is_active: true } });
          for (const rule of rules) {
            const lower = text.toLowerCase(), kw = rule.keyword.toLowerCase();
            const hit = rule.match_type === 'exact' ? lower === kw
              : rule.match_type === 'startswith' ? lower.startsWith(kw)
              : lower.includes(kw);
            if (hit) {
              await sendMessage(sessionId, from, rule.reply_message, io);
              await rule.increment('hit_count');
              break;
            }
          }
        }
      } catch (e) {
        logger.error('[WA] Message handler error:', e.message);
      }

      if (typeof onMessage === 'function') onMessage(sessionId, from, text, msg);
    }
  });

  return sock;
}

async function sendMessage(sessionId, to, message, io) {
  const sock = sessions.get(sessionId);
  if (!sock) throw new Error('Session ' + sessionId + ' not connected');
  let jid;
  if (to.includes('@')) {
    jid = to; // sudah format JID lengkap (termasuk @lid atau @s.whatsapp.net)
  } else {
    let digits = to.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    // Nomor > 13 digit kemungkinan LID, gunakan @lid
    if (digits.length > 13) {
      jid = digits + '@lid';
    } else {
      jid = digits + '@s.whatsapp.net';
    }
  }
  const result = await sock.sendMessage(jid, { text: message });
  try {
    const { WaMessage, WaSession, Customer } = require('../models');
    const { Op } = require('sequelize');
    const session  = await WaSession.findOne({ where: { session_id: sessionId } });
    // Multi-format phone lookup
    let customer = null;
    const toClean = to.replace(/[^0-9]/g, '');
    if (toClean.length >= 9) {
      const last9  = toClean.slice(-9);
      const last10 = toClean.slice(-10);
      const to0    = toClean.startsWith('62') ? '0' + toClean.slice(2) : null;
      const orConds = [
        { phone: toClean },
        { phone: { [Op.like]: '%' + last9 } },
        { phone: { [Op.like]: '%' + last10 } },
      ];
      if (to0) orConds.push({ phone: to0 });
      customer = await Customer.findOne({ where: { [Op.or]: orConds } });
    }
    await WaMessage.create({
      session_id: sessionId, direction: 'outbound',
      from_number: session?.phone_number || '', to_number: to,
      message, message_type: 'text', status: 'sent',
      wa_message_id: result?.key?.id || null,
      customer_id: customer?.id || null, sent_at: new Date()
    });
    if (io) io.emit('wa:message:' + sessionId, {
      direction: 'outbound', to, text: message,
      wa_message_id: result?.key?.id || null,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      timestamp: new Date()
    });
  } catch (e) { logger.error('[WA] Save outbound error:', e.message); }
  return result;
}

// ── Send media (image / video / audio / document) ─────────────
// opts: { to, mediaPath, mediaType, caption, mimeType, fileName }
//   mediaType: 'image' | 'video' | 'audio' | 'document'
async function sendMedia(sessionId, opts, io) {
  const sock = sessions.get(sessionId);
  if (!sock) throw new Error('Session ' + sessionId + ' not connected');
  const { to, mediaPath, mediaType, caption, mimeType, fileName } = opts;
  if (!to || !mediaPath || !mediaType) throw new Error('to, mediaPath, mediaType wajib');
  if (!fs.existsSync(mediaPath)) throw new Error('File tidak ditemukan: ' + mediaPath);

  // Resolve JID
  let jid;
  if (to.includes('@')) {
    jid = to;
  } else {
    let digits = to.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    jid = (digits.length > 13) ? digits + '@lid' : digits + '@s.whatsapp.net';
  }

  // Build Baileys payload sesuai media type
  let payload;
  if (mediaType === 'image') {
    payload = { image: fs.readFileSync(mediaPath), caption: caption || undefined, mimetype: mimeType || 'image/jpeg' };
  } else if (mediaType === 'video') {
    payload = { video: fs.readFileSync(mediaPath), caption: caption || undefined, mimetype: mimeType || 'video/mp4' };
  } else if (mediaType === 'audio') {
    payload = { audio: fs.readFileSync(mediaPath), mimetype: mimeType || 'audio/mp4', ptt: false };
  } else {
    // document (catch-all)
    payload = {
      document: fs.readFileSync(mediaPath),
      mimetype: mimeType || 'application/octet-stream',
      fileName: fileName || path.basename(mediaPath),
      caption: caption || undefined
    };
  }

  const result = await sock.sendMessage(jid, payload);

  // Simpan ke DB + emit socket
  try {
    const { WaMessage, WaSession, Customer } = require('../models');
    const { Op } = require('sequelize');
    const session = await WaSession.findOne({ where: { session_id: sessionId } });

    // Resolve customer
    let customer = null;
    const toClean = to.replace(/[^0-9]/g, '');
    if (toClean.length >= 9) {
      const last9 = toClean.slice(-9), last10 = toClean.slice(-10);
      const to0 = toClean.startsWith('62') ? '0' + toClean.slice(2) : null;
      const orConds = [
        { phone: toClean },
        { phone: { [Op.like]: '%' + last9 } },
        { phone: { [Op.like]: '%' + last10 } },
      ];
      if (to0) orConds.push({ phone: to0 });
      customer = await Customer.findOne({ where: { [Op.or]: orConds } });
    }

    // Move file ke /uploads/media supaya URL konsisten dengan inbound, lalu set mediaUrl
    const mediaDir = path.join(AUTH_DIR, '..', 'media');
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
    const baseName = path.basename(mediaPath);
    const finalPath = path.join(mediaDir, baseName);
    if (path.resolve(mediaPath) !== path.resolve(finalPath)) {
      try { fs.renameSync(mediaPath, finalPath); }
      catch { fs.copyFileSync(mediaPath, finalPath); try { fs.unlinkSync(mediaPath); } catch(_) {} }
    }
    const mediaUrl = '/uploads/media/' + baseName;

    // Map ke enum message_type di model (hanya accept: text, image, document, audio, template)
    // 'video' & 'sticker' di-fallback ke 'image' agar lewat enum (renderer frontend lihat media_url & tag)
    const dbMsgType = ['image','document','audio'].includes(mediaType)
      ? mediaType
      : (mediaType === 'video' ? 'image' : 'document');

    await WaMessage.create({
      session_id: sessionId, direction: 'outbound',
      from_number: session?.phone_number || '', to_number: to,
      message: caption || ('[' + mediaType + ']'),
      message_type: dbMsgType, status: 'sent',
      wa_message_id: result?.key?.id || null,
      media_url: mediaUrl,
      customer_id: customer?.id || null, sent_at: new Date()
    });

    if (io) io.emit('wa:message:' + sessionId, {
      direction: 'outbound', to,
      text: caption || '',
      message_type: dbMsgType,
      media_url: mediaUrl,
      wa_message_id: result?.key?.id || null,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      timestamp: new Date()
    });
  } catch (e) {
    logger.error('[WA] sendMedia save error: ' + e.message);
  }

  return result;
}

async function sendBroadcast(sessionId, numbers, message, io) {
  const res = { success: 0, failed: 0, errors: [] };
  for (const n of numbers) {
    try {
      await sendMessage(sessionId, n, message, io);
      res.success++;
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
    } catch (e) {
      res.failed++;
      res.errors.push({ number: n, error: e.message });
    }
  }
  return res;
}

async function disconnectSession(sessionId) {
  const sock = sessions.get(sessionId);
  sessions.delete(sessionId); // hapus dulu dari map agar tidak ada reconnect loop
  qrStore.delete(sessionId);
  if (sock) {
    try { sock.ev.removeAllListeners(); } catch (e) {}
    try { await sock.logout(); } catch (e) {}
    try { sock.end(); } catch (e) {}
    try { sock.ws?.close(); } catch (e) {}
  }
  try { fs.rmSync(getAuthDir(sessionId), { recursive: true, force: true }); } catch (e) {}
}

function getSessionStatus(sessionId) {
  const sock = sessions.get(sessionId);
  if (!sock) return 'disconnected';
  return sock.user ? 'connected' : 'connecting';
}

function isConnected(sessionId) {
  return sessions.has(sessionId) && !!sessions.get(sessionId)?.user;
}

function getSessions() { return sessions; }

async function restoreAllSessions(io) {
  if (!baileysReady) { logger.warn('[WA] Skip restore — Baileys not ready'); return; }
  await new Promise(r => setTimeout(r, 3000));
  try {
    const { WaSession } = require('../models');
    const list = await WaSession.findAll({ where: { is_active: true, status: 'connected' } });
    for (const s of list) {
      createSession(s.session_id, io, null).catch(e => logger.error('[WA] Restore failed:', e.message));
      await new Promise(r => setTimeout(r, 1000));
    }
    logger.info('[WA] Restored ' + list.length + ' sessions');
  } catch (e) { logger.error('[WA] restoreAllSessions error:', e.message); }
}

async function getProfilePicture(sessionId, number) {
  const sock = sessions.get(sessionId);
  if (!sock) return null;
  try {
    let digits = number.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    const jid = digits.length > 13 ? digits + '@lid' : digits + '@s.whatsapp.net';
    const url = await sock.profilePictureUrl(jid, 'image');
    return url || null;
  } catch(e) {
    // Contact may have hidden their profile picture
    return null;
  }
}

module.exports = { createSession, sendMessage, sendMedia, sendBroadcast, disconnectSession, getSessionStatus, isConnected, getSessions, restoreAllSessions, qrStore, getProfilePicture };