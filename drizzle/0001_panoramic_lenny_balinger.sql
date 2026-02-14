CREATE TABLE `accCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`projectCode` varchar(64) NOT NULL,
	`projectType` enum('TA_TDD','OE') NOT NULL,
	`phase` varchar(64) NOT NULL DEFAULT 'Initiation',
	`accProjectId` varchar(255),
	`accHubId` varchar(255),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_projectCode_unique` UNIQUE(`projectCode`)
);
