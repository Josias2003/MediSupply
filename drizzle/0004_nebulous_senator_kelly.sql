ALTER TABLE `suppliers` ADD `userId` int;--> statement-breakpoint
CREATE INDEX `idx_sup_userId` ON `suppliers` (`userId`);