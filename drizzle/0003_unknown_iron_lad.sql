CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lowStockAlerts` boolean NOT NULL DEFAULT true,
	`expiryWarnings` boolean NOT NULL DEFAULT true,
	`approvalAlerts` boolean NOT NULL DEFAULT true,
	`orderUpdates` boolean NOT NULL DEFAULT true,
	`budgetAlerts` boolean NOT NULL DEFAULT true,
	`emailNotifications` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(6) NOT NULL,
	`purpose` enum('2fa_login','email_verify') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
DROP INDEX `idx_userId` ON `audit_logs`;--> statement-breakpoint
DROP INDEX `idx_entityType` ON `audit_logs`;--> statement-breakpoint
DROP INDEX `idx_supplyId` ON `forecasts`;--> statement-breakpoint
DROP INDEX `idx_supplyId` ON `inventory_transactions`;--> statement-breakpoint
DROP INDEX `idx_userId` ON `inventory_transactions`;--> statement-breakpoint
DROP INDEX `idx_status` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_supplierId` ON `invoices`;--> statement-breakpoint
DROP INDEX `idx_userId` ON `notifications`;--> statement-breakpoint
DROP INDEX `idx_isRead` ON `notifications`;--> statement-breakpoint
DROP INDEX `idx_poNumber` ON `purchase_orders`;--> statement-breakpoint
DROP INDEX `idx_status` ON `purchase_orders`;--> statement-breakpoint
DROP INDEX `idx_supplierId` ON `purchase_orders`;--> statement-breakpoint
DROP INDEX `idx_status` ON `purchase_requisitions`;--> statement-breakpoint
DROP INDEX `idx_createdBy` ON `purchase_requisitions`;--> statement-breakpoint
DROP INDEX `idx_supplierId` ON `quotations`;--> statement-breakpoint
DROP INDEX `idx_email` ON `suppliers`;--> statement-breakpoint
ALTER TABLE `budgets` MODIFY COLUMN `allocatedAmount` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `medical_supplies` MODIFY COLUMN `unitCost` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('low_stock','expiry_warning','approval_pending','order_update','delivery_delay','budget_alert','forecast_alert','payment_due') NOT NULL;--> statement-breakpoint
ALTER TABLE `po_items` MODIFY COLUMN `unitCost` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `requisition_items` MODIFY COLUMN `estimatedUnitCost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `method` varchar(50);--> statement-breakpoint
ALTER TABLE `forecasts` ADD `dataPointsUsed` int;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_otp_userId` ON `otp_codes` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_reset_token` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_audit_userId` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_entityType` ON `audit_logs` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_fc_supplyId` ON `forecasts` (`supplyId`);--> statement-breakpoint
CREATE INDEX `idx_inv_supplyId` ON `inventory_transactions` (`supplyId`);--> statement-breakpoint
CREATE INDEX `idx_inv_userId` ON `inventory_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_inv_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_inv_supplierId` ON `invoices` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_notif_userId` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notif_isRead` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `idx_po_number` ON `purchase_orders` (`poNumber`);--> statement-breakpoint
CREATE INDEX `idx_po_status` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_po_supplierId` ON `purchase_orders` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_req_status` ON `purchase_requisitions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_req_createdBy` ON `purchase_requisitions` (`createdBy`);--> statement-breakpoint
CREATE INDEX `idx_quot_supplierId` ON `quotations` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_sup_email` ON `suppliers` (`email`);