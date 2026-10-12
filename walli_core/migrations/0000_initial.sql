CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `client` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`platform` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_slug_unique` ON `client` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`impersonatedBy` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `telegram_whitelist_user` (
	`type` text NOT NULL,
	`id` text NOT NULL,
	`remark` text,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`type`, `id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT false,
	`banReason` text,
	`banExpires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);

--> statement-breakpoint
CREATE TABLE `client_skill` (
  `enabled` integer DEFAULT true NOT NULL,
  `built_in_key` text,
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_skill_client_id_idx` ON `client_skill` (`client_id`);

--> statement-breakpoint
CREATE UNIQUE INDEX `client_skill_builtin_idx` ON `client_skill` (`client_id`, `built_in_key`);

--> statement-breakpoint
CREATE TABLE `dataset` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `instance_name` text NOT NULL,
  `created_at` integer NOT NULL,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dataset_instance_unique` ON `dataset` (`instance_name`);
--> statement-breakpoint
CREATE TABLE `client_dataset` (
  `client_id` text NOT NULL REFERENCES `client`(`id`) ON DELETE CASCADE,
  `dataset_id` text NOT NULL REFERENCES `dataset`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`client_id`, `dataset_id`)
);
--> statement-breakpoint
CREATE INDEX `client_dataset_dataset_idx` ON `client_dataset` (`dataset_id`);
--> statement-breakpoint
CREATE TABLE `dataset_category` (
  `id` text PRIMARY KEY NOT NULL,
  `dataset_id` text NOT NULL REFERENCES `dataset`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `version` integer NOT NULL,
  `archived_at` integer
);
--> statement-breakpoint
CREATE INDEX `dataset_category_dataset_idx` ON `dataset_category` (`dataset_id`);
--> statement-breakpoint
CREATE TABLE `dataset_schema` (
  `id` text PRIMARY KEY NOT NULL,
  `category_id` text NOT NULL REFERENCES `dataset_category`(`id`) ON DELETE CASCADE,
  `version` integer NOT NULL,
  `schema_json` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dataset_schema_version_unique` ON `dataset_schema` (`category_id`, `version`);
--> statement-breakpoint
CREATE TABLE `dataset_record` (
  `enabled` integer DEFAULT true NOT NULL,
  `id` text PRIMARY KEY NOT NULL,
  `dataset_id` text NOT NULL REFERENCES `dataset`(`id`) ON DELETE CASCADE,
  `category_id` text NOT NULL REFERENCES `dataset_category`(`id`) ON DELETE CASCADE,
  `schema_id` text NOT NULL REFERENCES `dataset_schema`(`id`) ON DELETE CASCADE,
  `schema_version` integer NOT NULL,
  `title` text NOT NULL,
  `data_json` text NOT NULL,
  `revision` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `dataset_record_page_idx` ON `dataset_record` (`dataset_id`, `deleted_at`, `updated_at`, `id`);
--> statement-breakpoint
CREATE TABLE `dataset_search_job` (
  `id` text PRIMARY KEY NOT NULL,
  `dataset_id` text NOT NULL REFERENCES `dataset`(`id`) ON DELETE CASCADE,
  `record_id` text NOT NULL REFERENCES `dataset_record`(`id`) ON DELETE CASCADE,
  `revision` integer NOT NULL,
  `item_key` text NOT NULL,
  `item_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `attempts` integer NOT NULL DEFAULT 0,
  `next_attempt_at` integer NOT NULL DEFAULT 0,
  `lease_token` text,
  `lease_until` integer NOT NULL DEFAULT 0,
  `error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dataset_search_job_key_unique` ON `dataset_search_job` (`dataset_id`, `item_key`);
--> statement-breakpoint
CREATE INDEX `dataset_search_job_due_idx` ON `dataset_search_job` (`status`, `next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `dataset_search_job_record_idx` ON `dataset_search_job` (`record_id`);
