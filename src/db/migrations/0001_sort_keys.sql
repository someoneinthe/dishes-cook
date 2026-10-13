ALTER TABLE `ingredients` ADD `sort_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `ingredients_sort_key_id_idx` ON `ingredients` (`sort_key`,`id`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `sort_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `recipes_sort_key_id_idx` ON `recipes` (`sort_key`,`id`);