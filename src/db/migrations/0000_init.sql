CREATE TABLE `ingredients` (
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`sort_key` text NOT NULL,
	`sync_id` text DEFAULT (substr(lower(hex(randomblob(8))), 1, 15)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "ingredients_name_not_blank" CHECK(length(trim("ingredients"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_sync_id_unique` ON `ingredients` (`sync_id`);--> statement-breakpoint
CREATE INDEX `ingredients_updated_at_id_idx` ON `ingredients` (`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_key_unique` ON `ingredients` (`name_key`);--> statement-breakpoint
CREATE INDEX `ingredients_sort_key_id_idx` ON `ingredients` (`sort_key`,`id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`ingredient_id` integer NOT NULL,
	`recipe_id` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `ingredient_id`),
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_ingredient_recipe_idx` ON `recipe_ingredients` (`ingredient_id`,`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`course` text DEFAULT 'main' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`id` integer PRIMARY KEY NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`season` text DEFAULT 'both' NOT NULL,
	`sort_key` text NOT NULL,
	`sync_id` text DEFAULT (substr(lower(hex(randomblob(8))), 1, 15)) NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "recipes_title_not_blank" CHECK(length(trim("recipes"."title")) > 0),
	CONSTRAINT "recipes_season_valid" CHECK("recipes"."season" in ('winter', 'summer', 'both')),
	CONSTRAINT "recipes_course_valid" CHECK("recipes"."course" in ('starter', 'main', 'dessert'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_sync_id_unique` ON `recipes` (`sync_id`);--> statement-breakpoint
CREATE INDEX `recipes_updated_at_id_idx` ON `recipes` (`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `recipes_sort_key_id_idx` ON `recipes` (`sort_key`,`id`);--> statement-breakpoint
CREATE TABLE `sync_deletions` (
	`deleted_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`sync_id` text NOT NULL,
	`table_name` text NOT NULL,
	PRIMARY KEY(`table_name`, `sync_id`),
	CONSTRAINT "sync_deletions_table_valid" CHECK("sync_deletions"."table_name" in ('ingredients', 'recipes'))
);
