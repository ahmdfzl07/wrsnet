CREATE TABLE live_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(100),
  user_id INT,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE `live_messages` ADD `type` VARCHAR(50) NULL DEFAULT NULL AFTER `user_id`;
ALTER TABLE `live_messages` ADD `name` VARCHAR(50) NULL DEFAULT NULL AFTER `room`;
ALTER TABLE live_messages 
ADD COLUMN is_read TINYINT(1) DEFAULT 0;

CREATE TABLE customer_registration (
  id INT AUTO_INCREMENT PRIMARY KEY,

  nik VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  address TEXT,

  province VARCHAR(100),
  province_id VARCHAR(20),
  kabupaten VARCHAR(100),
  kecamatan VARCHAR(100),
  kelurahan VARCHAR(100),

  rt VARCHAR(10),
  rw VARCHAR(10),

  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150),

  package_id INT,

  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  ont_sn VARCHAR(50),
  ont_mac VARCHAR(20),

  installation_date DATE,
  notes TEXT,

  pppoe_username VARCHAR(100),
  static_ip VARCHAR(20),

  mikrotik_id INT,

  due_date DATE,

  documents JSON,

  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
ALTER TABLE `customers` ADD `nik` INT NULL DEFAULT NULL AFTER `name`;
ALTER TABLE customers MODIFY nik VARCHAR(16);
ALTER TABLE `customer_registration` ADD `coordinates` VARCHAR(100) NULL DEFAULT NULL AFTER `longitude`, ADD `referral` VARCHAR(100) NULL DEFAULT NULL AFTER `coordinates`;
ALTER TABLE `tickets` ADD `is_registration` VARCHAR(10) NULL DEFAULT NULL AFTER `tags`;
ALTER TABLE work_orders 
ADD COLUMN is_registration TINYINT(1) DEFAULT 0 AFTER ticket_id;
ALTER TABLE `packages` CHANGE `category` `category` ENUM('home','business','enterprise','custom','addon') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'home';
ALTER TABLE customers ADD COLUMN addon_id JSON NULL;
ALTER TABLE customer_registration ADD COLUMN addon_id JSON NULL;
ALTER TABLE `customers` ADD `diskon` VARCHAR(50) NULL DEFAULT NULL AFTER `addon_id`, ADD `diskon_type` VARCHAR(50) NULL DEFAULT NULL AFTER `diskon`;
ALTER TABLE `customers` ADD `rt` VARCHAR(50) NULL DEFAULT NULL AFTER `kelurahan`, ADD `rw` VARCHAR(50) NULL DEFAULT NULL AFTER `rt`;
ALTER TABLE `infrastructure_points` ADD `ticket_id` INT NULL DEFAULT NULL AFTER `notes`;
ALTER TABLE `customer_registration` ADD `customer_id` VARCHAR(20) NULL DEFAULT NULL AFTER `id`;
