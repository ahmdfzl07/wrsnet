'use strict';

/**
 * CronService.js
 * ─────────────────────────────────────────────────────────────────────
 * Semua cron job aplikasi dalam satu service.
 *
 * Job yang berjalan:
 *  - Overdue invoice         → setiap hari jam 01:00
 *  - Auto isolir             → setiap jam
 *  - Cleanup traffic data    → setiap hari jam 03:00
 *  - Cleanup device logs     → setiap Minggu jam 04:00
 *  - Queue traffic history   → setiap 1 menit
 *  - Device traffic poll     → setiap 1 menit (MikroTik API) ← BARU
 *  - GenieACS ONT poll       → setiap 5 menit (jika GenieACS aktif)
 *  - OLT SNMP poll           → setiap 5 menit (jika OLT dikonfigurasi)  ← BARU
 *  - Cleanup signal history  → setiap hari jam 03:30
 *  - WA Reminder             → setiap 1 menit (cek jadwal)
 *  - WA Report               → setiap 1 menit (cek jadwal)
 *  - Broadcast Scheduler     → setiap 1 menit
 *  - Daily Alerts            → setiap hari jam 07:00
 * ─────────────────────────────────────────────────────────────────────
 */

const cron   = require('node-cron');
const fs     = require('fs');
const path   = require('path');
const moment = require('moment');
const DemoResetService = require('../utils/DemoResetService');
const DemoController = require('../controllers/DemoController');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const ConfigCrypto = require('../utils/ConfigCrypto');
const { getCompanyName } = require('../utils/companyInfo');

// Models yang dibutuhkan
const { QueueHistory, Invoice, Customer, TrafficData, DeviceLog } = require('../models');

// Path config OLT
const OLT_CONFIG_PATH = path.join(__dirname, '../../uploads/olt_config.json');

class CronService {
  constructor() {
    this.jobs    = [];
    this.io      = null;

    // Jobs yang berjalan di constructor (bukan di start())
    cron.schedule('0 7 * * *', () => this._runDailyAlerts());
    cron.schedule('0 * * * *', () => this._runAutoIsolir());

    // Jalankan daily alerts sekali saat startup (delay 5 detik)
    setTimeout(() => this._runDailyAlerts(), 5000);
  }

