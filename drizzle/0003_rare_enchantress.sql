ALTER TABLE `accounts` ADD `subscription_status` text DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `subscription_plan` text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `creator_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `whip_endpoint` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `whip_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `playback_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `channel_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `channel_slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `channel_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `channel_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `creator_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_events_creator_email` ON `events` (`creator_email`);