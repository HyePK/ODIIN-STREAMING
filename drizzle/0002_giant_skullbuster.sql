CREATE TABLE `accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_email` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_videos_account_event` ON `saved_videos` (`account_email`,`event_id`);