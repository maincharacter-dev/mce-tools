CREATE TABLE `acc_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` varchar(36) NOT NULL,
	`acc_item_id` varchar(500),
	`acc_folder_path` varchar(500),
	`acc_file_name` varchar(255),
	`acc_web_view_url` text,
	`upload_status` varchar(20) NOT NULL,
	`error_message` text,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acc_uploads_id` PRIMARY KEY(`id`)
);
