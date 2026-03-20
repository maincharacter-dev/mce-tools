-- Migration: Refactor projects table to OE Toolkit registry schema
--
-- The projects table previously held mce-ingestion style columns (name, dbName, dbHost etc).
-- This migration replaces it with the proper OE Toolkit project registry schema:
--   - projectName, projectCode, projectType, phase
--   - projectDbName (the proj_{id} database provisioned for this project)
--   - accProjectId, accHubId (ACC integration)
--   - status, archivedAt (lifecycle)
--
-- The old columns (name, description, dbName, dbHost, dbPort, dbUser, dbPassword)
-- are dropped as they are no longer used by oe-toolkit.
-- Users and auth are the single source of truth in oe_toolkit.users.
-- All project operational data lives in per-project proj_{id} databases.

-- Step 1: Add new columns
ALTER TABLE `projects`
  ADD COLUMN `projectName` varchar(255) NOT NULL DEFAULT '' AFTER `id`,
  ADD COLUMN `projectCode` varchar(64) NOT NULL DEFAULT '' AFTER `projectName`,
  ADD COLUMN `projectType` enum('TA_TDD','OE') NOT NULL DEFAULT 'TA_TDD' AFTER `projectCode`,
  ADD COLUMN `phase` varchar(64) NOT NULL DEFAULT 'Initiation' AFTER `projectType`,
  ADD COLUMN `projectDbName` varchar(255) NULL AFTER `phase`,
  ADD COLUMN `accProjectId` varchar(255) NULL AFTER `projectDbName`,
  ADD COLUMN `accHubId` varchar(255) NULL AFTER `accProjectId`,
  ADD COLUMN `archivedAt` timestamp NULL AFTER `status`;
--> statement-breakpoint

-- Step 2: Migrate existing data — copy name into projectName, set projectCode from dbName
UPDATE `projects` SET
  `projectName` = COALESCE(`name`, ''),
  `projectCode` = COALESCE(SUBSTRING(`dbName`, 1, 64), ''),
  `projectDbName` = `dbName`;
--> statement-breakpoint

-- Step 3: Add unique constraint on projectCode
ALTER TABLE `projects` ADD UNIQUE (`projectCode`);
--> statement-breakpoint

-- Step 4: Drop old columns
ALTER TABLE `projects`
  DROP COLUMN `name`,
  DROP COLUMN `description`,
  DROP COLUMN `dbName`,
  DROP COLUMN `dbHost`,
  DROP COLUMN `dbPort`,
  DROP COLUMN `dbUser`,
  DROP COLUMN `dbPassword`;
--> statement-breakpoint

-- Step 5: Update status enum (old had 'Deleted', new only has 'Active'/'Archived')
-- Set any 'Deleted' rows to 'Archived' first
UPDATE `projects` SET `status` = 'Archived' WHERE `status` = 'Deleted';
--> statement-breakpoint

-- Step 6: Change status column to new enum
ALTER TABLE `projects` MODIFY `status` enum('Active','Archived') NOT NULL DEFAULT 'Active';
