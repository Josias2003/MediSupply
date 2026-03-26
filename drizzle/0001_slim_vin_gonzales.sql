CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(255) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` int,
	`changes` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department` varchar(100) NOT NULL,
	`allocatedAmount` decimal(12,2) NOT NULL,
	`spentAmount` decimal(12,2) DEFAULT 0,
	`fiscalYear` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplyId` int NOT NULL,
	`forecastPeriod` varchar(50) NOT NULL,
	`predictedQuantity` int NOT NULL,
	`confidence` decimal(5,2),
	`actualQuantity` int,
	`accuracy` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forecasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplyId` int NOT NULL,
	`transactionType` enum('purchase','usage','adjustment','expiry_removal') NOT NULL,
	`quantity` int NOT NULL,
	`userId` int NOT NULL,
	`notes` text,
	`referenceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`poId` int NOT NULL,
	`supplierId` int NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`paidAmount` decimal(12,2) DEFAULT 0,
	`status` enum('pending','partial','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`invoiceDate` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `medical_supplies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`unit` varchar(50) NOT NULL,
	`currentStock` int NOT NULL DEFAULT 0,
	`reorderPoint` int NOT NULL,
	`reorderQuantity` int NOT NULL,
	`unitCost` decimal(10,2) NOT NULL,
	`supplier` int,
	`expiryDate` timestamp,
	`batchNumber` varchar(100),
	`storageLocation` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medical_supplies_id` PRIMARY KEY(`id`),
	CONSTRAINT `medical_supplies_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('low_stock','expiry_warning','approval_pending','order_update','delivery_delay','budget_alert','forecast_alert') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`referenceId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`paymentMethod` varchar(50) NOT NULL,
	`transactionReference` varchar(100),
	`paymentDate` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `po_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poId` int NOT NULL,
	`supplyId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitCost` decimal(10,2) NOT NULL,
	`deliveredQuantity` int DEFAULT 0,
	`notes` text,
	CONSTRAINT `po_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poNumber` varchar(50) NOT NULL,
	`requisitionId` int,
	`supplierId` int NOT NULL,
	`createdBy` int NOT NULL,
	`status` enum('draft','sent','acknowledged','partial_delivery','delivered','cancelled') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(12,2) NOT NULL,
	`deliveryDate` timestamp,
	`expectedDeliveryDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_poNumber_unique` UNIQUE(`poNumber`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisitionNumber` varchar(50) NOT NULL,
	`createdBy` int NOT NULL,
	`status` enum('draft','submitted','approved','rejected','converted_to_po') NOT NULL DEFAULT 'draft',
	`totalAmount` decimal(12,2) DEFAULT 0,
	`approvedBy` int,
	`approvalDate` timestamp,
	`rejectionReason` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_requisitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_requisitions_requisitionNumber_unique` UNIQUE(`requisitionNumber`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationNumber` varchar(50) NOT NULL,
	`requisitionId` int NOT NULL,
	`supplierId` int NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`validUntil` timestamp,
	`status` enum('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotations_quotationNumber_unique` UNIQUE(`quotationNumber`)
);
--> statement-breakpoint
CREATE TABLE `requisition_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisitionId` int NOT NULL,
	`supplyId` int NOT NULL,
	`quantity` int NOT NULL,
	`estimatedUnitCost` decimal(10,2),
	`notes` text,
	CONSTRAINT `requisition_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactPerson` varchar(255),
	`email` varchar(255) NOT NULL,
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`country` varchar(100),
	`registrationNumber` varchar(100),
	`paymentTerms` varchar(100),
	`averageDeliveryDays` int,
	`rating` decimal(3,2) DEFAULT 0,
	`totalOrders` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','pharmacist','procurement_officer','supplier','accountant') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `supplierId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLogin` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_entityType` ON `audit_logs` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_supplyId` ON `forecasts` (`supplyId`);--> statement-breakpoint
CREATE INDEX `idx_supplyId` ON `inventory_transactions` (`supplyId`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `inventory_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_supplierId` ON `invoices` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_code` ON `medical_supplies` (`code`);--> statement-breakpoint
CREATE INDEX `idx_category` ON `medical_supplies` (`category`);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_isRead` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `idx_poNumber` ON `purchase_orders` (`poNumber`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_supplierId` ON `purchase_orders` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `purchase_requisitions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_createdBy` ON `purchase_requisitions` (`createdBy`);--> statement-breakpoint
CREATE INDEX `idx_supplierId` ON `quotations` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_email` ON `suppliers` (`email`);--> statement-breakpoint
CREATE INDEX `idx_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_role` ON `users` (`role`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;