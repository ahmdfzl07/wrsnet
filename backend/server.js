require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs   = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const db = require('./models');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const portalRoutes = require('./routes/portal');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { demoGuard } = require('./middleware/demoGuard');
const { demoDataMasker } = require('./middleware/demoDataMasker');
const { demoResourceCaps } = require('./middleware/demoResourceCaps');
const SNMPService = require('./services/SNMPService');
const CronService = require('./services/CronService');
const setupSocket = require('./services/SocketHandler');

const app = express();

// Trust proxy — wajib aktif kalau di belakang nginx/CDN supaya req.ip
// dapat IP pelanggan asli (dari X-Forwarded-For), bukan IP nginx (127.0.0.1).
// Ini penting untuk halaman publik isolir (/p/isolir) yang lookup customer
// berdasarkan static_ip dari req.ip.
app.set('trust proxy', true);

const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.APP_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Setup Socket handlers
setupSocket(io);

// Make io available in controllers
app.set('io', io);

// Connect NotificationService to socket.io
require('./services/NotificationService').setIO(io);

// Init Web Push (VAPID) — opsional, aktif jika VAPID_PUBLIC_KEY di .env
require('./services/PushService').init();

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.APP_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'", "'unsafe-eval'",
        "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com",
        "static.cloudflareinsights.com",
        "app.midtrans.com", "app.sandbox.midtrans.com", "*.midtrans.com",
        "app-prod.duitku.com", "app-sandbox.duitku.com", "*.duitku.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "unpkg.com",
        "app.midtrans.com", "app.sandbox.midtrans.com",
        "app-prod.duitku.com", "app-sandbox.duitku.com", "*.duitku.com"
      ],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc: [
        "'self'", "data:", "blob:",
        "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com",
        "mt0.google.com", "mt1.google.com", "mt2.google.com", "mt3.google.com",
        "*.googleapis.com", "*.ggpht.com",
        "unpkg.com", "*.midtrans.com", "*.duitku.com"
      ],
      connectSrc: [
        "'self'", "ws:", "wss:",
        "cdn.jsdelivr.net", "unpkg.com",
        "*.tile.openstreetmap.org", "*.basemaps.cartocdn.com",
        "mt0.google.com", "mt1.google.com", "mt2.google.com", "mt3.google.com",
        "*.midtrans.com", "api.midtrans.com", "api.sandbox.midtrans.com",
        "*.duitku.com", "passport.duitku.com", "sandbox.duitku.com"
      ],
      frameSrc: [
        "'self'",
        "app.midtrans.com", "app.sandbox.midtrans.com", "*.midtrans.com",
        "app-prod.duitku.com", "app-sandbox.duitku.com", "*.duitku.com",
        "passport.duitku.com", "sandbox.duitku.com"
      ]
    }
  } : false
}));
app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting — general API
// 500/15min terlalu sedikit untuk dashboard yang aktif (socket + polling + charts).
// Per-user dashboard normal bisa 50-100 req/menit, jadi naikkan ke 2000/15min (≈130/menit).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  // Skip endpoint polling yang sangat sering dipanggil (notifikasi badge, dashboard stats)
  // supaya tidak menghabiskan kuota.
  skip: (req) => {
    const path = req.path || '';
    return /^\/(notifications\/unread-count|dashboard\/stats|auth\/profile)/.test(path);
  },
  message: { success: false, message: 'Too many requests' }
});

// Stricter limiter for authentication endpoints to resist brute-force/credential-stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                       // 10 attempts per 15 min per IP
  skipSuccessfulRequests: true,  // only count failed logins toward the limit
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.' }
});
app.use(['/api/auth/login', '/api/auth/register', '/portal/api/login'], authLimiter);
app.use('/api', apiLimiter);

// ── Demo-specific rate limiter (60 req/min untuk role demo) ─────────
const demoApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => {
    const token = req.cookies?.token;
    if (!token) return true;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.role !== 'demo';
    } catch { return true; }
  },
  message: { success: false, message: 'Demo rate limit reached.' }
});
app.use('/api', demoApiLimiter);


// Static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// ── Guard: block direct access to *.json / *.env / dotfiles under /uploads ──
// The uploads folder is serve-as-static for user-uploaded media (photos, etc.),
// but legacy code also writes runtime config (mikrotik_config.json, acs_config.json,
// olt_config.json, wa_auth/) to the same dir. We 403 any path that could leak them.
app.use('/uploads', (req, res, next) => {
  const p = req.path.toLowerCase();
  if (p.endsWith('.json') || p.endsWith('.env') || p.includes('/wa_auth/') ||
      p.split('/').some(seg => seg.startsWith('.'))) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'frontend', 'public', 'uploads')));