  // ── Startup ─────────────────────────────────────────────────────────
  start(io = null) {

    // ── Demo account auto-reset (tiap jam) ───────────────────────────
    try {
      const cron = require('node-cron');
      cron.schedule('0 * * * *', () => {
        DemoResetService.reset().catch(e => console.error('[DemoReset]', e));
      });
      // Cleanup demo ephemeral yang expired — tiap 10 menit
      cron.schedule('*/10 * * * *', () => {
        DemoController.cleanupExpired().catch(e => console.error('[DemoCleanup]', e));
      });
      console.log('[Cron] Demo reset & cleanup jobs registered');
    } catch (e) {
      console.error('[Cron] Failed to register demo jobs:', e);
    }

    this.io = io;

    // ── 1. Mark overdue invoices (setiap hari jam 01:00) ─────────────
    this.jobs.push(cron.schedule('0 1 * * *', async () => {
      try {
        const today = moment().format('YYYY-MM-DD');
        const [updated] = await Invoice.update(
          { status: 'overdue' },
          { where: { status: 'unpaid', due_date: { [Op.lt]: today } } }
        );
        if (updated > 0) logger.info(`[Cron] Marked ${updated} invoices as overdue`);
      } catch (err) {
        logger.error('[Cron] Overdue error: ' + (err.message || err));
      }
    }));

    // ── 2. Auto-isolate pelanggan overdue (setiap hari jam 02:00) ────
    this.jobs.push(cron.schedule('0 2 * * *', async () => {
      try {
        const overdueCustomers = await Invoice.findAll({
          where: { status: 'overdue' },
          attributes: ['customer_id'],
          group: ['customer_id'],
          raw: true
        });
        const ids = overdueCustomers.map(i => i.customer_id);
        if (ids.length > 0) {
          const [updated] = await Customer.update(
            { status: 'isolated' },
            { where: { id: { [Op.in]: ids }, status: { [Op.in]: ['active'] } } }
          );
          if (updated > 0) logger.info(`[Cron] Isolated ${updated} customers`);
        }
      } catch (err) {
        logger.error('[Cron] Auto-isolate error: ' + (err.message || err));
      }
    }));

    // ── 3. Cleanup traffic data (setiap hari jam 03:00) ──────────────
    this.jobs.push(cron.schedule('0 3 * * *', async () => {
      try {
        const cutoff = moment().subtract(30, 'days').toDate();
        const deleted = await TrafficData.destroy({ where: { recorded_at: { [Op.lt]: cutoff } } });
        if (deleted > 0) logger.info(`[Cron] Cleaned ${deleted} traffic records`);
      } catch (err) {
        logger.error('[Cron] Traffic cleanup error: ' + (err.message || err));
      }
    }));

    // ── 4. Cleanup device logs (setiap Minggu jam 04:00) ─────────────
    this.jobs.push(cron.schedule('0 4 * * 0', async () => {
      try {
        const cutoff = moment().subtract(90, 'days').toDate();
        const deleted = await DeviceLog.destroy({ where: { polled_at: { [Op.lt]: cutoff } } });
        if (deleted > 0) logger.info(`[Cron] Cleaned ${deleted} device logs`);
      } catch (err) {
        logger.error('[Cron] Device log cleanup error: ' + (err.message || err));
      }
    }));

    // ── 5. Queue traffic history (setiap 1 menit) ────────────────────
    this.jobs.push(cron.schedule('* * * * *', async () => {
      await this._pollQueueHistory();
    }));

    // ── 6. Cleanup queue history (setiap hari jam 03:15) ─────────────
    this.jobs.push(cron.schedule('15 3 * * *', async () => {
      try {
        const cutoff = moment().subtract(30, 'days').toDate();
        const deleted = await QueueHistory.destroy({ where: { recorded_at: { [Op.lt]: cutoff } } });
        if (deleted > 0) logger.info(`[Cron] Cleaned ${deleted} queue history records`);
      } catch (err) {
        logger.error('[Cron] Queue history cleanup error: ' + (err.message || err));
      }
    }));

    // ── 7. GenieACS ONT poll (setiap 5 menit) ────────────────────────
    this.jobs.push(cron.schedule('*/5 * * * *', async () => {
      await this._pollGenieACS();
    }));

    // ── 8. OLT SNMP poll (setiap 5 menit) — BARU ─────────────────────
    // Berjalan bersamaan dengan GenieACS, tidak saling mengganggu.
    // ONT dari OLT SNMP masuk ke tabel yang sama (ont_devices),
    // dibedakan via kolom 'source'.
    this.jobs.push(cron.schedule('*/5 * * * *', async () => {
      await this._pollOltSNMP();
    }));

    // ── 9. Cleanup ONT signal history (setiap hari jam 03:30) ────────
    this.jobs.push(cron.schedule('30 3 * * *', async () => {
      try {
        const { OntSignalHistory } = require('../models');
        const cutoff = moment().subtract(7, 'days').toDate();
        const deleted = await OntSignalHistory.destroy({
          where: { recorded_at: { [Op.lt]: cutoff } }
        });
        if (deleted > 0) logger.info(`[Cron] Cleaned ${deleted} ONT signal history records`);
      } catch (err) {
        logger.error('[Cron] ONT signal history cleanup error: ' + (err.message || err));
      }
    }));

    // ── 10. WA Reminder Scheduler (setiap 1 menit) ───────────────────
    this.jobs.push(cron.schedule('* * * * *', async () => {
      await this._runReminderScheduler();
    }));

    // ── 11. WA Report Scheduler (setiap 1 menit) ─────────────────────
    this.jobs.push(cron.schedule('* * * * *', async () => {
      await this._runReportScheduler();
    }));

    // ── 12. Broadcast Scheduler (setiap 1 menit) ─────────────────────
    this.jobs.push(cron.schedule('* * * * *', async () => {
      await this._runBroadcastScheduler();
    }));

    // ── 13. Web Push: Reminder H-3, H-1, H+0 (setiap hari jam 08:00) ─
    this.jobs.push(cron.schedule('0 8 * * *', async () => {
      try {
        const PushService = require('./PushService');
        if (PushService.isReady()) {
          await PushService.sendDueSoonReminders();
        }
      } catch (e) {
        logger.error('[Cron:PushReminder] ' + (e.message || e));
      }
    }));

    // ── 14. Web Push: Overdue reminder (setiap hari jam 09:00) ─────────
    this.jobs.push(cron.schedule('0 9 * * *', async () => {
      try {
        const PushService = require('./PushService');
        if (PushService.isReady()) {
          await PushService.sendOverdueReminders();
        }
      } catch (e) {
        logger.error('[Cron:PushOverdue] ' + (e.message || e));
      }
    }));

    // ── 15. Admin Push Scheduler (setiap 1 menit) ──────────────────────
    // Cek push notification yang scheduled_at <= now dan kirim
    this.jobs.push(cron.schedule('* * * * *', async () => {
      try {
        const PushNotifCtrl = require('../controllers/PushNotificationController');
        if (typeof PushNotifCtrl.processScheduled === 'function') {
          await PushNotifCtrl.processScheduled();
        }
      } catch (e) {
        logger.error('[Cron:PushScheduler] ' + (e.message || e));
      }
    }));

    // ── 16. Device Traffic Poll (setiap 1 menit) ────────────────────────
    // Polling traffic dari device MikroTik yang pakai monitoring API.
    // Data disimpan ke traffic_data untuk bandwidth trends chart di dashboard.
    this.jobs.push(cron.schedule('* * * * *', async () => {
      await this._pollDeviceTraffic();
    }));

    // ── 17. Auto-generate Invoice Bulanan (tiap tgl 1 jam 01:30) ────────
    // Otomatis bikin invoice untuk semua customer aktif tiap awal bulan,
    // tanpa perlu admin klik tombol "Generate Invoice" di halaman billing.
    // Idempotent — kalau invoice sudah ada untuk customer di periode tsb, skip.
    // Bisa dimatikan dengan setting `auto_generate_invoice = 0` di app_settings.
    this.jobs.push(cron.schedule('30 1 1 * *', async () => {
      await this._runAutoGenerateInvoice('cron');
    }));

    // Catch-up at startup: kalau bulan ini sudah lewat tanggal 1 dan belum ada
    // invoice yang ter-generate sama sekali untuk periode bulan ini, bikin sekarang.
    // Berguna kalau server baru di-deploy/restart di pertengahan bulan, atau
    // saat tanggal 1 server sedang down sehingga cron miss.
    setTimeout(() => {
      this._runAutoGenerateInvoice('startup').catch(err => {
        logger.error('[Cron:AutoGenInvoice] Startup catch-up error: ' + (err.message || err));
      });
    }, 8000); // delay 8 detik agar models & DB sudah siap

    logger.info('[CronService] Started: overdue, isolir, cleanup, queue-history, genieacs, olt-snmp, signal-cleanup, wa-reminder, wa-report, broadcast, push-reminder, push-scheduler, device-traffic, auto-gen-invoice');
  }

