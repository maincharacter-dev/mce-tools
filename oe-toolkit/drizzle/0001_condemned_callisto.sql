CREATE TABLE `knowledgeBaseConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dbName` varchar(255) NOT NULL,
	`dbHost` varchar(255) DEFAULT 'localhost',
	`dbPort` int DEFAULT 3306,
	`dbUser` varchar(255),
	`dbPassword` varchar(255),
	`status` enum('Active','Inactive') DEFAULT 'Active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeBaseConfig_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledgeBaseConfig_dbName_unique` UNIQUE(`dbName`)
);
--> statement-breakpoint
CREATE TABLE `ollamaConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`baseUrl` varchar(255) DEFAULT 'http://localhost:11434',
	`model` varchar(255) DEFAULT 'llama2',
	`temperature` varchar(10) DEFAULT '0.3',
	`topP` varchar(10) DEFAULT '0.9',
	`timeoutSeconds` int DEFAULT 60,
	`enabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ollamaConfig_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`dbName` varchar(255) NOT NULL,
	`dbHost` varchar(255) DEFAULT 'localhost',
	`dbPort` int DEFAULT 3306,
	`dbUser` varchar(255),
	`dbPassword` varchar(255),
	`status` enum('Active','Archived','Deleted') DEFAULT 'Active',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_dbName_unique` UNIQUE(`dbName`)
);
