-- Recipes sharing a title (same sort key: ignoring case and accents) before titles were unique: all
-- but the one with the smallest sync id are numbered, "crêpes (2)", "crêpes (3)"… Ordered by sync
-- id, so that every phone renames the same ones. Each renamed recipe gets a newer version, pushed
-- by the next sync (its synced_content keeps the server's title, for the merge).
CREATE TEMP TABLE `recipe_title_numbers` AS
SELECT `id`, row_number() OVER (PARTITION BY `sort_key` ORDER BY `sync_id`) AS `number` FROM `recipes`;
--> statement-breakpoint
UPDATE `recipes` SET
	`title` = `title` || ' (' || (SELECT `number` FROM `recipe_title_numbers` WHERE `recipe_title_numbers`.`id` = `recipes`.`id`) || ')',
	`sort_key` = `sort_key` || ' (' || (SELECT `number` FROM `recipe_title_numbers` WHERE `recipe_title_numbers`.`id` = `recipes`.`id`) || ')',
	`updated_at` = max(`updated_at` + 1, (cast(unixepoch('subsec') * 1000 as integer)))
WHERE `id` IN (SELECT `id` FROM `recipe_title_numbers` WHERE `number` > 1);
--> statement-breakpoint
DROP TABLE `recipe_title_numbers`;
--> statement-breakpoint
-- A numbered title another recipe already had ("crêpes (2)" written by hand): that one gets its sync
-- id instead, unique, so that the index below can be created whatever the data.
CREATE TEMP TABLE `recipe_title_clashes` AS
SELECT `id` FROM (
	SELECT `id`, row_number() OVER (PARTITION BY `sort_key` ORDER BY `sync_id`) AS `number` FROM `recipes`
) WHERE `number` > 1;
--> statement-breakpoint
UPDATE `recipes` SET
	`title` = `title` || ' (' || `sync_id` || ')',
	`sort_key` = `sort_key` || ' (' || `sync_id` || ')',
	`updated_at` = max(`updated_at` + 1, (cast(unixepoch('subsec') * 1000 as integer)))
WHERE `id` IN (SELECT `id` FROM `recipe_title_clashes`);
--> statement-breakpoint
DROP TABLE `recipe_title_clashes`;
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_sort_key_unique` ON `recipes` (`sort_key`);