  // ═══════════════════════════════════════════════════════════════════
  // AUTO-GENERATE INVOICE BULANAN
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Trigger generate invoice untuk periode bulan saat ini.
   * @param {'cron'|'startup'|'manual'} source
   */
  async _runAutoGenerateInvoice(source = 'cron') {
    try {
      // Cek setting auto-generate. Default ON ('1'). Kalau admin set '0', skip.
      const enabled = await this._getSetting('auto_generate_invoice', '1');
      if (enabled !== '1' && String(enabled).toLowerCase() !== 'true') {
        logger.info(`[Cron:AutoGenInvoice] Skipped (${source}) — disabled di settings`);
        return;
      }

      const moment = require('moment');
      const targetMonth = moment().month() + 1;
      const targetYear  = moment().year();

      // Untuk source 'startup': cek apakah sudah ada invoice di periode bulan ini.
      // Kalau sudah ada (artinya cron sudah jalan atau admin sudah generate manual), skip.
      // Untuk source 'cron': tetap jalan (idempotent — sudah di-handle di generateInvoicesForPeriod).
      if (source === 'startup') {
        const { Invoice } = require('../models');
        const existing = await Invoice.count({
          where: { period_month: targetMonth, period_year: targetYear }
        });
        if (existing > 0) {
          logger.info(`[Cron:AutoGenInvoice] Startup catch-up skipped — period ${targetMonth}/${targetYear} sudah ada ${existing} invoice`);
          return;
        }
        // Hanya catch-up kalau sudah lewat tanggal 1 (kalau hari ini tgl 1, biarkan cron jam 01:30 yg jalan)
        const now = moment();
        if (now.date() === 1 && now.hour() < 2) {
          logger.info(`[Cron:AutoGenInvoice] Startup catch-up skipped — nunggu cron jam 01:30`);
          return;
        }
      }

      const BillingController = require('../controllers/BillingController');
      const result = await BillingController.generateInvoicesForPeriod(targetMonth, targetYear, { source });
      logger.info(`[Cron:AutoGenInvoice] (${source}) period ${result.period}: created=${result.created}, skipped=${result.skipped}`);

      // Notif ke superadmin via in-app notification kalau ada invoice baru
      if (result.created > 0 && this.io) {
        try {
          const { Notification, User } = require('../models');
          const admins = await User.findAll({
            where: { role: ['superadmin', 'admin'], is_active: true },
            attributes: ['id']
          });
          const monthName = moment(`${targetYear}-${String(targetMonth).padStart(2,'0')}-01`).format('MMMM YYYY');
          for (const admin of admins) {
            await Notification.create({
              user_id: admin.id,
              title:    'Tagihan otomatis ter-generate',
              message:  `${result.created} invoice untuk periode ${monthName} berhasil dibuat${source === 'startup' ? ' (catch-up startup)' : ''}.`,
              type:     'info',
              link:     '/billing'
            });
          }
          this.io.emit('notification:new', { title: 'Auto Generate Invoice', count: result.created });
        } catch (notifErr) {
          logger.warn('[Cron:AutoGenInvoice] Notif error: ' + notifErr.message);
        }
      }
    } catch (err) {
      logger.error(`[Cron:AutoGenInvoice] (${source}) Error: ` + (err.message || err));
    }
  }

