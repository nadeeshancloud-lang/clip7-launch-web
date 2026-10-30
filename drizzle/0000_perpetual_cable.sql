CREATE TABLE `download_records` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`generation` integer NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`format_id` text NOT NULL,
	`format_label` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `download_request_identity` ON `download_records` (`uid`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `download_user_generation` ON `download_records` (`uid`,`generation`,`status`);--> statement-breakpoint
CREATE INDEX `download_history` ON `download_records` (`uid`,`created_at`);--> statement-breakpoint
CREATE TABLE `quota_windows` (
	`uid` text PRIMARY KEY NOT NULL,
	`device` text NOT NULL,
	`allowance` integer NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`started_at` integer,
	`used` integer DEFAULT 0 NOT NULL
);
