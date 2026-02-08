ALTER TABLE `projects` ADD `status` enum('Active','Archived') DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `archivedAt` timestamp;