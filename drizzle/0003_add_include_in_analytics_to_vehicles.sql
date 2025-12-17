CREATE TABLE `bulletinMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`expireDays` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bulletinMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveryScheduleChatReads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveryScheduleChatReads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveryScheduleChats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliveryScheduleId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`parentId` int,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveryScheduleChats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliverySchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleName` varchar(255) NOT NULL,
	`vehicleType` varchar(255),
	`customerName` varchar(255),
	`optionName` varchar(255),
	`optionCategory` varchar(255),
	`prefecture` varchar(100),
	`baseCarReady` enum('yes','no'),
	`furnitureReady` enum('yes','no'),
	`inCharge` varchar(100),
	`productionMonth` varchar(100),
	`dueDate` date,
	`desiredIncomingPlannedDate` date,
	`incomingPlannedDate` date,
	`shippingPlannedDate` date,
	`deliveryPlannedDate` date,
	`comment` text,
	`claimComment` text,
	`photosJson` text,
	`oemComment` text,
	`status` enum('katomo_stock','wg_storage','wg_production','wg_wait_pickup','katomo_picked_up','katomo_checked','completed') DEFAULT 'katomo_stock',
	`completionStatus` enum('ok','checked','revision_requested'),
	`pickupConfirmed` enum('true','false') DEFAULT 'false',
	`incomingPlannedDateConfirmed` enum('true','false') DEFAULT 'false',
	`specSheetUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deliverySchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffScheduleDisplayOrder` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayOrder` int NOT NULL,
	`displayName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffScheduleDisplayOrder_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffScheduleDisplayOrder_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `staffScheduleEditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`editorId` int NOT NULL,
	`fieldName` varchar(50) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffScheduleEditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffScheduleEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduleDate` date NOT NULL,
	`status` enum('work','rest','request','exhibition','other','morning','afternoon') NOT NULL DEFAULT 'work',
	`comment` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffScheduleEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffSchedulePublished` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` date NOT NULL,
	`periodEnd` date NOT NULL,
	`isPublished` enum('true','false') NOT NULL DEFAULT 'false',
	`publishedAt` timestamp,
	`publishedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffSchedulePublished_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicleOutsourcing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`destination` varchar(255) NOT NULL,
	`startDate` date,
	`endDate` date,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicleOutsourcing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `attendanceRecords` MODIFY COLUMN `clockIn` timestamp;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('field_worker','sales_office','sub_admin','admin','external') NOT NULL DEFAULT 'field_worker';--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD `workDate` date;--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD `clockInTime` varchar(5);--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD `clockOutTime` varchar(5);--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD `workMinutes` int;--> statement-breakpoint
ALTER TABLE `users` ADD `category` enum('elephant','squirrel');--> statement-breakpoint
ALTER TABLE `vehicles` ADD `includeInAnalytics` enum('true','false') DEFAULT 'true' NOT NULL;