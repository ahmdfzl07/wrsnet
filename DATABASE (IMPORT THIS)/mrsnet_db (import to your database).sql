-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: May 14, 2026 at 09:48 PM
-- Server version: 10.11.10-MariaDB-log
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mrsnet_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `module` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `target_id` int(11) DEFAULT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_data`)),
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_data`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text DEFAULT NULL,
  `type` enum('gangguan','maintenance','info','promo') NOT NULL DEFAULT 'info',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `show_from` datetime DEFAULT NULL,
  `show_until` datetime DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `app_settings`
--

CREATE TABLE `app_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `key` varchar(100) NOT NULL,
  `value` mediumtext DEFAULT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'string',
  `description` varchar(255) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `assets`
--

CREATE TABLE `assets` (
  `id` int(11) NOT NULL,
  `asset_code` varchar(50) NOT NULL,
  `name` varchar(200) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(150) DEFAULT NULL,
  `status` enum('active','inactive','damaged','repair','storage','disposed','lost') NOT NULL DEFAULT 'storage',
  `condition` enum('new','good','fair','poor') NOT NULL DEFAULT 'good',
  `purchase_date` date DEFAULT NULL,
  `purchase_price` decimal(15,2) DEFAULT 0.00,
  `purchase_vendor` varchar(150) DEFAULT NULL,
  `warranty_until` date DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `infrastructure_id` int(11) DEFAULT NULL,
  `ont_device_id` int(11) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `specs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`specs`)),
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_categories`
--

CREATE TABLE `asset_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icon` varchar(50) DEFAULT 'device',
  `description` text DEFAULT NULL,
  `color` varchar(20) DEFAULT '#3b82f6',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_history`
--

CREATE TABLE `asset_history` (
  `id` int(11) NOT NULL,
  `asset_id` int(11) NOT NULL,
  `action` enum('created','updated','status_change','assigned','unassigned','moved','repaired','disposed','photo_updated') NOT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `note` text DEFAULT NULL,
  `performed_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `portal_password` varchar(255) DEFAULT NULL,
  `portal_enabled` tinyint(1) DEFAULT 1,
  `last_portal_login` datetime DEFAULT NULL,
  `package_id` int(11) DEFAULT NULL,
  `status` enum('active','inactive','isolated','suspended') DEFAULT 'active',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `ont_sn` varchar(50) DEFAULT NULL,
  `ont_mac` varchar(20) DEFAULT NULL,
  `installation_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `documents` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`documents`)),
  `pppoe_username` varchar(100) DEFAULT NULL,
  `pppoe_profile_original` varchar(100) DEFAULT NULL,
  `static_ip` varchar(20) DEFAULT NULL,
  `mikrotik_id` int(10) UNSIGNED DEFAULT NULL,
  `isolir_status` enum('active','isolated','restoring') NOT NULL DEFAULT 'active',
  `isolir_at` datetime DEFAULT NULL,
  `billing_date` int(11) DEFAULT 1,
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `mikrotik_detected_at` timestamp NULL DEFAULT NULL,
  `mikrotik_detection_method` enum('manual','arp','active_ppp','ppp_secret') DEFAULT 'manual'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_push_subscriptions`
--

CREATE TABLE `customer_push_subscriptions` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(11) NOT NULL,
  `platform` enum('web','fcm') NOT NULL DEFAULT 'web',
  `endpoint` text DEFAULT NULL,
  `p256dh` text DEFAULT NULL,
  `auth` varchar(255) DEFAULT NULL,
  `fcm_token` text DEFAULT NULL,
  `device_name` varchar(100) DEFAULT NULL,
  `last_used` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `type` enum('router','switch','olt','ont','access_point','server','other') DEFAULT 'router',
  `brand` varchar(50) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `monitoring_type` enum('snmp','api','both') DEFAULT 'snmp',
  `snmp_community` varchar(50) DEFAULT 'public',
  `snmp_version` int(11) DEFAULT 2,
  `snmp_port` int(11) DEFAULT 161,
  `api_port` int(11) DEFAULT NULL,
  `api_username` varchar(100) DEFAULT NULL,
  `api_password` varchar(255) DEFAULT NULL,
  `api_protocol` enum('rest-http','rest-https','api-plain','api-ssl') DEFAULT NULL,
  `status` enum('online','offline','warning','maintenance') DEFAULT 'offline',
  `cpu_load` float DEFAULT 0,
  `memory_usage` float DEFAULT 0,
  `uptime` varchar(100) DEFAULT NULL,
  `firmware` varchar(100) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `poll_interval` int(11) DEFAULT 60 COMMENT 'Poll interval in seconds',
  `last_polled` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `notes` text DEFAULT NULL,
  `pop_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `device_logs`
