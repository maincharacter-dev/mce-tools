ALTER TABLE `accCredentials` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `accCredentials` ADD CONSTRAINT `accCredentials_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `accCredentials` DROP COLUMN `projectId`;