-- status column already exists from migration 0001 with enum('Active','Archived','Deleted')
-- MODIFY to update the enum (remove 'Deleted') and ensure NOT NULL default
ALTER TABLE `projects` MODIFY `status` enum('Active','Archived') NOT NULL DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE `projects` ADD `archivedAt` timestamp;