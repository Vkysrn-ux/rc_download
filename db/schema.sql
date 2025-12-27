-- MySQL schema for rc-download-app
-- Create a database and run this file, e.g.:
--   CREATE DATABASE rc_download_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE rc_download_app;
--   SOURCE db/schema.sql;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  email_verified_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_evt_token_hash (token_hash),
  KEY idx_evt_user_id (user_id),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verification_otps (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_evo_user_id (user_id),
  KEY idx_evo_expires_at (expires_at),
  CONSTRAINT fk_evo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otp_codes (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_user_id (user_id),
  KEY idx_otp_expires_at (expires_at),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  type ENUM('recharge','download') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  payment_method ENUM('wallet','upi','razorpay') NULL,
  description VARCHAR(255) NOT NULL,
  registration_number VARCHAR(32) NULL,
  gateway VARCHAR(32) NULL,
  gateway_order_id VARCHAR(64) NULL,
  gateway_payment_id VARCHAR(64) NULL,
  gateway_signature VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tx_user_created (user_id, created_at),
  KEY idx_tx_status (status),
  KEY idx_tx_gateway_order (gateway_order_id),
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rc_documents (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  registration_number VARCHAR(32) NOT NULL,
  rc_json JSON NOT NULL,
  provider VARCHAR(64) NOT NULL,
  provider_ref VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rc_reg_created (registration_number, created_at),
  KEY idx_rc_user_created (user_id, created_at),
  CONSTRAINT fk_rc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
