DROP INDEX `recipes_sort_key_id_idx`;--> statement-breakpoint
ALTER TABLE `recipes` ADD `kind` text DEFAULT 'dish' NOT NULL;--> statement-breakpoint
CREATE INDEX `recipes_kind_sort_key_id_idx` ON `recipes` (`kind`,`sort_key`,`id`);