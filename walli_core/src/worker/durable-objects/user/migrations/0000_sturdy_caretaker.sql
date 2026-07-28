CREATE TABLE `memory` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`start_message_id` text NOT NULL,
	`end_message_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "memory_type_check" CHECK("memory"."type" in ('user', 'memory'))
);
--> statement-breakpoint
CREATE INDEX `idx_memory_type_created_at` ON `memory` (`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`session_id` text NOT NULL,
	`content` text NOT NULL,
	`input_token` integer NOT NULL,
	`output_token` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_messages_id_unique` ON `messages` (`id`);--> statement-breakpoint
CREATE INDEX `idx_messages_session_created_at` ON `messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_session_seq` ON `messages` (`session_id`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_messages_token_usage` ON `messages` (`created_at`,`input_token`,`output_token`);--> statement-breakpoint
CREATE VIRTUAL TABLE `messages_fts` USING fts5(
	`message_id` UNINDEXED,
	`session_id` UNINDEXED,
	`role` UNINDEXED,
	`content`,
	tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`session_id` text,
	`payload` text NOT NULL,
	`system_created` integer DEFAULT 0 NOT NULL,
	`scheduled_at` integer NOT NULL,
	`cron` text,
	`time_zone` text,
	`recurrence_end_at` integer,
	`max_runs` integer,
	`run_number` integer NOT NULL,
	`max_retry` integer NOT NULL,
	`retry_count` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`executed_at` integer,
	`canceled_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_scheduled_tasks_due` ON `scheduled_tasks` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_created_at` ON `sessions` (`created_at`);
