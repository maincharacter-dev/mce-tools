CREATE TABLE `documents` (
	`id` varchar(36) NOT NULL,
	`project_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_path` varchar(500) NOT NULL,
	`file_size_bytes` int NOT NULL,
	`file_hash` varchar(64),
	`document_type` varchar(50),
	`upload_date` timestamp NOT NULL,
	`status` varchar(20) DEFAULT 'uploaded',
	`extracted_text` text,
	`page_count` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extracted_facts` (
	`id` varchar(36) NOT NULL,
	`project_id` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`data_type` varchar(50),
	`confidence` varchar(10),
	`source_document_id` varchar(36),
	`source_location` text,
	`extraction_method` varchar(50),
	`extraction_model` varchar(100),
	`verified` int DEFAULT 0,
	`verification_status` varchar(20) DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `extracted_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` varchar(36) NOT NULL,
	`project_id` int NOT NULL,
	`document_id` varchar(36),
	`job_type` varchar(50),
	`status` varchar(20),
	`progress` int DEFAULT 0,
	`started_at` timestamp,
	`completed_at` timestamp,
	`error_message` text,
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `red_flags` (
	`id` varchar(36) NOT NULL,
	`project_id` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`severity` varchar(20),
	`trigger_fact_id` varchar(36),
	`downstream_consequences` text,
	`mitigated` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `red_flags_id` PRIMARY KEY(`id`)
);
