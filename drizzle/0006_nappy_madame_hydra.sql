CREATE TABLE `section_narratives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_db_name` varchar(255) NOT NULL,
	`section_name` varchar(255) NOT NULL,
	`narrative_text` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `section_narratives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `weather_files` ADD `monthly_irradiance` json;--> statement-breakpoint
ALTER TABLE `weather_files` ADD `annual_summary` json;--> statement-breakpoint
ALTER TABLE `weather_files` ADD `parsed_location` json;