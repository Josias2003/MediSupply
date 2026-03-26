ALTER TABLE `chat_messages`
ADD `replyToMessageId` int,
ADD `editedAt` timestamp NULL,
ADD `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
CREATE INDEX `idx_chat_replyToMessageId` ON `chat_messages` (`replyToMessageId`);
