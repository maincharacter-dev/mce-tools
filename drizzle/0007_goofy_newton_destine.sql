CREATE TABLE `acc_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acc_oauth_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `acc_project_id` varchar(100);--> statement-breakpoint
ALTER TABLE `documents` ADD `acc_folder_id` varchar(100);--> statement-breakpoint
ALTER TABLE `documents` ADD `acc_file_urn` varchar(500);--> statement-breakpoint
ALTER TABLE `documents` ADD `acc_version_urn` varchar(500);--> statement-breakpoint
ALTER TABLE `documents` ADD `last_synced_at` timestamp;