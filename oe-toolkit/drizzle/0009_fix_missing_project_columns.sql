-- Migration 0009: Fix missing columns in projects table
--
-- This migration is a safe fixup for databases where migration 0008 partially failed.
-- On a fresh install (migrations run in order), this migration is a no-op because
-- 0004 already added status/archivedAt and 0008 already added projectDbName.
--
-- On the live database where 0008 partially failed, this adds the missing columns:
--   - projectDbName (missing because 0008 Step 1 failed after status conflict)
--   - status (missing because old status was dropped in 0008 Step 4 but new one was never added)
--   - archivedAt (missing because it depends on status)
--
-- We use stored procedures to conditionally add columns only if they don't exist.

-- Add projectDbName if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'projects';
SET @columnname = 'projectDbName';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `projects` ADD COLUMN `projectDbName` varchar(255) NULL AFTER `phase`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
--> statement-breakpoint

-- Add status if it doesn't exist
SET @columnname = 'status';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `projects` ADD COLUMN `status` enum(''Active'',''Archived'') NOT NULL DEFAULT ''Active'' AFTER `accHubId`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
--> statement-breakpoint

-- Add archivedAt if it doesn't exist
SET @columnname = 'archivedAt';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `projects` ADD COLUMN `archivedAt` timestamp NULL AFTER `status`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
