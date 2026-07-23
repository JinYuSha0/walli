CREATE TABLE `telegram_whitelist_user` (
	`type` text NOT NULL,
	`id` text NOT NULL,
	`remark` text,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`type`, `id`)
);
