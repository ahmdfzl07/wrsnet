/**
 * publicPages.js
 * ──────────────────────────────────────────────────────────────────
 * Route untuk halaman publik (tanpa authentication).
 *
 * Endpoints:
 *   GET /p/isolir                  → halaman pemberitahuan isolir
 *   GET /p/isolir/payment-accounts → list rekening pembayaran (JSON)
 *
 * Mounted di server.js sebelum webRoutes supaya tidak ke-intercept
 * authenticate middleware.
 * ──────────────────────────────────────────────────────────────────
 */
const express = require('express');
const router = express.Router();
const IsolirPublicCtrl = require('../controllers/IsolirPublicController');

// Landing page
router.get('/isolir', IsolirPublicCtrl.renderPage);

// Alias untuk URL lama
router.get('/blocked', IsolirPublicCtrl.renderPage);

// Daftar rekening pembayaran (untuk fetch dari client JS)
router.get('/isolir/payment-accounts', IsolirPublicCtrl.getPaymentAccounts);

module.exports = router;