  /** Helper: ambil setting dari app_settings table */
  async _getSetting(key, fallback = null) {
    try {
      const { AppSetting } = require('../models');
      const row = await AppSetting.findOne({ where: { key } });
      return row ? row.value : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // OLT SNMP POLLING — BARU
  // ═══════════════════════════════════════════════════════════════════

  async _pollOltSNMP() {
    // Load konfigurasi OLT dari file (community/password di-decrypt otomatis).
    // Legacy plaintext files still load fine; ConfigCrypto falls through.
    let configs = [];
    try {
      if (!fs.existsSync(OLT_CONFIG_PATH)) return; // tidak ada OLT yang dikonfigurasi
      configs = ConfigCrypto.load(OLT_CONFIG_PATH, []);
    } catch(e) {
      logger.error('[Cron:OltSNMP] Gagal load olt_config.json: ' + (e.message || e));
      return;
    }

    // Filter OLT yang enabled
    const activeOlts = configs.filter(c => c.enabled !== false);
    if (!activeOlts.length) return;

    logger.debug(`[Cron:OltSNMP] Polling ${activeOlts.length} OLT(s)...`);

    // Jalankan semua OLT secara paralel (max 3 sekaligus)
    const chunks = [];
    for (let i = 0; i < activeOlts.length; i += 3) {
      chunks.push(activeOlts.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(cfg => this._syncOneOlt(cfg, configs))
      );
    }
  }

  async _syncOneOlt(cfg, allConfigs) {
    try {
      const OltController = require('../controllers/OltController');
      const cfgIdx = allConfigs.findIndex(c => c.id === cfg.id);
      const result = await OltController._doSync(cfg, cfgIdx, allConfigs);
      logger.info(`[Cron:OltSNMP] ${cfg.name}: ${result.total} ONT, ${result.offline} offline, ${result.elapsed}s`);
    } catch (err) {
      // Update lastError di config file
      try {
        const configs = JSON.parse(fs.readFileSync(OLT_CONFIG_PATH, 'utf8'));
        const idx = configs.findIndex(c => c.id === cfg.id);
        if (idx >= 0) {
          configs[idx].lastError = err.message;
          fs.writeFileSync(OLT_CONFIG_PATH, JSON.stringify(configs, null, 2), 'utf8');
        }
      } catch(e2) { /* silent */ }
      logger.error(`[Cron:OltSNMP] Error sync ${cfg.name}: ` + (err.message || err));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GENIEACS POLLING (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _pollGenieACS() {
    try {
      const GenieACSService = require('./GenieACSService');
      const health = await GenieACSService.healthCheck();
      if (!health.connected) {
        logger.debug(`[Cron:GenieACS] Tidak terhubung: ${health.error || health.url}`);
        return;
      }
      const OntController = require('../controllers/OntController');
      const result = await OntController._performSync(this.io);
      logger.info(`[Cron:GenieACS] Sync selesai: ${result.synced} ONT, ${result.offline_detected} offline`);
    } catch (err) {
      logger.error('[Cron:GenieACS] Error: ' + (err.message || err));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // QUEUE HISTORY (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _pollQueueHistory() {
    try {
      const { getMikrotikInstance } = require('./MikrotikService');
      const mt = getMikrotikInstance();
      if (!mt) return;
      const queues = await mt.getQueueStats();
      if (!queues?.length) return;
      const now = new Date();
      const records = queues.map(q => ({
        queue_id:    q.id,
        queue_name:  q.name || '',
        rx_rate:     parseInt(q.rateIn)   || 0,
        tx_rate:     parseInt(q.rateOut)  || 0,
        rx_bytes:    parseInt(q.bytesIn)  || 0,
        tx_bytes:    parseInt(q.bytesOut) || 0,
        recorded_at: now
      }));
      await QueueHistory.bulkCreate(records, { ignoreDuplicates: true });
    } catch (e) {
      if (!e.message?.includes('not configured') && !e.message?.includes('ECONNREFUSED')) {
        logger.error('[Cron:QueueHistory] Error: ' + (e.message || e));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // AUTO ISOLIR & DAILY ALERTS (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _runAutoIsolir() {
    try {
      const IsolirSvc = require('./IsolirService');
      const { AppSetting } = require('../models');
      const setting = await AppSetting.findOne({ where: { key: 'isolir_auto_enable' } }).catch(() => null);
      if (setting?.value !== '1') return;
      const result = await IsolirSvc.runAutoIsolir();
      if (result.isolated > 0) logger.info('[Cron:AutoIsolir]', result);
    } catch (e) {
      logger.error('[Cron:AutoIsolir] Error: ' + (e.message || e));
    }
  }

  _runDailyAlerts() {
    try {
      const NotifSvc = require('./NotificationService');
      NotifSvc.checkDailyAlerts();
    } catch (e) {
      logger.error('[Cron:DailyAlerts] Error: ' + (e.message || e));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // WA REMINDER (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _runReminderScheduler() {
    try {
      const { ReminderSetting, WaTemplate, WaSession, sequelize } = require('../models');
      const WAService = require('./WAService');

      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) return;

      const allRm      = await ReminderSetting.findAll({ where: { is_active: true } });
      const activeTpls = await WaTemplate.findAll({ where: { is_active: true } });
      const tplMap     = {};
      activeTpls.forEach(t => { tplMap[t.id] = t; });
      const reminders  = allRm
        .filter(r => r.template_id && tplMap[r.template_id])
        .map(r => { r.template = tplMap[r.template_id]; return r; });
      if (!reminders.length) return;

      const nowTime = moment().format('HH:mm');
      const today   = moment().format('YYYY-MM-DD');

      for (const rm of reminders) {
        const sendTime = (rm.send_time || '08:00:00').substring(0, 5);
        if (sendTime !== nowTime) continue;

        let targetDate;
        if (rm.type === 'before')   targetDate = moment().add(Math.abs(rm.days_offset), 'days').format('YYYY-MM-DD');
        else if (rm.type === 'due') targetDate = today;
        else                        targetDate = moment().subtract(Math.abs(rm.days_offset), 'days').format('YYYY-MM-DD');

        const targets = await sequelize.query(
          `SELECT DISTINCT c.id, c.name, c.phone, c.customer_id AS cid,
                  pkg.name AS paket, pkg.price AS harga, i.due_date
           FROM customers c
           LEFT JOIN packages pkg ON pkg.id = c.package_id
           JOIN invoices i ON i.customer_id = c.id
           WHERE i.due_date = :dt AND i.status IN ('unpaid','overdue')
             AND c.phone IS NOT NULL AND c.phone != ''
             AND c.status != 'inactive'`,
          { replacements: { dt: targetDate }, type: sequelize.QueryTypes.SELECT }
        );
        if (!targets.length) continue;

        let sent = 0, failed = 0;
        const templateContent = rm.template.content || rm.template.message || '';

        for (const cust of targets) {
          try {
            const msg = templateContent
              .replace(/\{nama\}/g,    cust.name || '')
              .replace(/\{cid\}/g,     cust.cid  || '')
              .replace(/\{paket\}/g,   cust.paket || '–')
              .replace(/\{harga\}/g,   'Rp ' + Number(cust.harga || 0).toLocaleString('id-ID'))
              .replace(/\{duedate\}/g, moment(cust.due_date).format('DD/MM/YYYY'))
              .replace(/\{phone\}/g,   cust.phone || '');
            await WAService.sendMessage(session.session_id, cust.phone, msg, null);
            sent++;
            await new Promise(r => setTimeout(r, 600));
          } catch(e) { failed++; }
        }
        logger.info(`[Cron:Reminder] type=${rm.type} offset=${rm.days_offset} target=${targetDate}: ${sent} sent, ${failed} failed`);
      }
    } catch(e) {
      logger.error('[Cron:Reminder] Error: ' + (e.message || e));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // WA REPORT (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _runReportScheduler() {
    try {
      const { AppSetting, WaSession, sequelize } = require('../models');
      const WAService = require('./WAService');

      const session = await WaSession.findOne({ where: { status: 'connected' } });
      if (!session || !WAService.isConnected(session.session_id)) return;

      const getSet = async (key, def = '') => {
        const r = await AppSetting.findOne({ where: { key } });
        return r ? (r.value || def) : def;
      };

      const phones    = JSON.parse(await getSet('admin_notify_phones', '[]'));
      if (!phones.length) return;

      const schedules = JSON.parse(await getSet('report_schedules', '{}'));
      const sections  = JSON.parse(await getSet('report_sections',  '{}'));

      const now     = moment();
      const nowTime = now.format('HH:mm');
      const nowDay  = now.isoWeekday();
      const nowDate = now.date();

      const PERIODS = {
        this_week:  { from: now.clone().startOf('isoWeek').format('YYYY-MM-DD'),                    to: now.format('YYYY-MM-DD'),                                             label: 'Minggu Ini'        },
        last_week:  { from: now.clone().subtract(1,'week').startOf('isoWeek').format('YYYY-MM-DD'), to: now.clone().subtract(1,'week').endOf('isoWeek').format('YYYY-MM-DD'),  label: 'Minggu Lalu'       },
        this_month: { from: now.clone().startOf('month').format('YYYY-MM-DD'),                      to: now.format('YYYY-MM-DD'),                                             label: now.format('MMMM YYYY') },
        last_month: { from: now.clone().subtract(1,'month').startOf('month').format('YYYY-MM-DD'),  to: now.clone().subtract(1,'month').endOf('month').format('YYYY-MM-DD'),   label: now.clone().subtract(1,'month').format('MMMM YYYY') }
      };

      for (const [pk, sched] of Object.entries(schedules)) {
        if (!sched.enabled) continue;
        const sendTime = (sched.time || '08:00').substring(0, 5);
        if (sendTime !== nowTime) continue;
        if (sched.freq === 'weekly'  && nowDay  !== parseInt(sched.day || 1)) continue;
        if (sched.freq === 'monthly' && nowDate !== parseInt(sched.day || 1)) continue;
        const period = PERIODS[pk];
        if (!period) continue;

        const appName = await getCompanyName();
        const msg     = await buildReportMessage(sequelize, period.from, period.to, appName, 'Laporan ' + period.label, sections);

        let sent = 0;
        for (const phone of phones) {
          try { await WAService.sendMessage(session.session_id, phone, msg, null); sent++; } catch(e) {}
          if (phones.length > 1) await new Promise(r => setTimeout(r, 1000));
        }
        await AppSetting.upsert({ key: 'report_last_sent', value: new Date().toISOString(), type: 'string' });
        logger.info(`[Cron:Report] ${pk} dikirim ke ${sent} nomor`);
      }
    } catch(e) {
      logger.error('[Cron:Report] Error: ' + (e.message || e));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // BROADCAST (tidak berubah)
  // ═══════════════════════════════════════════════════════════════════

  async _runBroadcastScheduler() {
    try {
      const { WaBroadcast } = require('../models');
      const pending = await WaBroadcast.findAll({
        where: { status: 'scheduled', scheduled_at: { [Op.lte]: new Date() } },
        order: [['scheduled_at', 'ASC']],
        limit: 3
      });
      for (const bc of pending) {
        await bc.update({ status: 'running', started_at: new Date() });
        const BroadcastController = require('../controllers/BroadcastController');
        BroadcastController._runBroadcast(bc.id).catch(e =>
          logger.error(`[Cron:Broadcast] Error bc#${bc.id}: ${e.message}`)
        );
      }
    } catch(e) {
      logger.error('[Cron:Broadcast] Error: ' + (e.message || e));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEVICE TRAFFIC POLLING — via MikroTik API
  // ═══════════════════════════════════════════════════════════════════
  // Polling traffic tiap 1 menit untuk device router/OLT dengan monitoring API.
  // Data disimpan ke traffic_data supaya chart bandwidth trends di dashboard terisi.
  //
  // Throttling: paralel max 3 device sekaligus (supaya tidak overload DB/network).
  // Kalau device offline / timeout, skip tanpa error.
  async _pollDeviceTraffic() {
    try {
      const { Device } = require('../models');
      const { MikrotikService } = require('./MikrotikService');

      // Ambil semua device aktif yang support MikroTik API
      const devices = await Device.findAll({
        where: {
          is_active: true,
          monitoring_type: { [Op.in]: ['api', 'both'] },
          type: { [Op.in]: ['router', 'olt'] },
          api_username: { [Op.ne]: null }
        },
        attributes: ['id','name','ip_address','api_port','api_username','api_password']
      });

      if (!devices.length) return;

      // Batch processing — paralel max 3
      const batchSize = 3;
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize);
        await Promise.all(batch.map(async (device) => {
          try {
            const mt = new MikrotikService({
              host:         device.ip_address,
              port:         device.api_port || 80,
              username:     device.api_username,
              password:     device.api_password || '',
              api_protocol: device.api_protocol || null,
              timeout:      6000
            });

            // Ambil list interface + bulk traffic stats
            const ifaces = await mt.getInterfaces();
            if (!ifaces || !ifaces.length) return;

            // Filter interface yang running + bukan bridge/vlan (hindari double count)
            const running = ifaces.filter(i =>
              i.running && !['bridge','vlan','vrrp'].includes((i.type||'').toLowerCase())
            );
            if (!running.length) return;

            const stats = await mt.getInterfacesBulkStats(running.map(i => i.name));
            const statsByName = {};
            stats.forEach(s => { statsByName[s.name] = s; });

            // Insert 1 row per interface ke traffic_data
            const now = new Date();
            const rows = running.map(i => ({
              device_id: device.id,
              interface_name: i.name,
              rx_bytes: i.rxByte || 0,
              tx_bytes: i.txByte || 0,
              rx_rate: statsByName[i.name]?.rxBitsPerSecond || 0,
              tx_rate: statsByName[i.name]?.txBitsPerSecond || 0,
              recorded_at: now
            }));

            if (rows.length) await TrafficData.bulkCreate(rows);
          } catch (e) {
            // Silent — device unreachable itu normal
          }
        }));
      }
    } catch (err) {
      logger.error('[Cron:DeviceTraffic] ' + (err.message || err));
    }
  }

  // ── Stop semua jobs ─────────────────────────────────────────────────
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    logger.info('[CronService] All jobs stopped');
  }
}

// ─── Helper: Build Report Message ──────────────────────────────────────────
async function buildReportMessage(sequelize, dateFrom, dateTo, appName, label, sections) {
  function fmtRp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

  const [[aktif]]   = await sequelize.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(p.price),0) AS total_harga FROM customers c LEFT JOIN packages p ON p.id=c.package_id WHERE c.status='active'");
  const [[bayar]]   = await sequelize.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(py.amount),0) AS total FROM payments py WHERE py.payment_date BETWEEN ? AND ?", { replacements: [dateFrom, dateTo] });
  const methods     = await sequelize.query("SELECT py.payment_method AS method, COUNT(*) AS cnt, COALESCE(SUM(py.amount),0) AS total FROM payments py WHERE py.payment_date BETWEEN ? AND ? GROUP BY py.payment_method ORDER BY total DESC", { replacements: [dateFrom, dateTo], type: sequelize.QueryTypes.SELECT });
  const topPayers   = await sequelize.query("SELECT c.name, c.customer_id AS cid, SUM(py.amount) AS total FROM payments py JOIN invoices i ON py.invoice_id=i.id JOIN customers c ON c.id=i.customer_id WHERE py.payment_date BETWEEN ? AND ? GROUP BY i.customer_id ORDER BY total DESC LIMIT 5", { replacements: [dateFrom, dateTo], type: sequelize.QueryTypes.SELECT });
  const today       = moment().format('YYYY-MM-DD');
  const in7         = moment().add(7, 'days').format('YYYY-MM-DD');
  const [[dueSoon]] = await sequelize.query("SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total FROM invoices WHERE due_date BETWEEN ? AND ? AND status IN ('unpaid','overdue')", { replacements: [today, in7] });

  const unpaidCnt   = Math.max(0, parseInt(aktif?.cnt || 0) - parseInt(bayar?.cnt || 0));
  const unpaidTotal = Math.max(0, parseFloat(aktif?.total_harga || 0) - parseFloat(bayar?.total || 0));
  const rate        = parseInt(aktif?.cnt || 0) > 0 ? Math.round(parseInt(bayar?.cnt || 0) / parseInt(aktif?.cnt) * 100) : 0;
  const sep         = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const nowStr      = new Date().toLocaleString('id-ID');

  let msg = `📊 *${label}*\n*${appName}*\n`;
  msg += `Periode : *${moment(dateFrom).format('DD/MM/YYYY')} - ${moment(dateTo).format('DD/MM/YYYY')}*\n${sep}`;

  if (sections.summary !== false) {
    msg += `\n\n*RINGKASAN TAGIHAN*\n`;
    msg += `Total Pelanggan Aktif : *${aktif?.cnt || 0} pelanggan*\n`;
    msg += `Total Tagihan         : *${fmtRp(aktif?.total_harga)}*\n\n`;
    msg += `*Tagihan Dibayar*\n`;
    msg += `Transaksi  : *${bayar?.cnt || 0} pembayaran*\n`;
    msg += `Diterima   : *${fmtRp(bayar?.total)}*\n\n`;
    msg += `*Belum Dibayar*\n`;
    msg += `Pelanggan  : *${unpaidCnt} pelanggan*\n`;
    msg += `Estimasi   : *${fmtRp(unpaidTotal)}*`;
  }
  if (sections.rate !== false) {
    msg += `\n\n${sep}\n*Collection Rate*\n${rate}% pelanggan sudah bayar`;
  }
  if (sections.method && methods.length) {
    const grandTotal = methods.reduce((a, m) => a + parseFloat(m.total), 0) || 1;
    const mLabels = { cash:'Cash', transfer:'Transfer', dana:'DANA', ovo:'OVO', gopay:'GoPay', qris:'QRIS' };
    msg += `\n\n${sep}\n*Metode Pembayaran*\n`;
    methods.forEach(m => {
      const pct = Math.round(parseFloat(m.total) / grandTotal * 100);
      msg += `• ${mLabels[m.method] || m.method}: ${m.cnt}x — ${fmtRp(m.total)} (${pct}%)\n`;
    });
  }
  if (sections.top && topPayers.length) {
    msg += `\n${sep}\n*Top Pembayar*\n`;
    topPayers.slice(0, 5).forEach((p, i) => { msg += `${i + 1}. ${p.name} (${p.cid}) — ${fmtRp(p.total)}\n`; });
  }
  if (sections.due) {
    msg += `\n${sep}\n*Jatuh Tempo 7 Hari ke Depan*\n ${dueSoon?.cnt || 0} pelanggan — ${fmtRp(dueSoon?.total)}`;
  }
  msg += `\n\n${sep}\n_Dikirim otomatis oleh ${appName}_\n_${nowStr}_`;
  return msg;
}

module.exports = new CronService();