CREATE TABLE `viewer_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_viewer_access_event_email` ON `viewer_access` (`event_id`,`email`);--> statement-breakpoint
ALTER TABLE `events` ADD `gate_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `gate_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `gate_message` text DEFAULT 'This broadcast is reserved for registered viewers.' NOT NULL;