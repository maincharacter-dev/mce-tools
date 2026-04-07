CREATE TABLE IF NOT EXISTS `consolidation_jobs` (
	`id` varchar(100) NOT NULL,
	`project_id` int NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`current_step` varchar(100) DEFAULT 'init',
	`progress` int DEFAULT 0,
	`step_data` json,
	`error_message` text,
	`started_at` timestamp NULL,
	`completed_at` timestamp NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consolidation_jobs_id` PRIMARY KEY(`id`),
	INDEX `idx_project` (`project_id`),
	INDEX `idx_status` (`status`)
);