--

CREATE TABLE `device_logs` (
  `id` bigint(20) NOT NULL,
  `device_id` int(11) NOT NULL,
  `cpu_load` float DEFAULT NULL,
  `memory_usage` float DEFAULT NULL,
  `uptime` varchar(100) DEFAULT NULL,
  `status` enum('online','offline','warning') DEFAULT 'offline',
  `interfaces` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`interfaces`)),
  `raw_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_data`)),
  `polled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `financial_reports`
--

CREATE TABLE `financial_reports` (
  `id` int(11) NOT NULL,
  `report_type` enum('monthly','yearly') NOT NULL,
  `period_month` int(11) DEFAULT NULL,
  `period_year` int(11) NOT NULL,
  `total_revenue` decimal(15,2) DEFAULT 0.00,
  `total_invoiced` decimal(15,2) DEFAULT 0.00,
  `total_outstanding` decimal(15,2) DEFAULT 0.00,
  `total_customers` int(11) DEFAULT 0,
  `new_customers` int(11) DEFAULT 0,
  `churned_customers` int(11) DEFAULT 0,
  `report_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`report_data`)),
  `generated_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `infrastructure_links`
--

CREATE TABLE `infrastructure_links` (
  `id` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `from_point_id` int(11) NOT NULL,
  `to_point_id` int(11) NOT NULL,
  `link_type` enum('fiber','copper','wireless','trunk') DEFAULT 'fiber',
  `status` enum('active','inactive','maintenance') DEFAULT 'active',
  `distance_m` int(11) DEFAULT NULL COMMENT 'estimated cable length in meters',
  `waypoints` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Array of [lat,lng] intermediate points' CHECK (json_valid(`waypoints`)),
  `notes` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `infrastructure_points`
--

CREATE TABLE `infrastructure_points` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('odp','odc','ont','customer','pop','tower') NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address` text DEFAULT NULL,
  `status` enum('active','inactive','maintenance') DEFAULT 'active',
  `capacity` int(11) DEFAULT NULL,
  `used_ports` int(11) DEFAULT 0,
  `parent_id` int(11) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `invoice_number` varchar(30) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `tax` decimal(12,2) DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL,
  `status` enum('unpaid','paid','overdue','cancelled') DEFAULT 'unpaid',
  `due_date` date NOT NULL,
  `paid_date` date DEFAULT NULL,
  `period_month` int(11) NOT NULL,
  `period_year` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `pdf_path` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `isolir_bypass_global`
--

