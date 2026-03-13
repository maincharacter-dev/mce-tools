CREATE TABLE `agentActions` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36),
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`actionType` varchar(50) NOT NULL,
	`actionName` varchar(100) NOT NULL,
	`input` json,
	`output` json,
	`success` tinyint NOT NULL,
	`errorMessage` text,
	`executionTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentConversations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255),
	`context` json,
	`status` varchar(20) DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentGeneratedContent` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`conversationId` varchar(36),
	`contentType` varchar(50) NOT NULL,
	`content` text NOT NULL,
	`prompt` text,
	`modelVersion` varchar(50),
	`userEdited` tinyint DEFAULT 0,
	`finalVersion` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentGeneratedContent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentKnowledgeBase` (
	`id` varchar(36) NOT NULL,
	`category` varchar(100) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`confidence` varchar(20) DEFAULT 'medium',
	`sourceCount` int DEFAULT 1,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentKnowledgeBase_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentLearningSamples` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`contentType` varchar(50) NOT NULL,
	`draftContent` text NOT NULL,
	`finalContent` text NOT NULL,
	`extractedPatterns` json,
	`editDistance` int,
	`applied` tinyint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentLearningSamples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentMessages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`role` varchar(20) NOT NULL,
	`content` text,
	`toolCalls` json,
	`toolCallId` varchar(255),
	`metadata` json,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `agentMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentStyleModels` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`patterns` json,
	`statistics` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentStyleModels_id` PRIMARY KEY(`id`)
);
