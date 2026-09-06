CREATE TABLE `langgraph_checkpoints` (
	`thread_id` text NOT NULL,
	`checkpoint_ns` text NOT NULL,
	`checkpoint_id` text NOT NULL,
	`parent_checkpoint_id` text,
	`checkpoint` blob NOT NULL,
	`metadata` blob NOT NULL,
	PRIMARY KEY(`thread_id`, `checkpoint_ns`, `checkpoint_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_langgraph_checkpoints_latest` ON `langgraph_checkpoints` (`thread_id`,`checkpoint_ns`,`checkpoint_id`);--> statement-breakpoint
CREATE TABLE `langgraph_retries` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer NOT NULL,
	`max_attempts` integer NOT NULL,
	`initial_interval` integer NOT NULL,
	`backoff_factor` real NOT NULL,
	`max_interval` integer NOT NULL,
	`jitter` integer NOT NULL,
	`next_attempt_at` integer,
	`last_error` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_langgraph_retries_due` ON `langgraph_retries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `langgraph_retry_configs` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`max_attempts` integer NOT NULL,
	`initial_interval` integer NOT NULL,
	`backoff_factor` real NOT NULL,
	`max_interval` integer NOT NULL,
	`jitter` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `langgraph_checkpoint_writes` (
	`thread_id` text NOT NULL,
	`checkpoint_ns` text NOT NULL,
	`checkpoint_id` text NOT NULL,
	`task_id` text NOT NULL,
	`write_index` integer NOT NULL,
	`channel` text NOT NULL,
	`value` blob NOT NULL,
	PRIMARY KEY(`thread_id`, `checkpoint_ns`, `checkpoint_id`, `task_id`, `write_index`)
);