CREATE TABLE `isolir_bypass_global` (
  `id` int(10) UNSIGNED NOT NULL,
  `address` varchar(100) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'custom',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `isolir_bypass_router`
--

CREATE TABLE `isolir_bypass_router` (
  `id` int(10) UNSIGNED NOT NULL,
  `device_id` int(10) UNSIGNED NOT NULL,
  `address` varchar(100) NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `isolir_logs`
--

CREATE TABLE `isolir_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(11) NOT NULL,
  `device_id` int(10) UNSIGNED DEFAULT NULL,
  `static_ip` varchar(50) DEFAULT NULL,
  `pppoe_username` varchar(100) DEFAULT NULL,
  `action` enum('isolir','restore','setup_firewall') NOT NULL,
  `isolir_method` enum('static','pppoe') DEFAULT 'static',
  `trigger_by` enum('cron','admin','payment') NOT NULL DEFAULT 'admin',
  `triggered_by_user` int(11) DEFAULT NULL,
  `addrlist_id` varchar(50) DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `error_msg` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `keuangan`
--

CREATE TABLE `keuangan` (
  `id` int(11) NOT NULL,
  `type` enum('pemasukan','pengeluaran','hutang','piutang','modal') NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `party_name` varchar(150) DEFAULT NULL,
  `status` enum('lunas','belum_lunas','cicilan') DEFAULT NULL,
  `source` varchar(150) DEFAULT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `ref_number` varchar(100) DEFAULT NULL,
  `recorded_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mikrotik_devices`
--

CREATE TABLE `mikrotik_devices` (
  `id` int(10) UNSIGNED NOT NULL,
  `status` enum('online','offline','unknown') NOT NULL DEFAULT 'unknown',
  `last_ping` datetime DEFAULT NULL,
  `wan_interface` varchar(50) NOT NULL DEFAULT 'ether1',
  `isolir_page_url` varchar(500) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `device_id` int(11) NOT NULL,
  `binary_port` smallint(5) UNSIGNED DEFAULT 8728
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `severity` enum('info','warning','error','critical') DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ont_devices`
--

CREATE TABLE `ont_devices` (
  `id` int(11) NOT NULL,
  `serial_number` varchar(64) NOT NULL COMMENT 'Serial number ONT (unik)',
  `customer_id` int(11) DEFAULT NULL,
  `device_id` varchar(255) DEFAULT NULL COMMENT 'GenieACS device ID',
  `manufacturer` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `firmware` varchar(100) DEFAULT NULL,
  `status` enum('online','offline','warning','unknown') NOT NULL DEFAULT 'unknown' COMMENT 'online | offline | warning (sinyal lemah) | unknown',
  `signal_strength` float DEFAULT NULL COMMENT 'dBm',
  `uptime` varchar(100) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `mac_address` varchar(20) DEFAULT NULL,
  `last_inform` datetime DEFAULT NULL,
  `tr069_params` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tr069_params`)),
  `last_synced` datetime DEFAULT NULL,
  `source` varchar(50) DEFAULT 'genieacs' COMMENT 'sumber data: genieacs | snmp_hsgq | snmp_zte | manual',
  `olt_source_id` int(11) DEFAULT NULL COMMENT 'ID OLT di olt_config.json',
  `olt_index` varchar(20) DEFAULT NULL COMMENT 'Index ONU di OLT SNMP (contoh: 1.3 = PON 1, ONU 3)',
  `pon_port` tinyint(3) UNSIGNED DEFAULT NULL COMMENT 'PON port di OLT (1-4 untuk E04I)',
  `onu_id` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'ONU ID di PON port',
  `distance_m` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'Jarak ONT ke OLT (meter)',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `packages`
--

CREATE TABLE `packages` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `speed_down` int(11) NOT NULL COMMENT 'Download speed in Mbps',
  `speed_up` int(11) NOT NULL COMMENT 'Upload speed in Mbps',
  `price` decimal(12,2) NOT NULL,
  `description` text DEFAULT NULL,
  `category` enum('home','business','enterprise','custom') NOT NULL DEFAULT 'home',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_method` enum('cash','transfer','dana','ovo','gopay','qris','ewallet','gateway','other') NOT NULL DEFAULT 'cash',
  `payment_date` date NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `recorded_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `wa_sent_status` enum('sent','failed','skipped') DEFAULT NULL,
  `wa_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(150) NOT NULL,
  `module` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `push_notifications`
--

CREATE TABLE `push_notifications` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `icon` varchar(10) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `tag` varchar(60) DEFAULT NULL,
  `filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`filters`)),
  `target_count` int(11) DEFAULT 0,
  `sent_count` int(11) DEFAULT 0,
  `failed_count` int(11) DEFAULT 0,
  `status` enum('scheduled','pending','sent','failed','cancelled') DEFAULT 'pending',
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `template_id` int(10) UNSIGNED DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `push_templates`
--

CREATE TABLE `push_templates` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` enum('promo','info','maintenance','warning','greeting','other') DEFAULT 'info',
  `icon` varchar(10) DEFAULT NULL,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `url` varchar(255) DEFAULT NULL,
  `tag` varchar(60) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `queue_history`
--

CREATE TABLE `queue_history` (
  `id` bigint(20) NOT NULL,
  `queue_id` varchar(50) NOT NULL COMMENT 'MikroTik queue .id',
  `queue_name` varchar(200) NOT NULL,
  `target` varchar(200) DEFAULT NULL,
  `rx_rate` bigint(20) DEFAULT 0 COMMENT 'bits/s download',
  `tx_rate` bigint(20) DEFAULT 0 COMMENT 'bits/s upload',
  `rx_bytes` bigint(20) DEFAULT 0 COMMENT 'cumulative download bytes',
  `tx_bytes` bigint(20) DEFAULT 0 COMMENT 'cumulative upload bytes',
  `recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reminder_settings`
--

CREATE TABLE `reminder_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `type` enum('before','due','overdue') NOT NULL,
  `days_offset` tinyint(4) NOT NULL DEFAULT 0,
  `template_id` int(10) UNSIGNED DEFAULT NULL,
  `send_time` time NOT NULL DEFAULT '08:00:00',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `technician_locations`
--

CREATE TABLE `technician_locations` (
  `id` int(10) UNSIGNED NOT NULL,
  `technician_id` int(11) NOT NULL COMMENT 'FK to users.id',
  `ticket_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'FK to tickets.id',
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `accuracy` float DEFAULT NULL COMMENT 'Meters',
  `speed` float DEFAULT NULL COMMENT 'm/s',
  `heading` float DEFAULT NULL COMMENT 'Degrees 0-360',
  `altitude` float DEFAULT NULL COMMENT 'Meters',
  `is_active` tinyint(1) DEFAULT 1,
  `battery_level` int(11) DEFAULT NULL COMMENT '0-100',
  `device_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`device_info`)),
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GPS location points';

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `id` int(10) UNSIGNED NOT NULL,
  `ticket_number` varchar(20) NOT NULL,
  `type` enum('gangguan','request','installation','maintenance') NOT NULL DEFAULT 'gangguan',
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('open','in_progress','pending','resolved','closed') NOT NULL DEFAULT 'open',
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `infra_point_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location_note` varchar(255) DEFAULT NULL,
  `sla_hours` int(11) DEFAULT 24,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `due_at` datetime DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ticket_timelines`
--

CREATE TABLE `ticket_timelines` (
  `id` int(10) UNSIGNED NOT NULL,
  `ticket_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` enum('comment','status_change','assignment','photo','system') NOT NULL DEFAULT 'comment',
  `content` text DEFAULT NULL,
  `old_value` varchar(100) DEFAULT NULL,
  `new_value` varchar(100) DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `todos`
--

CREATE TABLE `todos` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `due_date` date DEFAULT NULL,
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `color` varchar(20) DEFAULT 'blue',
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topology_connections`
--

CREATE TABLE `topology_connections` (
  `id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  `target_id` int(11) NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `interface_source` varchar(50) DEFAULT NULL,
  `interface_target` varchar(50) DEFAULT NULL,
  `bandwidth` varchar(20) DEFAULT NULL,
  `connection_type` enum('ethernet','fiber','wireless','vpn') DEFAULT 'ethernet',
  `status` enum('active','inactive','down') DEFAULT 'active',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topology_devices`
--

CREATE TABLE `topology_devices` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('router','switch','server','client','gateway','firewall','access_point','ont') NOT NULL DEFAULT 'router',
  `ip_address` varchar(50) DEFAULT NULL,
  `protocol` enum('mikrotik','snmp','manual','api') DEFAULT 'manual',
  `snmp_community` varchar(50) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `position_x` int(11) DEFAULT 0,
  `position_y` int(11) DEFAULT 0,
  `status` enum('online','offline','unknown','active') DEFAULT 'unknown',
  `icon` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `firmware_version` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `icon_data` mediumtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tracking_sessions`
--

CREATE TABLE `tracking_sessions` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` char(36) NOT NULL COMMENT 'UUID session identifier',
  `technician_id` int(11) NOT NULL COMMENT 'FK to users.id',
  `ticket_id` int(10) UNSIGNED NOT NULL COMMENT 'FK to tickets.id',
  `status` enum('active','paused','completed','cancelled') DEFAULT 'active',
  `start_latitude` decimal(10,8) DEFAULT NULL,
  `start_longitude` decimal(11,8) DEFAULT NULL,
  `end_latitude` decimal(10,8) DEFAULT NULL,
  `end_longitude` decimal(11,8) DEFAULT NULL,
  `total_distance` float DEFAULT 0 COMMENT 'Meters',
  `total_duration` int(11) DEFAULT 0 COMMENT 'Seconds',
  `points_count` int(11) DEFAULT 0,
  `started_at` datetime NOT NULL DEFAULT current_timestamp(),
  `ended_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='GPS tracking sessions';

-- --------------------------------------------------------

--
-- Table structure for table `traffic_data`
--

CREATE TABLE `traffic_data` (
  `id` bigint(20) NOT NULL,
  `device_id` int(11) NOT NULL,
  `interface_name` varchar(100) NOT NULL,
  `rx_bytes` bigint(20) DEFAULT 0,
  `tx_bytes` bigint(20) DEFAULT 0,
  `rx_rate` bigint(20) DEFAULT 0 COMMENT 'bits per second',
  `tx_rate` bigint(20) DEFAULT 0 COMMENT 'bits per second',
  `recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_demo` tinyint(1) NOT NULL DEFAULT 0,
  `demo_expires_at` datetime DEFAULT NULL,
  `demo_extended` tinyint(1) NOT NULL DEFAULT 0,
  `last_login` datetime DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_dashboard_layouts`
--

CREATE TABLE `user_dashboard_layouts` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `layout_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`layout_config`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_auto_replies`
--

CREATE TABLE `wa_auto_replies` (
  `id` int(11) NOT NULL,
  `session_id` varchar(50) NOT NULL,
  `keyword` varchar(200) NOT NULL,
  `match_type` enum('exact','contains','startswith') DEFAULT 'contains',
  `reply_message` text NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `hit_count` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_broadcast`
--

CREATE TABLE `wa_broadcast` (
  `id` int(10) UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `template_id` int(10) UNSIGNED DEFAULT NULL,
  `message` text NOT NULL,
  `target_type` enum('all','active','by_package','overdue','custom') NOT NULL DEFAULT 'all',
  `target_filter` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`target_filter`)),
  `status` enum('draft','scheduled','running','completed','cancelled','failed') NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `total_targets` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_sent` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_failed` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `send_interval` smallint(5) UNSIGNED NOT NULL DEFAULT 10 COMMENT 'Delay antar pesan (detik), min 8',
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_incoming`
--

CREATE TABLE `wa_incoming` (
  `id` int(10) UNSIGNED NOT NULL,
  `device_id` int(10) UNSIGNED DEFAULT NULL,
  `from_phone` varchar(20) NOT NULL,
  `from_name` varchar(100) DEFAULT NULL,
  `message` text NOT NULL,
  `message_id` varchar(100) DEFAULT NULL,
  `direction` enum('in','out') DEFAULT 'in',
  `media_type` varchar(30) DEFAULT NULL,
  `media_url` text DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `is_replied` tinyint(1) DEFAULT 0,
  `replied_at` datetime DEFAULT NULL,
  `received_at` datetime NOT NULL,
  `is_auto` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_logs`
--

CREATE TABLE `wa_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue_id` bigint(20) UNSIGNED DEFAULT NULL,
  `device_id` int(10) UNSIGNED DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `message` text NOT NULL,
  `type` enum('reminder','broadcast','manual','otp') DEFAULT 'manual',
  `status` enum('sent','failed') DEFAULT 'sent',
  `api_response` text DEFAULT NULL,
  `api_status` varchar(10) DEFAULT NULL,
  `duration_ms` int(10) UNSIGNED DEFAULT NULL,
  `sent_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_messages`
--

CREATE TABLE `wa_messages` (
  `id` int(11) NOT NULL,
  `session_id` varchar(50) NOT NULL,
  `direction` enum('inbound','outbound') NOT NULL,
  `from_number` varchar(30) NOT NULL,
  `push_name` varchar(100) DEFAULT NULL,
  `to_number` varchar(30) NOT NULL,
  `message` text NOT NULL,
  `message_type` enum('text','image','document','audio','template') DEFAULT 'text',
  `status` enum('pending','sent','delivered','read','failed') DEFAULT 'pending',
  `wa_message_id` varchar(100) DEFAULT NULL,
  `media_url` varchar(500) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `is_auto_reply` tinyint(1) DEFAULT 0,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_sessions`
--

CREATE TABLE `wa_sessions` (
  `id` int(11) NOT NULL,
  `session_id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `status` enum('disconnected','connecting','connected','banned') DEFAULT 'disconnected',
  `qr_code` text DEFAULT NULL,
  `last_seen` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `webhook_url` varchar(255) DEFAULT NULL,
  `auto_reply_enabled` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wa_templates`
--

CREATE TABLE `wa_templates` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` enum('reminder_before','reminder_due','reminder_overdue','broadcast','custom','payment_confirm','isolir','restore','welcome') NOT NULL DEFAULT 'custom',
  `message` text NOT NULL,
  `content` text DEFAULT NULL,
  `variables` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variables`)),
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `usage_count` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `work_orders`
--

CREATE TABLE `work_orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `wo_number` varchar(25) NOT NULL,
  `type` enum('installation','maintenance','dismantle','survey','repair','other') NOT NULL DEFAULT 'installation',
  `status` enum('pending','assigned','in_progress','done','cancelled') NOT NULL DEFAULT 'pending',
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `ticket_id` int(10) UNSIGNED DEFAULT NULL,
  `assigned_user_id` int(10) UNSIGNED DEFAULT NULL,
  `technician_name` varchar(150) DEFAULT NULL,
  `technician_phone` varchar(20) DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `scheduled_time` time DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `location_address` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `completion_notes` text DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos`)),
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
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
  ADD KEY `template_id` (`template_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `push_notifications_status` (`status`),
  ADD KEY `push_notifications_scheduled_at` (`scheduled_at`),
  ADD KEY `push_notifications_status_scheduled_at` (`status`,`scheduled_at`);

--
-- Indexes for table `push_templates`
--
ALTER TABLE `push_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
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
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=211;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `app_settings`
--
ALTER TABLE `app_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1595;

--
-- AUTO_INCREMENT for table `assets`
--
ALTER TABLE `assets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `asset_categories`
--
ALTER TABLE `asset_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `asset_history`
--
ALTER TABLE `asset_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=249;

--
-- AUTO_INCREMENT for table `customer_push_subscriptions`
--
ALTER TABLE `customer_push_subscriptions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `device_logs`
--
ALTER TABLE `device_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24433;

--
-- AUTO_INCREMENT for table `financial_reports`
--
ALTER TABLE `financial_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `infrastructure_links`
--
ALTER TABLE `infrastructure_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `infrastructure_points`
--
ALTER TABLE `infrastructure_points`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=144;

--
-- AUTO_INCREMENT for table `isolir_bypass_global`
--
ALTER TABLE `isolir_bypass_global`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `isolir_bypass_router`
--
ALTER TABLE `isolir_bypass_router`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `isolir_logs`
--
ALTER TABLE `isolir_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `keuangan`
--
ALTER TABLE `keuangan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `mikrotik_devices`
--
ALTER TABLE `mikrotik_devices`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1480;

--
-- AUTO_INCREMENT for table `ont_devices`
--
ALTER TABLE `ont_devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=95;

--
-- AUTO_INCREMENT for table `packages`
--
ALTER TABLE `packages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `push_notifications`
--
ALTER TABLE `push_notifications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `push_templates`
--
ALTER TABLE `push_templates`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `queue_history`
--
ALTER TABLE `queue_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reminder_settings`
--
ALTER TABLE `reminder_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `role_permissions`
--
ALTER TABLE `role_permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT for table `technician_locations`
--
ALTER TABLE `technician_locations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `ticket_timelines`
--
ALTER TABLE `ticket_timelines`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=200;

--
-- AUTO_INCREMENT for table `todos`
--
ALTER TABLE `todos`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `topology_connections`
--
ALTER TABLE `topology_connections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `topology_devices`
--
ALTER TABLE `topology_devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `tracking_sessions`
--
ALTER TABLE `tracking_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `traffic_data`
--
ALTER TABLE `traffic_data`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62667;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `user_dashboard_layouts`
--
ALTER TABLE `user_dashboard_layouts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_auto_replies`
--
ALTER TABLE `wa_auto_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `wa_broadcast`
--
ALTER TABLE `wa_broadcast`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `wa_incoming`
--
ALTER TABLE `wa_incoming`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_logs`
--
ALTER TABLE `wa_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wa_messages`
--
ALTER TABLE `wa_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=575;

--
-- AUTO_INCREMENT for table `wa_sessions`
--
ALTER TABLE `wa_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `wa_templates`
--
ALTER TABLE `wa_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `work_orders`
--
ALTER TABLE `work_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

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
-- Constraints for table `push_notifications`
--
ALTER TABLE `push_notifications`
  ADD CONSTRAINT `push_notifications_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `push_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `push_notifications_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `push_templates`
--
ALTER TABLE `push_templates`
  ADD CONSTRAINT `push_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
