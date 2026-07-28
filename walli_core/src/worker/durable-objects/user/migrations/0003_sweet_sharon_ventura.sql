CREATE TABLE `memory` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT "memory_type_check" CHECK("memory"."type" in ('user', 'memory'))
);
