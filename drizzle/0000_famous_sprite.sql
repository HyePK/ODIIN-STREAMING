CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`category` text DEFAULT 'Live Event' NOT NULL,
	`stream_url` text DEFAULT '' NOT NULL,
	`provider_broadcast_id` text DEFAULT '' NOT NULL,
	`poster_url` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
