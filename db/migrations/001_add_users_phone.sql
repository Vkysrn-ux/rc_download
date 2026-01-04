-- Migration: add phone column to users table
-- Run this on existing databases created before the phone field was added.

ALTER TABLE users
  ADD COLUMN phone VARCHAR(32) NULL AFTER email,
  ADD UNIQUE KEY uniq_users_phone (phone);

