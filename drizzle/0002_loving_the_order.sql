ALTER TABLE `budgets` MODIFY COLUMN `allocatedAmount` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `budgets` MODIFY COLUMN `spentAmount` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `paidAmount` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `purchase_requisitions` MODIFY COLUMN `totalAmount` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `rating` decimal(3,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `medical_supplies` ADD `supplierId` int;--> statement-breakpoint
ALTER TABLE `medical_supplies` DROP COLUMN `supplier`;