CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('requisition','purchase_order') NOT NULL,
	`entityId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poId` int NOT NULL,
	`confirmedBy` int NOT NULL,
	`status` enum('pending','confirmed','disputed') NOT NULL DEFAULT 'pending',
	`notes` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`supplyId` int NOT NULL,
	`orderedQuantity` int NOT NULL,
	`receivedQuantity` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_chat_entity` ON `chat_messages` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `idx_chat_userId` ON `chat_messages` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_receipt_poId` ON `delivery_receipts` (`poId`);--> statement-breakpoint
CREATE INDEX `idx_receipt_status` ON `delivery_receipts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_receipt_item_receiptId` ON `receipt_items` (`receiptId`);--> statement-breakpoint
CREATE INDEX `idx_receipt_item_supplyId` ON `receipt_items` (`supplyId`);