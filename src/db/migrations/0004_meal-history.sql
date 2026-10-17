CREATE TABLE `cooked_meals` (
	`cooked_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`id` integer PRIMARY KEY NOT NULL,
	`recipe_id` integer NOT NULL,
	`sync_id` text DEFAULT (substr(lower(hex(randomblob(8))), 1, 15)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cooked_meals_sync_id_unique` ON `cooked_meals` (`sync_id`);--> statement-breakpoint
CREATE INDEX `cooked_meals_updated_at_id_idx` ON `cooked_meals` (`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `cooked_meals_recipe_cooked_at_idx` ON `cooked_meals` (`recipe_id`,`cooked_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sync_deletions` (
	`deleted_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`sync_id` text NOT NULL,
	`table_name` text NOT NULL,
	PRIMARY KEY(`table_name`, `sync_id`),
	CONSTRAINT "sync_deletions_table_valid" CHECK("__new_sync_deletions"."table_name" in ('ingredients', 'recipes', 'cooked_meals'))
);
--> statement-breakpoint
INSERT INTO `__new_sync_deletions`("deleted_at", "sync_id", "table_name") SELECT "deleted_at", "sync_id", "table_name" FROM `sync_deletions`;--> statement-breakpoint
DROP TABLE `sync_deletions`;--> statement-breakpoint
ALTER TABLE `__new_sync_deletions` RENAME TO `sync_deletions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;