// Service Worker — harus bisa diakses dari root path
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'sw.js'));
});

// Favicon — dynamic dari app_settings, dengan fallback ke default
// Browser auto-request /favicon.ico di root, jadi tidak perlu edit semua page.
app.get('/favicon.ico', async (req, res) => {
  try {
    const { AppSetting } = require('./models');
    const setting = await AppSetting.findOne({ where: { key: 'favicon_url' } });
    if (setting && setting.value) {
      // Strip query string (?v=cache-bust) sebelum resolve path filesystem.
      // URL di DB bisa berbentuk "/uploads/favicon.png?v=1715600000".
      const cleanUrl = String(setting.value).split('?')[0];
      const filePath = path.join(__dirname, '..', 'frontend', 'public', cleanUrl);
      if (fs.existsSync(filePath)) {
        // Cache 1 jam supaya browser tidak hit DB tiap request.
        // Karena URL favicon punya cache-bust ?v=..., refresh tetap mulus saat diganti.
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
      }
    }
  } catch (e) { /* fall through ke default */ }

  // Default fallback
  const defaultPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.ico');
  if (fs.existsSync(defaultPath)) {
    return res.sendFile(defaultPath);
  }
  // Tidak ada default → 204 supaya browser tidak terus-menerus retry
  res.status(204).end();
});

// ── Global app settings middleware ──────────────────────────────────
// Cache hasil query selama 60 detik supaya tidak hit DB setiap request.
// Cache di-bust otomatis saat admin save setting via API
// (lihat SettingsController — invalidate via global._appSettingsCache = null).
let _appSettingsCache = null;
let _appSettingsCacheAt = 0;
const APP_SETTINGS_CACHE_TTL = 60 * 1000; // 60 detik
// Ekspos cache supaya bisa di-invalidate dari controller setting:
global._invalidateAppSettingsCache = () => { _appSettingsCache = null; _appSettingsCacheAt = 0; };

app.use(async (req, res, next) => {
  try {
    let cfg;
    const now = Date.now();
    // Pakai cache kalau masih valid
    if (_appSettingsCache && (now - _appSettingsCacheAt) < APP_SETTINGS_CACHE_TTL) {
      cfg = _appSettingsCache;
    } else {
      const { AppSetting } = require('./models');
      const keys = ['brand_mode','app_name','app_tagline','logo_url','favicon_url'];
      const rows = await AppSetting.findAll({ where: { key: keys } });
      cfg = {};
      rows.forEach(r => { cfg[r.key] = r.value; });
      _appSettingsCache = cfg;
      _appSettingsCacheAt = now;
    }
    res.locals.appSettings = cfg;
    res.locals.brandMode   = cfg.brand_mode  || 'name_tagline';
    res.locals.appName     = cfg.app_name    || 'DIGSnet';
    res.locals.appTagline  = cfg.app_tagline || '';
    res.locals.logoUrl     = cfg.logo_url    || '';
    res.locals.faviconUrl  = cfg.favicon_url || '';
  } catch(e) {
    res.locals.appSettings = {};
    res.locals.brandMode   = 'name_tagline';
    res.locals.appName     = 'DIGSnet';
    res.locals.appTagline  = '';
    res.locals.logoUrl     = '';
    res.locals.faviconUrl  = '';
  }
  next();
});

const NotificationService = require('./services/NotificationService');

// Demo data masker — wrap res.json supaya field sensitif di-mask untuk demo user.
// Lazy: dia hanya bekerja kalau req.user.role.name === 'demo' saat response dikirim.
app.use('/api', demoDataMasker);

app.use('/api', apiRoutes);
app.use('/portal', portalRoutes);
app.use('/', webRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────
const PORT = process.env.APP_PORT || 3001;

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info('Database connection established');

    if (process.env.APP_ENV === 'development') {
      await db.sequelize.sync({ alter: false });
      logger.info('Database models synced');
    }

    // Start SNMP monitoring
    const snmpService = new SNMPService(io);
    SNMPService.setInstance(snmpService);
    snmpService.startAll();

    // Start cron jobs
    CronService.start();

    // Restore WA sessions
    const WAService = require('./services/WAService');
    WAService.restoreAllSessions(io);

    // Start main HTTP server
    server.listen(PORT, () => {
      logger.info(`ISP NetOps running on http://localhost:${PORT}`);
      console.log(`\n ISPNET running on http://localhost:${PORT}\n`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      snmpService.stopAll();
      CronService.stop();
      await db.sequelize.close();
      server.close(() => process.exit(0));
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };