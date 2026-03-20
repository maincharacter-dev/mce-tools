-- Migration: Refactor projects table to OE Toolkit registry schema
--
-- The projects table at this point has:
--   id, name, description, dbName, dbHost, dbPort, dbUser, dbPassword,
--   status (enum Active/Archived from 0004), archivedAt (from 0004),
--   createdByUserId, createdAt, updatedAt,
--   taTddProjectId, taTddDbName (from 0003)
--
-- This migration adds the new OE Toolkit registry columns and drops the old ones.
-- NOTE: status and archivedAt already exist (added by migration 0004), so we do NOT add them here.

-- Step 1: Add new columns (status and archivedAt already exist from migration 0004)
ALTER TABLE `projects`
  ADD COLUMN `projectName` varchar(255) NOT NULL DEFAULT '' AFTER `id`,
  ADD COLUMN `projectCode` varchar(64) NOT NULL DEFAULT '' AFTER `projectName`,
  ADD COLUMN `projectType` enum('TA_TDD','OE') NOT NULL DEFAULT 'TA_TDD' AFTER `projectCode`,
  ADD COLUMN `phase` varchar(64) NOT NULL DEFAULT 'Initiation' AFTER `projectType`,
  ADD COLUMN `projectDbName` varchar(255) NULL AFTER `phase`,
  ADD COLUMN `accProjectId` varchar(255) NULL AFTER `projectDbName`,
  ADD COLUMN `accHubId` varchar(255) NULL AFTER `accProjectId`;
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

-- Step 4: Drop old columns (including taTddProjectId and taTddDbName from migration 0003)
ALTER TABLE `projects`
  DROP COLUMN `name`,
  DROP COLUMN `description`,
  DROP COLUMN `dbName`,
  DROP COLUMN `dbHost`,
  DROP COLUMN `dbPort`,
  DROP COLUMN `dbUser`,
  DROP COLUMN `dbPassword`,
  DROP COLUMN `taTddProjectId`,
  DROP COLUMN `taTddDbName`;
