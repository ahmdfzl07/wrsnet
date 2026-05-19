-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 19, 2026 at 03:58 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `flaynetnew_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` bigint NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `target_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `target_id` int DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_agent` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `target_type`, `target_id`, `old_data`, `new_data`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, NULL, 'login', 'auth', 'User Dede logged in', NULL, NULL, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:55:03'),
(2, NULL, 'create', 'user', 'create on user', 'user', 20, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:55:49'),
(3, NULL, 'delete', 'user', 'delete on user', 'user', 6, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:55:55'),
(4, NULL, 'delete', 'user', 'delete on user', 'user', 5, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:55:57'),
(5, NULL, 'logout', 'auth', 'User Dede logged out', NULL, NULL, NULL, NULL, '::1', NULL, '2026-05-19 03:56:07'),
(6, 20, 'login', 'auth', 'User Administrator logged in', NULL, NULL, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:56:22'),
(7, 20, 'delete', 'user', 'delete on user', 'user', 4, NULL, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '2026-05-19 03:56:45');

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` enum('gangguan','maintenance','info','promo') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `show_from` datetime DEFAULT NULL,
  `show_until` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `app_settings`
--

CREATE TABLE `app_settings` (
  `id` int UNSIGNED NOT NULL,
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `value` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'string',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `app_settings`
--

INSERT INTO `app_settings` (`id`, `key`, `value`, `type`, `description`, `updated_at`) VALUES
(1, 'admin_notify_phones', '[\"6281292266620\"]', 'json', NULL, '2026-03-25 08:43:17'),
(2, 'report_enabled', '0', 'boolean', NULL, '2026-03-25 10:26:20'),
(3, 'report_schedules', '{\"this_week\":{\"enabled\":false,\"freq\":\"daily\",\"time\":\"08:00\",\"day\":1},\"last_week\":{\"enabled\":false,\"freq\":\"daily\",\"time\":\"08:00\",\"day\":1},\"this_month\":{\"enabled\":true,\"freq\":\"daily\",\"time\":\"23:35\",\"day\":1},\"last_month\":{\"enabled\":true,\"freq\":\"daily\",\"time\":\"08:00\",\"day\":1}}', 'json', NULL, '2026-04-14 09:23:28'),
(4, 'report_sections', '{\"summary\":true,\"method\":true,\"top\":false,\"due\":true,\"rate\":true}', 'json', NULL, '2026-04-14 09:27:47'),
(5, 'report_range', 'this_month', 'string', NULL, '2026-03-28 16:34:32'),
(6, 'report_last_sent', '2026-05-14T16:35:01.071Z', 'string', NULL, '2026-05-14 16:35:01'),
(21, 'brand_mode', 'logo_only', 'string', NULL, '2026-05-13 14:20:07'),
(22, 'app_name', 'DIGIS', 'string', NULL, '2026-05-14 14:47:31'),
(23, 'app_tagline', 'Network Solutions', 'string', NULL, '2026-03-26 07:54:35'),
(24, 'logo_url', '/uploads/logo.png?v=1778877388172', 'string', NULL, '2026-05-15 20:36:28'),
(59, 'report_template', '*{label}*\n*{app_name}*\nPeriode : *{period}*\n{sep}\n\n*RINGKASAN TAGIHAN*\nTotal Pelanggan Aktif : *{aktif_cnt} pelanggan*\nTotal Tagihan Periode : *{aktif_total}*\n\n*Pembayaran Diterima*\nTransaksi  : *{bayar_cnt} pembayaran*\nDiterima   : *{bayar_total}*\n\n*Belum Dibayar*\nInvoice    : *{unpaid_cnt} invoice*\nEstimasi   : *{unpaid_total}*\n\n{sep}\n*Collection Rate*\n{rate}% tagihan sudah dibayar\n\n{sep}\n *Sudah Bayar*\n{paid_list}\n\n{sep}\n *Belum Bayar*\n{unpaid_list}\n\n{sep}\n Jatuh Tempo Hari Ini*\n{due_today_list}\n\n{sep}\n *Jatuh Tempo 3 Hari ke Depan*\n{due_list}\n\n{sep}\n_Dikirim otomatis oleh {app_name}_\n_{now}_', 'text', NULL, '2026-04-14 09:28:21'),
(102, 'isolir_grace_days', '0', 'string', NULL, '2026-03-25 10:33:14'),
(103, 'isolir_notify_wa', '1', 'string', NULL, '2026-03-25 10:33:14'),
(104, 'isolir_page_url', 'http://127.0.0.1', 'string', NULL, '2026-05-16 04:11:40'),
(105, 'isolir_auto_enable', '0', 'string', NULL, '2026-03-25 10:33:14'),
(143, 'genieacs_nbi_url', 'http://192.168.10.10:7557', 'string', NULL, '2026-05-19 03:57:10'),
(144, 'genieacs_username', 'ds@digs.co.id', 'string', NULL, '2026-05-19 03:57:10'),
(204, 'push_notification_enabled', '1', 'boolean', 'Aktifkan web push notification ke pelanggan', '2026-04-16 10:18:54'),
(205, 'push_reminder_h3', '1', 'boolean', 'Kirim push H-3 sebelum jatuh tempo', '2026-04-16 10:18:54'),
(206, 'push_reminder_h1', '1', 'boolean', 'Kirim push H-1 sebelum jatuh tempo', '2026-04-16 10:18:54'),
(207, 'push_reminder_h0', '1', 'boolean', 'Kirim push saat jatuh tempo', '2026-04-16 10:18:54'),
(208, 'push_reminder_overdue', '1', 'boolean', 'Kirim push saat tagihan overdue', '2026-04-16 10:18:54'),
(209, 'payment_accounts', '[{\"type\":\"bank\",\"provider\":\"bca\",\"account_number\":\"32100014184848\",\"account_owner\":\"Dede Saprudin\",\"logo_url\":\"/uploads/payment/pay_1776597532705_ui3cw.svg\",\"is_active\":true},{\"type\":\"bank\",\"provider\":\"mandiri\",\"account_number\":\"1324242352352\",\"account_owner\":\"Dede Saprudin\",\"logo_url\":\"/uploads/payment/pay_1776598430793_8kelx.png\",\"is_active\":true},{\"type\":\"ewallet\",\"provider\":\"dana\",\"account_number\":\"085117309751\",\"account_owner\":\"Dede Saprudin\",\"logo_url\":\"/uploads/payment/pay_1776603623680_joe0n.webp\",\"is_active\":true},{\"type\":\"bank\",\"provider\":\"seabank\",\"account_number\":\"3453542342\",\"account_owner\":\"Dede Saprudin\",\"logo_url\":\"/uploads/payment/pay_1776694949087_515lm.png\",\"is_active\":true},{\"type\":\"bank\",\"provider\":\"permata\",\"account_number\":\"434353535\",\"account_owner\":\"Dede Saprudin\",\"logo_url\":\"\",\"is_active\":true},{\"type\":\"qris\",\"provider\":\"qris\",\"account_number\":\"\",\"account_owner\":\"QRIS\",\"logo_url\":\"/uploads/payment/pay_1777947471943_1b9we.jpg\",\"is_active\":true}]', 'json', NULL, '2026-05-05 02:17:55'),
(214, 'company_name', 'DIGSNETS', 'string', NULL, '2026-05-13 09:28:04'),
(215, 'company_whatsapp', '081292266620', 'string', NULL, '2026-05-16 09:50:56'),
(216, 'snmp_community', 'public', 'string', NULL, '2026-04-19 10:57:05'),
(217, 'poll_interval', '60', 'string', NULL, '2026-04-19 10:57:05'),
(240, 'payment_gateway_enabled', 'true', 'string', NULL, '2026-04-22 03:33:06'),
(241, 'payment_gateway_provider', 'midtrans', 'string', NULL, '2026-05-14 16:31:14'),
(242, 'payment_gateway_env', 'sandbox', 'string', NULL, '2026-04-22 03:33:06'),
(243, 'payment_gateway_server_key', 'Mid-server-vu8vlGgQDsYvtE2Pv_hBL2U5', 'string', NULL, '2026-05-15 17:06:28'),
(244, 'payment_gateway_client_key', 'Mid-client-H8gsxE4UFBQgpaBb', 'string', NULL, '2026-04-24 02:24:38'),
(245, 'payment_gateway_callback_token', '', 'string', NULL, '2026-04-22 03:33:06'),
(282, 'portal_hero_image', '/uploads/portal-hero.jpg?v=1778682122409', 'string', NULL, '2026-05-13 14:22:02'),
(283, 'portal_hero_overlay', '0.6', 'string', NULL, '2026-04-26 05:32:01'),
(284, 'portal_welcome_title', 'Customer Portal', 'string', NULL, '2026-04-25 01:39:06'),
(285, 'portal_welcome_sub', '', 'string', NULL, '2026-04-24 08:10:03'),
(303, 'portal_logo_mode', 'circle', 'string', NULL, '2026-04-25 01:37:17'),
(360, 'favicon_url', '/uploads/favicon.png?v=1778682104508', 'string', NULL, '2026-05-13 14:21:44'),
(380, 'tax_enabled', '1', 'string', NULL, '2026-05-04 03:11:35'),
(381, 'tax_rate', '11', 'string', NULL, '2026-05-12 02:20:06'),
(382, 'tax_mode', 'exclusive', 'string', NULL, '2026-05-02 15:33:14'),
(383, 'tax_label', 'PPN', 'string', NULL, '2026-05-02 15:33:14'),
(478, 'invtpl_primary_color', '#1e3a8a', 'string', NULL, '2026-05-10 11:49:08'),
(479, 'invtpl_accent_color', '#1d4ed8', 'string', NULL, '2026-05-05 03:23:07'),
(480, 'invtpl_text_color', '#0f172a', 'string', NULL, '2026-05-05 03:23:07'),
(481, 'invtpl_font_family', 'Inter', 'string', NULL, '2026-05-05 03:23:07'),
(482, 'invtpl_paper_size', 'A4', 'string', NULL, '2026-05-05 03:23:07'),
(483, 'invtpl_header_style', 'banner', 'string', NULL, '2026-05-05 03:23:07'),
(484, 'invtpl_show_logo', '0', 'string', NULL, '2026-05-10 11:49:08'),
(485, 'invtpl_logo_url', '/uploads/logo.png', 'string', NULL, '2026-05-05 08:28:39'),
(486, 'invtpl_company_name', 'FLAYNET', 'string', NULL, '2026-05-05 08:11:15'),
(487, 'invtpl_company_tagline', 'Internet Service Provider', 'string', NULL, '2026-05-05 03:23:07'),
(488, 'invtpl_company_address', '', 'string', NULL, '2026-05-05 08:10:31'),
(489, 'invtpl_company_phone', '1111111', 'string', NULL, '2026-05-15 19:17:59'),
(490, 'invtpl_company_email', '', 'string', NULL, '2026-05-05 03:23:07'),
(491, 'invtpl_show_subtotal', '1', 'string', NULL, '2026-05-05 03:23:07'),
(492, 'invtpl_show_tax', '1', 'string', NULL, '2026-05-05 03:23:08'),
(493, 'invtpl_show_due_date', '1', 'string', NULL, '2026-05-05 03:23:08'),
(494, 'invtpl_show_signature', '0', 'string', NULL, '2026-05-05 08:28:39'),
(495, 'invtpl_show_active_until', '1', 'string', NULL, '2026-05-05 08:10:31'),
(496, 'invtpl_show_payment_method', '1', 'string', NULL, '2026-05-05 03:23:08'),
(497, 'invtpl_show_bank_info', '1', 'string', NULL, '2026-05-05 08:28:39'),
(498, 'invtpl_footer_text', 'Dokumen ini di-generate otomatis oleh sistem. Invoice ini sah tanpa tanda tangan basah.', 'string', NULL, '2026-05-05 03:23:08'),
(499, 'invtpl_thank_you_text', 'Terima kasih telah menggunakan layanan kami.', 'string', NULL, '2026-05-05 03:23:08'),
(500, 'invtpl_invoice_label', 'INVOICE', 'string', NULL, '2026-05-05 03:23:08'),
(501, 'invtpl_section_recipient_label', 'TAGIHAN UNTUK', 'string', NULL, '2026-05-05 03:23:08'),
(502, 'invtpl_section_detail_label', 'DETAIL INVOICE', 'string', NULL, '2026-05-05 03:23:08'),
(834, 'payment_gateway_merchant_code', 'DS30307', 'string', NULL, '2026-05-05 13:19:02'),
(907, 'vtpl_primary_color', '#000000', 'string', NULL, '2026-05-12 06:48:24'),
(908, 'vtpl_primary_dark', '#0d0d0d', 'string', NULL, '2026-05-11 00:35:20'),
(909, 'vtpl_accent_color', '#2e7d32', 'string', NULL, '2026-05-11 00:34:45'),
(910, 'vtpl_company_name', 'DIGSNET', 'string', NULL, '2026-05-12 06:47:52'),
(911, 'vtpl_tagline', 'Voucher Hotspot', 'string', NULL, '2026-05-11 00:34:45'),
(912, 'vtpl_logo_url', '', 'string', NULL, '2026-05-11 00:34:45'),
(913, 'vtpl_label_username', 'USERNAME', 'string', NULL, '2026-05-11 00:34:45'),
(914, 'vtpl_label_password', 'PASSWORD', 'string', NULL, '2026-05-11 00:34:45'),
(915, 'vtpl_label_profile', 'PAKET', 'string', NULL, '2026-05-11 00:34:45'),
(916, 'vtpl_label_duration', 'DURASI', 'string', NULL, '2026-05-11 00:34:45'),
(917, 'vtpl_label_price', 'HARGA', 'string', NULL, '2026-05-11 00:34:45'),
(918, 'vtpl_show_wifi', '0', 'string', NULL, '2026-05-12 06:47:52'),
(919, 'vtpl_show_price', '1', 'string', NULL, '2026-05-11 00:34:45'),
(920, 'vtpl_show_duration', '1', 'string', NULL, '2026-05-11 00:34:45'),
(921, 'vtpl_show_profile', '1', 'string', NULL, '2026-05-11 00:34:45'),
(922, 'vtpl_show_footer', '1', 'string', NULL, '2026-05-11 00:34:45'),
(923, 'vtpl_columns', '5', 'string', NULL, '2026-05-11 00:34:45'),
(924, 'vtpl_footer_text', '081292266620', 'string', NULL, '2026-05-11 00:34:45'),
(1174, 'isolir_pppoe_profile_name', 'isolir-profile', 'string', 'Nama PPP profile untuk pelanggan diisolir', '2026-05-11 12:15:30'),
(1175, 'isolir_pppoe_pool_name', 'isolir-pool', 'string', 'Nama IP pool untuk pelanggan PPPoE diisolir', '2026-05-11 12:15:30'),
(1176, 'isolir_pppoe_pool_range', '10.255.255.2-10.255.255.254', 'string', 'Range IP pool isolir', '2026-05-11 12:15:30'),
(1177, 'isolir_pppoe_local_addr', '10.255.255.1', 'string', 'Local-address PPP profile isolir (gateway)', '2026-05-11 12:15:30'),
(1178, 'isolir_pppoe_rate_limit', '128k/128k', 'string', 'Rate-limit PPP profile isolir (rx/tx)', '2026-05-11 12:15:30'),
(1765, 'isolir_page_title', '', 'string', NULL, '2026-05-16 04:11:19'),
(1766, 'isolir_page_subtitle', '', 'string', NULL, '2026-05-16 04:11:19'),
(1767, 'isolir_page_color', '#1a6ef5', 'string', NULL, '2026-05-16 04:11:19'),
(1768, 'isolir_page_footer', 'Hubungi tim kami untuk informasi lebih lanjut dan konfirmasi pembayaran Anda', 'string', NULL, '2026-05-17 07:17:01'),
(1769, 'isolir_page_help_text', '', 'string', NULL, '2026-05-16 04:11:19'),
(1770, 'isolir_page_show_invoices', '1', 'string', NULL, '2026-05-16 04:11:19'),
(1937, 'genieacs_password', 'Cikita2010', 'string', NULL, '2026-05-19 03:57:10');

-- --------------------------------------------------------

--
-- Table structure for table `assets`
--

CREATE TABLE `assets` (
  `id` int NOT NULL,
  `asset_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category_id` int DEFAULT NULL,
  `brand` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `serial_number` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('active','inactive','damaged','repair','storage','disposed','lost') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'storage',
  `condition` enum('new','good','fair','poor') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'good',
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(15,2) DEFAULT '0.00',
  `purchase_vendor` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `warranty_until` date DEFAULT NULL,
  `location` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `infrastructure_id` int DEFAULT NULL,
  `ont_device_id` int DEFAULT NULL,
  `photo_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `specs` json DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_categories`
--

CREATE TABLE `asset_categories` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `slug` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'device',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '#3b82f6',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `asset_categories`
--

INSERT INTO `asset_categories` (`id`, `name`, `slug`, `icon`, `description`, `color`, `created_at`, `updated_at`) VALUES
(1, 'Modem / ONT', 'ont', 'ont', 'Modem ONT untuk pelanggan FTTH/GPON', '#3b82f6', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(3, 'Switch', 'switch', 'switch', 'Network switch managed/unmanaged', '#06b6d4', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(4, 'Rack Server', 'rack', 'rack', 'Rack/server untuk NOC atau POP', '#f59e0b', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(5, 'OLT', 'olt', 'olt', 'Optical Line Terminal', '#10b981', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(6, 'Kabel Fiber', 'fiber', 'cable', 'Kabel FO drop/distribusi/backbone', '#64748b', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(7, 'SFP / Transceiver', 'sfp', 'sfp', 'SFP, SFP+, QSFP module', '#ec4899', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(8, 'Power Supply', 'psu', 'psu', 'UPS, adaptor, power supply unit', '#f97316', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(9, 'Perangkat Lain', 'other', 'other', 'Perangkat jaringan lainnya', '#94a3b8', '2026-04-01 13:24:30', '2026-04-01 13:24:30'),
(10, 'Kabel LAN', 'kabel_lan', 'device', NULL, '#3b82f6', '2026-04-01 06:29:12', '2026-04-01 06:29:12'),
(11, 'Tangga Teleskopik', 'tangga_teleskopik', 'device', NULL, '#10b197', '2026-04-01 07:01:25', '2026-04-01 07:01:25'),
(12, 'Router', 'router', 'device', NULL, '#3b82f6', '2026-04-01 09:04:59', '2026-04-01 09:04:59');

-- --------------------------------------------------------

--
-- Table structure for table `asset_history`
--

CREATE TABLE `asset_history` (
  `id` int NOT NULL,
  `asset_id` int NOT NULL,
  `action` enum('created','updated','status_change','assigned','unassigned','moved','repaired','disposed','photo_updated') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `old_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `new_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `performed_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `asset_history`
--

INSERT INTO `asset_history` (`id`, `asset_id`, `action`, `old_value`, `new_value`, `note`, `performed_by`, `created_at`) VALUES
(1, 1, 'created', NULL, '{\"asset_code\":\"ONT-26-00001\",\"name\":\"MODEM ZTE\",\"status\":\"active\"}', 'Asset dibuat', 4, '2026-04-01 06:28:44'),
(2, 1, 'photo_updated', NULL, '{\"photo_url\":\"/uploads/assets/asset_1775024976804_14m7p.jpeg\"}', 'Foto diperbarui', 4, '2026-04-01 06:29:36'),
(3, 1, 'assigned', '{\"customer_id\":null,\"infrastructure_id\":null,\"location\":null}', '{\"customer_id\":\"11\",\"infrastructure_id\":null,\"location\":\"Batu Tapak\"}', 'Good', 4, '2026-04-01 06:44:21'),
(4, 1, 'updated', '{\"status\":\"active\",\"customer_id\":11,\"infrastructure_id\":null,\"location\":\"Batu Tapak\"}', '{\"name\":\"MODEM ZTE\",\"category_id\":\"1\",\"brand\":\"ZTE\",\"model\":\"F442\",\"serial_number\":\"SS6363938HRG743\",\"status\":\"active\",\"condition\":\"good\",\"purchase_date\":\"2025-10-10\",\"purchase_price\":150000,\"purchase_vendor\":\"Tokped\",\"warranty_until\":null,\"location\":\"Batu Tapak\",\"customer_id\":\"11\",\"infrastructure_id\":null,\"ont_device_id\":\"86\",\"notes\":null}', NULL, 4, '2026-04-01 06:45:08'),
(6, 3, 'created', NULL, '{\"asset_code\":\"ONT-26-00003\",\"name\":\"MODEM XPON HG\",\"status\":\"damaged\"}', 'Asset dibuat', 4, '2026-04-01 07:11:32'),
(8, 5, 'created', NULL, '{\"asset_code\":\"FIB-26-00005\",\"name\":\"Pigtail Cable\",\"status\":\"storage\"}', 'Asset dibuat', 4, '2026-04-01 08:10:09'),
(9, 5, 'updated', '{\"status\":\"storage\",\"customer_id\":null,\"infrastructure_id\":null,\"location\":null}', '{\"name\":\"Pigtail Cable\",\"category_id\":\"6\",\"brand\":null,\"model\":null,\"serial_number\":null,\"status\":\"storage\",\"condition\":\"good\",\"purchase_date\":null,\"purchase_price\":1250000,\"purchase_vendor\":null,\"warranty_until\":null,\"location\":null,\"customer_id\":null,\"infrastructure_id\":null,\"ont_device_id\":null,\"notes\":null}', NULL, 4, '2026-04-01 08:10:26'),
(10, 5, 'photo_updated', NULL, '{\"photo_url\":\"/uploads/assets/asset_1775031808868_vrm6m.jpg\"}', 'Foto diperbarui', 4, '2026-04-01 08:23:28'),
(11, 3, 'photo_updated', NULL, '{\"photo_url\":\"/uploads/assets/asset_1775036204600_l66ep.jpeg\"}', 'Foto diperbarui', 4, '2026-04-01 09:36:44'),
(17, 3, 'updated', '{\"status\":\"damaged\",\"customer_id\":null,\"infrastructure_id\":null,\"location\":null}', '{\"name\":\"MODEM XPON HG\",\"category_id\":\"1\",\"brand\":\"ZTE\",\"model\":null,\"serial_number\":null,\"status\":\"damaged\",\"condition\":\"good\",\"purchase_date\":null,\"purchase_price\":210000,\"purchase_vendor\":null,\"warranty_until\":null,\"location\":null,\"customer_id\":null,\"infrastructure_id\":null,\"ont_device_id\":null,\"notes\":null}', NULL, 4, '2026-04-15 09:21:16'),
(20, 1, 'updated', '{\"status\":\"active\",\"customer_id\":11,\"infrastructure_id\":null,\"location\":\"Batu Tapak\"}', '{\"name\":\"MODEM ZTE\",\"category_id\":\"1\",\"brand\":\"ZTE\",\"model\":\"F442\",\"serial_number\":\"SS6363938HRG743\",\"status\":\"active\",\"condition\":\"good\",\"purchase_date\":\"2025-10-10\",\"purchase_price\":150000,\"purchase_vendor\":\"Tokped\",\"warranty_until\":null,\"location\":\"Customer\",\"customer_id\":\"11\",\"infrastructure_id\":null,\"ont_device_id\":null,\"notes\":null}', NULL, 4, '2026-04-26 01:38:48');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `customer_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `portal_password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `portal_enabled` tinyint(1) DEFAULT '1',
  `last_portal_login` datetime DEFAULT NULL,
  `package_id` int DEFAULT NULL,
  `status` enum('active','inactive','isolated','suspended') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'active',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `ont_sn` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ont_mac` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `installation_date` date DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `documents` json DEFAULT NULL,
  `pppoe_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pppoe_profile_original` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `static_ip` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mikrotik_id` int UNSIGNED DEFAULT NULL,
  `isolir_status` enum('active','isolated','restoring') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  `isolir_at` datetime DEFAULT NULL,
  `billing_date` int DEFAULT '1',
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `mikrotik_detected_at` timestamp NULL DEFAULT NULL,
  `mikrotik_detection_method` enum('manual','arp','active_ppp','ppp_secret') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'manual'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_push_subscriptions`
--

CREATE TABLE `customer_push_subscriptions` (
  `id` int UNSIGNED NOT NULL,
  `customer_id` int NOT NULL,
  `platform` enum('web','fcm') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'web',
  `endpoint` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `p256dh` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `auth` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fcm_token` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `device_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_used` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('router','switch','olt','ont','access_point','server','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'router',
  `brand` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `monitoring_type` enum('snmp','api','both') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'snmp',
  `snmp_community` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'public',
  `snmp_version` int DEFAULT '2',
  `snmp_port` int DEFAULT '161',
  `api_port` int DEFAULT NULL,
  `api_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `api_password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `api_protocol` enum('rest-http','rest-https','api-plain','api-ssl') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('online','offline','warning','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'offline',
  `cpu_load` float DEFAULT '0',
  `memory_usage` float DEFAULT '0',
  `uptime` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `firmware` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `poll_interval` int DEFAULT '60' COMMENT 'Poll interval in seconds',
  `last_polled` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `pop_id` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `device_logs`
--

CREATE TABLE `device_logs` (
  `id` bigint NOT NULL,
  `device_id` int NOT NULL,
  `cpu_load` float DEFAULT NULL,
  `memory_usage` float DEFAULT NULL,
  `uptime` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('online','offline','warning') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'offline',
  `interfaces` json DEFAULT NULL,
  `raw_data` json DEFAULT NULL,
  `polled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `device_logs`
--

INSERT INTO `device_logs` (`id`, `device_id`, `cpu_load`, `memory_usage`, `uptime`, `status`, `interfaces`, `raw_data`, `polled_at`, `created_at`, `updated_at`) VALUES
(24504, 21, 2, 24, '1d3h2m22s', 'online', '[{\"name\": \"ether1\", \"type\": \"ether\", \"rxMbps\": 0.469, \"txMbps\": 0, \"running\": true}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0.152, \"txMbps\": 0, \"running\": true}, {\"name\": \"l2tp-in1-ro-olt\", \"type\": \"l2tp-in\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"lo\", \"type\": \"loopback\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan11\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan100-HOTSPOT\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}]', '{\"memUsed\": 247, \"firmware\": \"7.22.3 (stable)\", \"memTotal\": 1024, \"protocol\": \"api\", \"boardName\": \"CHR Red Hat KVM\", \"diskPercent\": 5, \"totalRxMbps\": 0.62, \"totalTxMbps\": 0}', '2026-05-16 23:32:48', '2026-05-16 23:32:48', '2026-05-16 23:32:48'),
(24518, 25, 97, 40, '1w22h43m28s', 'warning', '[{\"name\": \"ether1-net\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether3\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether4\", \"type\": \"ether\", \"rxMbps\": 7.951, \"txMbps\": 123.418, \"running\": true}, {\"name\": \"ether5\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether6\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether7\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether8\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether9\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether10\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"sfp1\", \"type\": \"ether\", \"rxMbps\": 123.808, \"txMbps\": 8.133, \"running\": true}, {\"name\": \"VLAN_DDCUP\", \"type\": \"vlan\", \"rxMbps\": 115.487, \"txMbps\": 6.733, \"running\": true}]', '{\"memUsed\": 51, \"firmware\": \"7.21 (stable)\", \"memTotal\": 128, \"protocol\": \"api\", \"boardName\": \"RB2011UiAS\", \"diskPercent\": 14, \"totalRxMbps\": 247.246, \"totalTxMbps\": 138.284}', '2026-05-17 07:13:12', '2026-05-17 07:13:12', '2026-05-17 07:13:12'),
(24519, 25, 100, 40, '1w1d4h57m51s', 'warning', '[{\"name\": \"ether1-net\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether3\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether4\", \"type\": \"ether\", \"rxMbps\": 11.377, \"txMbps\": 101.345, \"running\": true}, {\"name\": \"ether5\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether6\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether7\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether8\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether9\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"ether10\", \"type\": \"ether\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"sfp1\", \"type\": \"ether\", \"rxMbps\": 112.621, \"txMbps\": 10.469, \"running\": true}, {\"name\": \"VLAN_DDCUP\", \"type\": \"vlan\", \"rxMbps\": 95.524, \"txMbps\": 9.361, \"running\": true}]', '{\"memUsed\": 52, \"firmware\": \"7.21 (stable)\", \"memTotal\": 128, \"protocol\": \"api\", \"boardName\": \"RB2011UiAS\", \"diskPercent\": 14, \"totalRxMbps\": 219.522, \"totalTxMbps\": 121.174}', '2026-05-17 13:27:36', '2026-05-17 13:27:36', '2026-05-17 13:27:36'),
(24520, 21, 6, 24, '1d16h57m15s', 'online', '[{\"name\": \"ether1\", \"type\": \"ether\", \"rxMbps\": 0.4, \"txMbps\": 0.015, \"running\": true}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0.156, \"txMbps\": 0.002, \"running\": true}, {\"name\": \"<l2tp-ro-olt>\", \"type\": \"l2tp-in\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"l2tp-in1-ro-olt\", \"type\": \"l2tp-in\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": false}, {\"name\": \"lo\", \"type\": \"loopback\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan11\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0.001, \"running\": true}, {\"name\": \"vlan100-HOTSPOT\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}]', '{\"memUsed\": 250, \"firmware\": \"7.22.3 (stable)\", \"memTotal\": 1024, \"protocol\": \"api\", \"boardName\": \"CHR Red Hat KVM\", \"diskPercent\": 5, \"totalRxMbps\": 0.556, \"totalTxMbps\": 0.017}', '2026-05-17 13:27:43', '2026-05-17 13:27:43', '2026-05-17 13:27:43'),
(24522, 20, 8, 25, '2d14h56m33s', 'online', '[{\"name\": \"ether1\", \"type\": \"ether\", \"rxMbps\": 0.392, \"txMbps\": 0.022, \"running\": true}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0.148, \"txMbps\": 0, \"running\": true}, {\"name\": \"l2tp-in1-ro-olt\", \"type\": \"l2tp-in\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"lo\", \"type\": \"loopback\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan11\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan100-HOTSPOT\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}]', '{\"memUsed\": 252, \"firmware\": \"7.22.3 (stable)\", \"memTotal\": 1024, \"protocol\": \"api\", \"boardName\": \"CHR Red Hat KVM\", \"diskPercent\": 5, \"totalRxMbps\": 0.54, \"totalTxMbps\": 0.022}', '2026-05-18 11:27:05', '2026-05-18 11:27:05', '2026-05-18 11:27:05'),
(24523, 20, 6, 24, '5h55m59s', 'online', '[{\"name\": \"ether1\", \"type\": \"ether\", \"rxMbps\": 0.422, \"txMbps\": 0.006, \"running\": true}, {\"name\": \"ether2\", \"type\": \"ether\", \"rxMbps\": 0.139, \"txMbps\": 0, \"running\": true}, {\"name\": \"l2tp-in1-ro-olt\", \"type\": \"l2tp-in\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"lo\", \"type\": \"loopback\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan11\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}, {\"name\": \"vlan100-HOTSPOT\", \"type\": \"vlan\", \"rxMbps\": 0, \"txMbps\": 0, \"running\": true}]', '{\"memUsed\": 246, \"firmware\": \"7.22.3 (stable)\", \"memTotal\": 1024, \"protocol\": \"api\", \"boardName\": \"CHR Red Hat KVM\", \"diskPercent\": 5, \"totalRxMbps\": 0.561, \"totalTxMbps\": 0.006}', '2026-05-19 00:44:38', '2026-05-19 00:44:38', '2026-05-19 00:44:38');

-- --------------------------------------------------------

--
-- Table structure for table `financial_reports`
--

CREATE TABLE `financial_reports` (
  `id` int NOT NULL,
  `report_type` enum('monthly','yearly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `period_month` int DEFAULT NULL,
  `period_year` int NOT NULL,
  `total_revenue` decimal(15,2) DEFAULT '0.00',
  `total_invoiced` decimal(15,2) DEFAULT '0.00',
  `total_outstanding` decimal(15,2) DEFAULT '0.00',
  `total_customers` int DEFAULT '0',
  `new_customers` int DEFAULT '0',
  `churned_customers` int DEFAULT '0',
  `report_data` json DEFAULT NULL,
  `generated_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `infrastructure_links`
--

CREATE TABLE `infrastructure_links` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `from_point_id` int NOT NULL,
  `to_point_id` int NOT NULL,
  `link_type` enum('fiber','copper','wireless','trunk') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'fiber',
  `status` enum('active','inactive','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'active',
  `distance_m` int DEFAULT NULL COMMENT 'estimated cable length in meters',
  `waypoints` json DEFAULT NULL COMMENT 'Array of [lat,lng] intermediate points',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `infrastructure_points`
--

CREATE TABLE `infrastructure_points` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('odp','odc','ont','customer','pop','tower') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` enum('active','inactive','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'active',
  `capacity` int DEFAULT NULL,
  `used_ports` int DEFAULT '0',
  `parent_id` int DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `infrastructure_points`
--

INSERT INTO `infrastructure_points` (`id`, `name`, `type`, `latitude`, `longitude`, `address`, `status`, `capacity`, `used_ports`, `parent_id`, `metadata`, `notes`, `created_at`, `updated_at`) VALUES
(40, 'ROOM PPPOE', 'customer', -6.59768122, 106.79895401, NULL, 'active', NULL, 0, NULL, '{\"customer_id\": 244}', NULL, '2026-05-09 16:13:07', '2026-05-09 16:13:07'),
(41, 'POP BOGOR', 'pop', -6.59663675, 106.79729640, 'JL. Raya Bogor', 'active', 17, 0, NULL, '{\"pop_type\": \"olt\", \"photo_url\": \"/uploads/infra/infra_1778415185020_gs2ic.jpg\"}', '', '2026-05-10 11:51:23', '2026-05-10 12:39:04'),
(42, 'TIANG 1', 'tower', -6.59676865, 106.79770947, NULL, 'active', NULL, 0, NULL, NULL, NULL, '2026-05-10 12:43:25', '2026-05-18 11:14:48');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int NOT NULL,
  `invoice_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `customer_id` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `tax` decimal(12,2) DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL,
  `status` enum('unpaid','paid','overdue','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'unpaid',
  `last_wa_reminder_at` datetime DEFAULT NULL,
  `due_date` date NOT NULL,
  `paid_date` date DEFAULT NULL,
  `period_month` int NOT NULL,
  `period_year` int NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `pdf_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `isolir_bypass_global`
--

CREATE TABLE `isolir_bypass_global` (
  `id` int UNSIGNED NOT NULL,
  `address` varchar(100) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'custom',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `isolir_bypass_global`
--

INSERT INTO `isolir_bypass_global` (`id`, `address`, `label`, `category`, `is_active`, `created_at`) VALUES
(1, '8.8.8.8', 'bank', 'custom', 1, '2026-05-09 17:15:46'),
(2, '8.8.4.4', 'Google DNS Secondary', 'dns', 1, '2026-05-09 17:25:36'),
(4, '1.0.0.1', 'Cloudflare DNS Secondary', 'dns', 1, '2026-05-09 17:25:36'),
(5, '192.168.0.0/16', 'LAN Private Range', 'network', 1, '2026-05-09 17:25:36'),
(6, '10.0.0.0/8', 'LAN Private Range', 'network', 1, '2026-05-09 17:25:36'),
(7, '172.16.0.0/12', 'LAN Private Range', 'network', 1, '2026-05-09 17:25:36');

-- --------------------------------------------------------

--
-- Table structure for table `isolir_bypass_router`
--

CREATE TABLE `isolir_bypass_router` (
  `id` int UNSIGNED NOT NULL,
  `device_id` int UNSIGNED NOT NULL,
  `address` varchar(100) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `isolir_logs`
--

CREATE TABLE `isolir_logs` (
  `id` int UNSIGNED NOT NULL,
  `customer_id` int NOT NULL,
  `device_id` int UNSIGNED DEFAULT NULL,
  `static_ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pppoe_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action` enum('isolir','restore','setup_firewall') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `isolir_method` enum('static','pppoe') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'static',
  `trigger_by` enum('cron','admin','payment') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'admin',
  `triggered_by_user` int DEFAULT NULL,
  `addrlist_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '0',
  `error_msg` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `keuangan`
--

CREATE TABLE `keuangan` (
  `id` int NOT NULL,
  `type` enum('pemasukan','pengeluaran','hutang','piutang','modal') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `party_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('lunas','belum_lunas','cicilan') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `source` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `attachment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ref_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recorded_by` int DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mikrotik_devices`
--

CREATE TABLE `mikrotik_devices` (
  `id` int UNSIGNED NOT NULL,
  `status` enum('online','offline','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'unknown',
  `last_ping` datetime DEFAULT NULL,
  `wan_interface` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ether1',
  `isolir_page_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `device_id` int NOT NULL,
  `binary_port` smallint UNSIGNED DEFAULT '8728'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `noc_monitor_presets`
--

CREATE TABLE `noc_monitor_presets` (
  `id` int NOT NULL,
  `user_id` int NOT NULL COMMENT 'Owner — preset bersifat private per user',
  `router_id` int NOT NULL COMMENT 'Device.id dari router yang dipantau',
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Label custom yang ditampilkan di header panel',
  `ifaces` json NOT NULL COMMENT 'Array<string> nama interface MikroTik (e.g. ["ether1","sfp1"])',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '#3b82f6' COMMENT 'Hex warna utama chart (RX line). TX otomatis turunan.',
  `position` int NOT NULL DEFAULT '0' COMMENT 'Urutan render — lower first',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `severity` enum('info','warning','error','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT '0',
  `link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ont_devices`
--

CREATE TABLE `ont_devices` (
  `id` int NOT NULL,
  `serial_number` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Serial number ONT (unik)',
  `customer_id` int DEFAULT NULL,
  `device_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'GenieACS device ID',
  `manufacturer` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `firmware` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('online','offline','warning','unknown') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'unknown' COMMENT 'online | offline | warning (sinyal lemah) | unknown',
  `signal_strength` float DEFAULT NULL COMMENT 'dBm',
  `uptime` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mac_address` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_inform` datetime DEFAULT NULL,
  `tr069_params` json DEFAULT NULL,
  `last_synced` datetime DEFAULT NULL,
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'genieacs' COMMENT 'sumber data: genieacs | snmp_hsgq | snmp_zte | manual',
  `olt_source_id` int DEFAULT NULL COMMENT 'ID OLT di olt_config.json',
  `olt_index` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Index ONU di OLT SNMP (contoh: 1.3 = PON 1, ONU 3)',
  `pon_port` tinyint UNSIGNED DEFAULT NULL COMMENT 'PON port di OLT (1-4 untuk E04I)',
  `onu_id` smallint UNSIGNED DEFAULT NULL COMMENT 'ONU ID di PON port',
  `distance_m` smallint UNSIGNED DEFAULT NULL COMMENT 'Jarak ONT ke OLT (meter)',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `packages`
--

CREATE TABLE `packages` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `speed_down` int NOT NULL COMMENT 'Download speed in Mbps',
  `speed_up` int NOT NULL COMMENT 'Upload speed in Mbps',
  `price` decimal(12,2) NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `category` enum('home','business','enterprise','custom') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'home',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int NOT NULL,
  `invoice_id` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` enum('cash','transfer','dana','ovo','gopay','qris','ewallet','gateway','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'cash',
  `payment_date` date NOT NULL,
  `reference_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recorded_by` int DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `wa_sent_status` enum('sent','failed','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `wa_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `display_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `display_name`, `module`, `description`, `created_at`, `updated_at`) VALUES
(1, 'dashboard_view', 'View Dashboard', 'dashboard', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(2, 'customer_view', 'View Customers', 'customer', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(3, 'customer_create', 'Create Customer', 'customer', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(4, 'customer_update', 'Update Customer', 'customer', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(5, 'customer_delete', 'Delete Customer', 'customer', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(6, 'billing_view', 'View Billing', 'billing', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(7, 'billing_generate', 'Generate Invoices', 'billing', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(8, 'billing_payment', 'Record Payment', 'billing', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(9, 'device_view', 'View Devices', 'device', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(10, 'device_create', 'Create Device', 'device', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(11, 'device_update', 'Update Device', 'device', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(12, 'device_delete', 'Delete Device', 'device', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(13, 'infra_view', 'View Infrastructure', 'infrastructure', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(14, 'infra_create', 'Create Infrastructure', 'infrastructure', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(15, 'infra_update', 'Update Infrastructure', 'infrastructure', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(16, 'infra_delete', 'Delete Infrastructure', 'infrastructure', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(17, 'ont_view', 'View ONT', 'ont', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(18, 'ont_reboot', 'Reboot ONT', 'ont', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(19, 'ont_sync', 'Sync ONT', 'ont', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(20, 'user_manage', 'Manage Users', 'system', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(21, 'role_manage', 'Manage Roles', 'system', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(22, 'logs_view', 'View Logs', 'system', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(23, 'settings_manage', 'Manage Settings', 'system', NULL, '2026-03-01 06:53:44', '2026-03-01 06:53:44');

-- --------------------------------------------------------

--
-- Table structure for table `push_notifications`
--

CREATE TABLE `push_notifications` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `tag` varchar(60) DEFAULT NULL,
  `filters` json DEFAULT NULL,
  `target_count` int DEFAULT '0',
  `sent_count` int DEFAULT '0',
  `failed_count` int DEFAULT '0',
  `status` enum('scheduled','pending','sent','failed','cancelled') DEFAULT 'pending',
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `error_message` text,
  `template_id` int UNSIGNED DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `push_templates`
--

CREATE TABLE `push_templates` (
  `id` int UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` enum('promo','info','maintenance','warning','greeting','other') DEFAULT 'info',
  `icon` varchar(10) DEFAULT NULL,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `url` varchar(255) DEFAULT NULL,
  `tag` varchar(60) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `push_templates`
--

INSERT INTO `push_templates` (`id`, `name`, `category`, `icon`, `title`, `body`, `url`, `tag`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Promo Diskon Paket', 'promo', '🎉', 'Promo Spesial!', 'Dapatkan diskon 20% untuk upgrade paket internet Anda bulan ini. Buruan sebelum kehabisan!', '/portal', 'promo', NULL, '2026-04-19 22:13:40', '2026-04-19 22:13:40'),
(2, 'Info Maintenance', 'maintenance', '🔧', 'Jadwal Maintenance', 'Maintenance jaringan akan dilakukan pada hari Minggu jam 02:00–04:00 WIB. Mohon maaf atas ketidaknyamanannya.', '/portal', 'maintenance', NULL, '2026-04-19 22:13:40', '2026-04-19 22:13:40'),
(3, 'Reminder Pembayaran', 'warning', '💳', 'Tagihan Belum Lunas', 'Tagihan internet Anda belum lunas. Segera lakukan pembayaran untuk menghindari pemutusan layanan.', '/portal/dashboard', 'billing', NULL, '2026-04-19 22:13:40', '2026-04-19 22:13:40'),
(4, 'Ucapan Selamat', 'greeting', '🙏', 'Selamat Hari Raya', 'Segenap keluarga besar mengucapkan selamat merayakan hari raya. Semoga sehat selalu bersama keluarga.', '/portal', 'greeting', NULL, '2026-04-19 22:13:40', '2026-04-19 22:13:40'),
(5, 'Info Gangguan', 'info', '⚠️', 'Gangguan Jaringan', 'Sedang terjadi gangguan di area Anda. Tim teknis kami sedang menangani. Mohon bersabar.', '/portal', 'outage', NULL, '2026-04-19 22:13:40', '2026-04-19 22:13:40'),
(6, 'Diskon Promo', 'info', NULL, 'Promo', 'Besar', NULL, NULL, 4, '2026-04-20 15:45:26', '2026-04-20 15:45:26');

-- --------------------------------------------------------

--
-- Table structure for table `queue_history`
--

CREATE TABLE `queue_history` (
  `id` bigint NOT NULL,
  `queue_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'MikroTik queue .id',
  `queue_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `rx_rate` bigint DEFAULT '0' COMMENT 'bits/s download',
  `tx_rate` bigint DEFAULT '0' COMMENT 'bits/s upload',
  `rx_bytes` bigint DEFAULT '0' COMMENT 'cumulative download bytes',
  `tx_bytes` bigint DEFAULT '0' COMMENT 'cumulative upload bytes',
  `recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reminder_settings`
--

CREATE TABLE `reminder_settings` (
  `id` int UNSIGNED NOT NULL,
  `type` enum('before','due','overdue') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `days_offset` tinyint NOT NULL DEFAULT '0',
  `template_id` int UNSIGNED DEFAULT NULL,
  `send_time` time NOT NULL DEFAULT '08:00:00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reminder_settings`
--

INSERT INTO `reminder_settings` (`id`, `type`, `days_offset`, `template_id`, `send_time`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'before', -3, NULL, '08:00:00', 0, '2026-05-02 08:04:16', '2026-05-16 15:19:57'),
(2, 'before', -1, NULL, '08:00:00', 0, '2026-05-02 08:04:16', '2026-05-16 15:19:57'),
(3, 'due', 0, NULL, '08:00:00', 0, '2026-05-02 08:04:16', '2026-05-16 15:19:57'),
(4, 'overdue', 1, NULL, '08:00:00', 0, '2026-05-02 08:04:16', '2026-05-16 15:19:57'),
(5, 'overdue', 3, NULL, '08:00:00', 0, '2026-05-02 08:04:16', '2026-05-16 15:19:57');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `display_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_system` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `display_name`, `description`, `is_system`, `created_at`, `updated_at`) VALUES
(1, 'superadmin', 'Super Administrator', 'Full access to all system features', 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(2, 'admin', 'Administrator', 'Administrative access with limited system settings', 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(3, 'technician', 'Technician', 'Technical staff with monitoring and customer access', 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(4, 'demo', 'Demo User (Read-Only)', 'Akun percobaan — hanya bisa melihat data sampel, tidak bisa mengubah apapun.', 1, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(5, 'finance', 'Admin Finance', 'Akses khusus modul billing, pembayaran, keuangan, dan laporan keuangan.', 1, '2026-05-14 16:56:41', '2026-05-14 16:56:41'),
(6, 'noc', 'Admin NOC', 'Akses khusus monitoring jaringan: traffic, PPPoE, OLT/ONT, devices, dan infrastructure.', 1, '2026-05-16 23:31:36', '2026-05-16 23:31:36');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` int NOT NULL,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`id`, `role_id`, `permission_id`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(2, 1, 2, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(3, 1, 3, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(4, 1, 4, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(5, 1, 5, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(6, 1, 6, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(7, 1, 7, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(8, 1, 8, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(9, 1, 9, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(10, 1, 10, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(11, 1, 11, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(12, 1, 12, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(13, 1, 13, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(14, 1, 14, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(15, 1, 15, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(16, 1, 16, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(17, 1, 17, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(18, 1, 18, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(19, 1, 19, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(20, 1, 20, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(21, 1, 21, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(22, 1, 22, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(23, 1, 23, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(24, 2, 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(25, 2, 2, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(26, 2, 3, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(27, 2, 4, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(28, 2, 5, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(29, 2, 6, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(30, 2, 7, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(31, 2, 8, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(32, 2, 9, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(33, 2, 10, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(34, 2, 11, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(35, 2, 12, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(36, 2, 13, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(37, 2, 14, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(38, 2, 15, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(39, 2, 16, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(40, 2, 17, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(41, 2, 18, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(42, 2, 19, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(43, 2, 20, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(44, 2, 22, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(45, 3, 1, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(46, 3, 2, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(47, 3, 4, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(48, 3, 6, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(49, 3, 9, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(50, 3, 11, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(51, 3, 13, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(52, 3, 17, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(53, 3, 18, '2026-03-01 06:53:44', '2026-03-01 06:53:44'),
(54, 4, 6, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(55, 4, 2, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(56, 4, 1, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(57, 4, 9, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(58, 4, 13, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(59, 4, 22, '2026-04-25 16:40:42', '2026-04-25 16:40:42'),
(60, 4, 17, '2026-04-25 16:40:42', '2026-04-25 16:40:42');

-- --------------------------------------------------------

--
-- Table structure for table `technician_locations`
--

CREATE TABLE `technician_locations` (
  `id` int UNSIGNED NOT NULL,
  `technician_id` int NOT NULL COMMENT 'FK to users.id',
  `ticket_id` int UNSIGNED DEFAULT NULL COMMENT 'FK to tickets.id',
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `accuracy` float DEFAULT NULL COMMENT 'Meters',
  `speed` float DEFAULT NULL COMMENT 'm/s',
  `heading` float DEFAULT NULL COMMENT 'Degrees 0-360',
  `altitude` float DEFAULT NULL COMMENT 'Meters',
  `is_active` tinyint(1) DEFAULT '1',
  `battery_level` int DEFAULT NULL COMMENT '0-100',
  `device_info` json DEFAULT NULL,
  `recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GPS location points';

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `id` int UNSIGNED NOT NULL,
  `ticket_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('gangguan','request','installation','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'gangguan',
  `priority` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium',
  `status` enum('open','in_progress','pending','resolved','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'open',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `customer_id` int DEFAULT NULL,
  `infra_point_id` int DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location_note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sla_hours` int DEFAULT '24',
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `due_at` datetime DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ticket_timelines`
--

CREATE TABLE `ticket_timelines` (
  `id` int UNSIGNED NOT NULL,
  `ticket_id` int UNSIGNED NOT NULL,
  `user_id` int DEFAULT NULL,
  `type` enum('comment','status_change','assignment','photo','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'comment',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `old_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `new_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `attachments` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ticket_timelines`
--

INSERT INTO `ticket_timelines` (`id`, `ticket_id`, `user_id`, `type`, `content`, `old_value`, `new_value`, `attachments`, `created_at`) VALUES
(200, 56, 19, 'system', 'Ticket GAN-260517-0001 dibuat', NULL, NULL, NULL, '2026-05-17 05:30:41'),
(201, 57, 19, 'system', 'Ticket GAN-260517-0002 dibuat', NULL, NULL, NULL, '2026-05-17 07:06:32'),
(202, 57, 4, 'status_change', 'Status berubah dari Open → In Progress', 'open', 'in_progress', NULL, '2026-05-17 10:53:18'),
(203, 57, 4, 'status_change', 'Status berubah dari In Progress → Resolved', 'in_progress', 'resolved', NULL, '2026-05-17 10:55:22'),
(204, 58, 4, 'system', 'Ticket GAN-260517-0003 dibuat', NULL, NULL, NULL, '2026-05-17 10:55:47'),
(205, 56, 4, 'status_change', 'Status berubah dari Open → Closed', 'open', 'closed', NULL, '2026-05-17 13:01:46'),
(206, 58, 4, 'status_change', 'Status berubah dari Open → Resolved', 'open', 'resolved', NULL, '2026-05-17 13:25:55'),
(207, 59, 4, 'system', 'Ticket GAN-260518-0001 dibuat', NULL, NULL, NULL, '2026-05-18 01:24:19'),
(208, 59, 4, 'status_change', 'Status berubah dari Open → Resolved', 'open', 'resolved', NULL, '2026-05-18 03:37:36');

-- --------------------------------------------------------

--
-- Table structure for table `todos`
--

CREATE TABLE `todos` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('todo','in_progress','done') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'todo',
  `priority` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `due_date` date DEFAULT NULL,
  `assigned_to` int UNSIGNED DEFAULT NULL,
  `created_by` int UNSIGNED DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `tags` json DEFAULT NULL,
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'blue',
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topology_connections`
--

CREATE TABLE `topology_connections` (
  `id` int NOT NULL,
  `source_id` int NOT NULL,
  `target_id` int NOT NULL,
  `label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interface_source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interface_target` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bandwidth` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `connection_type` enum('ethernet','fiber','wireless','vpn') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ethernet',
  `status` enum('active','inactive','down') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topology_devices`
--

CREATE TABLE `topology_devices` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('router','switch','server','client','gateway','firewall','access_point','ont') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'router',
  `ip_address` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `protocol` enum('mikrotik','snmp','manual','api') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `snmp_community` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `port` int DEFAULT NULL,
  `position_x` int DEFAULT '0',
  `position_y` int DEFAULT '0',
  `status` enum('online','offline','unknown','active') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firmware_version` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `icon_data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tracking_sessions`
--

CREATE TABLE `tracking_sessions` (
  `id` int UNSIGNED NOT NULL,
  `session_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID session identifier',
  `technician_id` int NOT NULL COMMENT 'FK to users.id',
  `ticket_id` int UNSIGNED NOT NULL COMMENT 'FK to tickets.id',
  `status` enum('active','paused','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `start_latitude` decimal(10,8) DEFAULT NULL,
  `start_longitude` decimal(11,8) DEFAULT NULL,
  `end_latitude` decimal(10,8) DEFAULT NULL,
  `end_longitude` decimal(11,8) DEFAULT NULL,
  `total_distance` float DEFAULT '0' COMMENT 'Meters',
  `total_duration` int DEFAULT '0' COMMENT 'Seconds',
  `points_count` int DEFAULT '0',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GPS tracking sessions';

-- --------------------------------------------------------

--
-- Table structure for table `traffic_data`
--

CREATE TABLE `traffic_data` (
  `id` bigint NOT NULL,
  `device_id` int NOT NULL,
  `interface_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `rx_bytes` bigint DEFAULT '0',
  `tx_bytes` bigint DEFAULT '0',
  `rx_rate` bigint DEFAULT '0' COMMENT 'bits per second',
  `tx_rate` bigint DEFAULT '0' COMMENT 'bits per second',
  `recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `role_id` int NOT NULL,
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_demo` tinyint(1) NOT NULL DEFAULT '0',
  `demo_expires_at` datetime DEFAULT NULL,
  `demo_extended` tinyint(1) NOT NULL DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `refresh_token` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `uuid`, `name`, `email`, `password`, `role_id`, `avatar`, `phone`, `is_active`, `is_demo`, `demo_expires_at`, `demo_extended`, `last_login`, `refresh_token`, `created_at`, `updated_at`) VALUES
(18, 'f70fdb22-e941-4e12-89ed-55e08100ff06', 'Finance', 'finance@digs.co.id', '$2a$12$/Kohh7c797.c5cPpBGiC4ebtCFSAPMQ1uwC2B931FVsRaupf9Q772', 5, NULL, '08122', 1, 0, NULL, 0, '2026-05-17 10:07:34', NULL, '2026-05-14 16:58:23', '2026-05-17 10:50:05'),
(19, '947daaf0-5f8e-42e3-aa1c-ea7ae3422c50', 'NOC', 'noc@digs.co.id', '$2a$12$ZhBgu59vuYDanIgEQ6kVvuVWKUlAPGT1p/Zw2F24u3GiWJSZ.Ph0O', 6, NULL, '', 1, 0, NULL, 0, '2026-05-17 11:55:14', NULL, '2026-05-17 00:23:11', '2026-05-17 11:58:39'),
(20, '76074c7f-4825-42f8-9400-10e2df6b2f66', 'Administrator', 'administrator@flaynet.com', '$2a$12$HCv1YrStqD8RpU1LGT2/y.XQmWxvfLKZlVHTm4PdA9CpqsJqme/di', 1, NULL, '081111222333', 1, 0, NULL, 0, '2026-05-19 03:56:22', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc3OTE2Mjk4MiwiZXhwIjoxNzc5NzY3NzgyfQ.HfaFQGQI_K5mayflVrl2gMpa0YMGtn3CcuBL4ypstsw', '2026-05-19 03:55:49', '2026-05-19 03:56:22');

-- --------------------------------------------------------

--
-- Table structure for table `user_dashboard_layouts`
--

CREATE TABLE `user_dashboard_layouts` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int NOT NULL,
  `layout_config` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_auto_replies`
--

CREATE TABLE `wa_auto_replies` (
  `id` int NOT NULL,
  `session_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `keyword` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `match_type` enum('exact','contains','startswith') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'contains',
  `reply_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `hit_count` int DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_broadcast`
--

CREATE TABLE `wa_broadcast` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `template_id` int UNSIGNED DEFAULT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_type` enum('all','active','by_package','overdue','custom') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'all',
  `target_filter` json DEFAULT NULL,
  `status` enum('draft','scheduled','running','completed','cancelled','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `total_targets` int UNSIGNED NOT NULL DEFAULT '0',
  `total_sent` int UNSIGNED NOT NULL DEFAULT '0',
  `total_failed` int UNSIGNED NOT NULL DEFAULT '0',
  `send_interval` smallint UNSIGNED NOT NULL DEFAULT '10' COMMENT 'Delay antar pesan (detik), min 8',
  `created_by` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_incoming`
--

CREATE TABLE `wa_incoming` (
  `id` int UNSIGNED NOT NULL,
  `device_id` int UNSIGNED DEFAULT NULL,
  `from_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `from_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `direction` enum('in','out') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'in',
  `media_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `media_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_read` tinyint(1) DEFAULT '0',
  `is_replied` tinyint(1) DEFAULT '0',
  `replied_at` datetime DEFAULT NULL,
  `received_at` datetime NOT NULL,
  `is_auto` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_logs`
--

CREATE TABLE `wa_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `queue_id` bigint UNSIGNED DEFAULT NULL,
  `device_id` int UNSIGNED DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('reminder','broadcast','manual','otp') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'manual',
  `status` enum('sent','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'sent',
  `api_response` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `api_status` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `duration_ms` int UNSIGNED DEFAULT NULL,
  `sent_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_messages`
--

CREATE TABLE `wa_messages` (
  `id` int NOT NULL,
  `session_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `direction` enum('inbound','outbound') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `from_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `push_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `to_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message_type` enum('text','image','document','audio','template') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'text',
  `status` enum('pending','sent','delivered','read','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `wa_message_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `media_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `customer_id` int DEFAULT NULL,
  `is_auto_reply` tinyint(1) DEFAULT '0',
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_sessions`
--

CREATE TABLE `wa_sessions` (
  `id` int NOT NULL,
  `session_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phone_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('disconnected','connecting','connected','banned') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'disconnected',
  `qr_code` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `last_seen` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `webhook_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `auto_reply_enabled` tinyint(1) DEFAULT '0',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_templates`
--

CREATE TABLE `wa_templates` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('reminder_before','reminder_due','reminder_overdue','broadcast','custom','payment_confirm','isolir','restore','welcome') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'custom',
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `variables` json DEFAULT NULL,
  `created_by` int UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `usage_count` int DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `work_orders`
--

CREATE TABLE `work_orders` (
  `id` int UNSIGNED NOT NULL,
  `wo_number` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('installation','maintenance','dismantle','survey','repair','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'installation',
  `status` enum('pending','assigned','in_progress','done','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `priority` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `customer_id` int UNSIGNED DEFAULT NULL,
  `ticket_id` int UNSIGNED DEFAULT NULL,
  `assigned_user_id` int UNSIGNED DEFAULT NULL,
  `technician_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `technician_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `scheduled_time` time DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `location_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `completion_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `photos` json DEFAULT NULL,
  `created_by` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `activity_logs_user_id` (`user_id`),
  ADD KEY `activity_logs_action` (`action`),
  ADD KEY `activity_logs_module` (`module`),
  ADD KEY `activity_logs_created_at` (`created_at`);

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_active_until` (`is_active`,`show_until`),
  ADD KEY `announcements_is_active_show_until` (`is_active`,`show_until`);

--
-- Indexes for table `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_key` (`key`);

--
-- Indexes for table `assets`
--
ALTER TABLE `assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `asset_code` (`asset_code`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_customer` (`customer_id`),
  ADD KEY `idx_infra` (`infrastructure_id`),
  ADD KEY `idx_serial` (`serial_number`),
  ADD KEY `fk_asset_assignedby` (`assigned_by`);

--
-- Indexes for table `asset_categories`
--
ALTER TABLE `asset_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `asset_history`
--
ALTER TABLE `asset_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_asset_id` (`asset_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `fk_assethistory_user` (`performed_by`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_id` (`customer_id`),
  ADD KEY `package_id` (`package_id`),
  ADD KEY `customers_customer_id` (`customer_id`),
  ADD KEY `customers_status` (`status`),
  ADD KEY `customers_name` (`name`),
  ADD KEY `customers_phone` (`phone`),
  ADD KEY `idx_customers_portal_login` (`customer_id`,`portal_enabled`),
  ADD KEY `idx_customers_phone_portal` (`phone`,`portal_enabled`);

--
-- Indexes for table `customer_push_subscriptions`
--
ALTER TABLE `customer_push_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_customer_active` (`customer_id`,`is_active`),
  ADD KEY `customer_push_subscriptions_customer_id` (`customer_id`),
  ADD KEY `customer_push_subscriptions_customer_id_is_active` (`customer_id`,`is_active`),
  ADD KEY `customer_push_subscriptions_customer_id_platform` (`customer_id`,`platform`);

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `devices_ip_address` (`ip_address`),
  ADD KEY `devices_status` (`status`),
  ADD KEY `devices_type` (`type`),
  ADD KEY `devices_pop_id` (`pop_id`);

--
-- Indexes for table `device_logs`
--
ALTER TABLE `device_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `device_logs_device_id` (`device_id`),
  ADD KEY `device_logs_polled_at` (`polled_at`),
  ADD KEY `device_logs_device_id_polled_at` (`device_id`,`polled_at`);

--
-- Indexes for table `financial_reports`
--
ALTER TABLE `financial_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `financial_reports_report_type` (`report_type`),
  ADD KEY `financial_reports_period_year_period_month` (`period_year`,`period_month`);

--
-- Indexes for table `infrastructure_links`
--
ALTER TABLE `infrastructure_links`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_from` (`from_point_id`),
  ADD KEY `idx_to` (`to_point_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `infrastructure_links_from_point_id` (`from_point_id`),
  ADD KEY `infrastructure_links_to_point_id` (`to_point_id`),
  ADD KEY `infrastructure_links_status` (`status`);

--
-- Indexes for table `infrastructure_points`
--
ALTER TABLE `infrastructure_points`
  ADD PRIMARY KEY (`id`),
  ADD KEY `parent_id` (`parent_id`),
  ADD KEY `infrastructure_points_type` (`type`),
  ADD KEY `infrastructure_points_status` (`status`),
  ADD KEY `infrastructure_points_latitude_longitude` (`latitude`,`longitude`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `invoices_invoice_number` (`invoice_number`),
  ADD KEY `invoices_customer_id` (`customer_id`),
  ADD KEY `invoices_status` (`status`),
  ADD KEY `invoices_due_date` (`due_date`),
  ADD KEY `invoices_period_month_period_year` (`period_month`,`period_year`);

--
-- Indexes for table `isolir_bypass_global`
--
ALTER TABLE `isolir_bypass_global`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_addr` (`address`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `isolir_bypass_router`
--
ALTER TABLE `isolir_bypass_router`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_dev_addr` (`device_id`,`address`),
  ADD KEY `idx_device` (`device_id`);

--
-- Indexes for table `isolir_logs`
--
ALTER TABLE `isolir_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer` (`customer_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `keuangan`
--
ALTER TABLE `keuangan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `fk_keuangan_user` (`recorded_by`),
  ADD KEY `keuangan_type` (`type`),
  ADD KEY `keuangan_date` (`date`),
  ADD KEY `keuangan_status` (`status`),
  ADD KEY `keuangan_category` (`category`);

--
-- Indexes for table `mikrotik_devices`
--
ALTER TABLE `mikrotik_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_device_id` (`device_id`);

--
-- Indexes for table `noc_monitor_presets`
--
ALTER TABLE `noc_monitor_presets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `router_id` (`router_id`),
  ADD KEY `noc_monitor_presets_user_id` (`user_id`),
  ADD KEY `noc_monitor_presets_user_id_router_id` (`user_id`,`router_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `notifications_user_id_is_read` (`user_id`,`is_read`),
  ADD KEY `notifications_type` (`type`),
  ADD KEY `notifications_created_at` (`created_at`);

--
-- Indexes for table `ont_devices`
--
ALTER TABLE `ont_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial_number` (`serial_number`),
  ADD KEY `ont_devices_serial_number` (`serial_number`),
  ADD KEY `ont_devices_customer_id` (`customer_id`),
  ADD KEY `ont_devices_status` (`status`),
  ADD KEY `idx_source` (`source`),
  ADD KEY `idx_olt_source` (`olt_source_id`),
  ADD KEY `idx_olt_source_id` (`olt_source_id`),
  ADD KEY `idx_pon_port` (`pon_port`),
  ADD KEY `idx_last_inform` (`last_inform`),
  ADD KEY `ont_devices_source` (`source`),
  ADD KEY `ont_devices_olt_source_id` (`olt_source_id`),
  ADD KEY `ont_devices_pon_port` (`pon_port`),
  ADD KEY `ont_devices_last_inform` (`last_inform`);

--
-- Indexes for table `packages`
--
ALTER TABLE `packages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recorded_by` (`recorded_by`),
  ADD KEY `payments_invoice_id` (`invoice_id`),
  ADD KEY `payments_payment_date` (`payment_date`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `push_notifications`
--
ALTER TABLE `push_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_push_notif_status` (`status`),
  ADD KEY `idx_push_notif_sched` (`scheduled_at`),
  ADD KEY `idx_push_notif_sched_status` (`status`,`scheduled_at`),
  ADD KEY `push_notifications_status` (`status`),
  ADD KEY `push_notifications_scheduled_at` (`scheduled_at`),
  ADD KEY `push_notifications_status_scheduled_at` (`status`,`scheduled_at`);

--
-- Indexes for table `push_templates`
--
ALTER TABLE `push_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_push_tpl_category` (`category`),
  ADD KEY `push_templates_category` (`category`);

--
-- Indexes for table `queue_history`
--
ALTER TABLE `queue_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `queue_history_queue_id_recorded_at` (`queue_id`,`recorded_at`),
  ADD KEY `queue_history_recorded_at` (`recorded_at`),
  ADD KEY `queue_history_queue_name` (`queue_name`);

--
-- Indexes for table `reminder_settings`
--
ALTER TABLE `reminder_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_permissions_permission_id_role_id_unique` (`role_id`,`permission_id`),
  ADD UNIQUE KEY `role_permissions_role_id_permission_id` (`role_id`,`permission_id`),
  ADD KEY `permission_id` (`permission_id`);

--
-- Indexes for table `technician_locations`
--
ALTER TABLE `technician_locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_technician_id` (`technician_id`),
  ADD KEY `idx_ticket_id` (`ticket_id`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_recorded_at` (`recorded_at`),
  ADD KEY `idx_tech_active` (`technician_id`,`is_active`),
  ADD KEY `idx_ticket_time` (`ticket_id`,`recorded_at`),
  ADD KEY `technician_locations_technician_id` (`technician_id`),
  ADD KEY `technician_locations_ticket_id` (`ticket_id`),
  ADD KEY `technician_locations_is_active` (`is_active`),
  ADD KEY `technician_locations_recorded_at` (`recorded_at`),
  ADD KEY `technician_locations_technician_id_is_active` (`technician_id`,`is_active`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ticket_number` (`ticket_number`),
  ADD KEY `idx_tickets_status` (`status`),
  ADD KEY `idx_tickets_type` (`type`),
  ADD KEY `idx_tickets_customer` (`customer_id`),
  ADD KEY `idx_tickets_assigned` (`assigned_to`),
  ADD KEY `idx_tickets_created` (`created_at`),
  ADD KEY `fk_ticket_infra` (`infra_point_id`),
  ADD KEY `fk_ticket_creator` (`created_by`);

--
-- Indexes for table `ticket_timelines`
--
ALTER TABLE `ticket_timelines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tl_ticket` (`ticket_id`),
  ADD KEY `idx_tl_created` (`created_at`),
  ADD KEY `fk_tl_user` (`user_id`);

--
-- Indexes for table `todos`
--
ALTER TABLE `todos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_assigned_to` (`assigned_to`),
  ADD KEY `idx_due_date` (`due_date`);

--
-- Indexes for table `topology_connections`
--
ALTER TABLE `topology_connections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_source` (`source_id`),
  ADD KEY `idx_target` (`target_id`);

--
-- Indexes for table `topology_devices`
--
ALTER TABLE `topology_devices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_ip` (`ip_address`);

--
-- Indexes for table `tracking_sessions`
--
ALTER TABLE `tracking_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_session_id` (`session_id`),
  ADD UNIQUE KEY `tracking_sessions_session_id` (`session_id`),
  ADD KEY `idx_technician_id` (`technician_id`),
  ADD KEY `idx_ticket_id` (`ticket_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_started_at` (`started_at`),
  ADD KEY `idx_tech_status` (`technician_id`,`status`),
  ADD KEY `tracking_sessions_technician_id` (`technician_id`),
  ADD KEY `tracking_sessions_ticket_id` (`ticket_id`),
  ADD KEY `tracking_sessions_status` (`status`),
  ADD KEY `tracking_sessions_started_at` (`started_at`);

--
-- Indexes for table `traffic_data`
--
ALTER TABLE `traffic_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `traffic_data_device_id_interface_name` (`device_id`,`interface_name`),
  ADD KEY `traffic_data_recorded_at` (`recorded_at`),
  ADD KEY `traffic_data_device_id_recorded_at` (`device_id`,`recorded_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD KEY `role_id` (`role_id`),
  ADD KEY `idx_users_is_demo` (`is_demo`),
  ADD KEY `idx_users_demo_expires_at` (`demo_expires_at`);

--
-- Indexes for table `user_dashboard_layouts`
--
ALTER TABLE `user_dashboard_layouts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user` (`user_id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `wa_auto_replies`
--
ALTER TABLE `wa_auto_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `wa_auto_replies_session_id` (`session_id`),
  ADD KEY `wa_auto_replies_is_active` (`is_active`);

--
-- Indexes for table `wa_broadcast`
--
ALTER TABLE `wa_broadcast`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_scheduled` (`scheduled_at`);

--
-- Indexes for table `wa_incoming`
--
ALTER TABLE `wa_incoming`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `wa_logs`
--
ALTER TABLE `wa_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `wa_messages`
--
ALTER TABLE `wa_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `wa_messages_session_id` (`session_id`),
  ADD KEY `wa_messages_direction` (`direction`),
  ADD KEY `wa_messages_from_number` (`from_number`),
  ADD KEY `wa_messages_status` (`status`),
  ADD KEY `wa_messages_customer_id` (`customer_id`);

--
-- Indexes for table `wa_sessions`
--
ALTER TABLE `wa_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_id` (`session_id`),
  ADD KEY `wa_sessions_session_id` (`session_id`),
  ADD KEY `wa_sessions_status` (`status`);

--
-- Indexes for table `wa_templates`
--
ALTER TABLE `wa_templates`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `work_orders`
--
ALTER TABLE `work_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `wo_number` (`wo_number`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_ticket_id` (`ticket_id`),
  ADD KEY `idx_scheduled` (`scheduled_date`),
  ADD KEY `idx_due_date` (`due_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `app_settings`
--
ALTER TABLE `app_settings`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2076;

--
-- AUTO_INCREMENT for table `assets`
--
ALTER TABLE `assets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `asset_categories`
--
ALTER TABLE `asset_categories`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `asset_history`
--
ALTER TABLE `asset_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=279;

--
-- AUTO_INCREMENT for table `customer_push_subscriptions`
--
ALTER TABLE `customer_push_subscriptions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `device_logs`
--
ALTER TABLE `device_logs`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24524;

--
-- AUTO_INCREMENT for table `financial_reports`
--
ALTER TABLE `financial_reports`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `infrastructure_links`
--
ALTER TABLE `infrastructure_links`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `infrastructure_points`
--
ALTER TABLE `infrastructure_points`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=178;

--
-- AUTO_INCREMENT for table `isolir_bypass_global`
--
ALTER TABLE `isolir_bypass_global`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `isolir_bypass_router`
--
ALTER TABLE `isolir_bypass_router`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `isolir_logs`
--
ALTER TABLE `isolir_logs`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `keuangan`
--
ALTER TABLE `keuangan`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `mikrotik_devices`
--
ALTER TABLE `mikrotik_devices`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `noc_monitor_presets`
--
ALTER TABLE `noc_monitor_presets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ont_devices`
--
ALTER TABLE `ont_devices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `packages`
--
ALTER TABLE `packages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `push_notifications`
--
ALTER TABLE `push_notifications`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `push_templates`
--
ALTER TABLE `push_templates`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `queue_history`
--
ALTER TABLE `queue_history`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reminder_settings`
--
ALTER TABLE `reminder_settings`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `role_permissions`
--
ALTER TABLE `role_permissions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT for table `technician_locations`
--
ALTER TABLE `technician_locations`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `ticket_timelines`
--
ALTER TABLE `ticket_timelines`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=209;

--
-- AUTO_INCREMENT for table `todos`
--
ALTER TABLE `todos`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `topology_connections`
--
ALTER TABLE `topology_connections`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `topology_devices`
--
ALTER TABLE `topology_devices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `tracking_sessions`
--
ALTER TABLE `tracking_sessions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `traffic_data`
--
ALTER TABLE `traffic_data`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `user_dashboard_layouts`
--
ALTER TABLE `user_dashboard_layouts`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_auto_replies`
--
ALTER TABLE `wa_auto_replies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `wa_broadcast`
--
ALTER TABLE `wa_broadcast`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `wa_incoming`
--
ALTER TABLE `wa_incoming`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_logs`
--
ALTER TABLE `wa_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_messages`
--
ALTER TABLE `wa_messages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=582;

--
-- AUTO_INCREMENT for table `wa_sessions`
--
ALTER TABLE `wa_sessions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `wa_templates`
--
ALTER TABLE `wa_templates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `work_orders`
--
ALTER TABLE `work_orders`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `assets`
--
ALTER TABLE `assets`
  ADD CONSTRAINT `fk_asset_assignedby` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_asset_category` FOREIGN KEY (`category_id`) REFERENCES `asset_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_asset_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_asset_infra` FOREIGN KEY (`infrastructure_id`) REFERENCES `infrastructure_points` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `noc_monitor_presets`
--
ALTER TABLE `noc_monitor_presets`
  ADD CONSTRAINT `noc_monitor_presets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `noc_monitor_presets_ibfk_2` FOREIGN KEY (`router_id`) REFERENCES `devices` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
