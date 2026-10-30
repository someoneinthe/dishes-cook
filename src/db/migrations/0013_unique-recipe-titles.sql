-- Recipes sharing a title (same sort key: ignoring case and accents) before titles were unique: all
-- but the one with the smallest sync id are numbered, "crêpes (2)", "crêpes (3)"…, with the first
-- numbers no recipe has yet ("crêpes (2)" written by hand is skipped). Ordered by sync id, so that
-- every phone renames the same ones. Each renamed recipe gets a newer version, pushed by the next
-- sync (its synced_content keeps the server's title, for the merge).
-- Nothing a title holds can make the index below fail: a new key is "<key> (<number>)" with a
-- number checked free, and two of them are equal only for the same key and number.
CREATE TEMP TABLE `recipe_title_ranks` AS
SELECT `id`, `sort_key`, row_number() OVER (PARTITION BY `sort_key` ORDER BY `sync_id`) - 1 AS `rank` FROM `recipes`;
--> statement-breakpoint
-- For each shared title, the free numbers in order: from 2 up to the number of recipes + 1, which
-- holds enough of them (the recipes numbered from that title can't take them all).
CREATE TEMP TABLE `recipe_title_free_numbers` AS
WITH RECURSIVE `numbers`(`n`) AS (
	SELECT 2
	UNION ALL
	SELECT `n` + 1 FROM `numbers` WHERE `n` <= (SELECT count(*) FROM `recipes`)
)
SELECT `shared`.`sort_key`, `numbers`.`n`, row_number() OVER (PARTITION BY `shared`.`sort_key` ORDER BY `numbers`.`n`) AS `rank`
FROM (SELECT DISTINCT `sort_key` FROM `recipe_title_ranks` WHERE `rank` > 0) AS `shared`, `numbers`
WHERE NOT EXISTS (
	SELECT 1 FROM `recipes` WHERE `recipes`.`sort_key` = `shared`.`sort_key` || ' (' || `numbers`.`n` || ')'
);
--> statement-breakpoint
-- The n-th recipe after the first takes the n-th free number.
CREATE TEMP TABLE `recipe_title_numbers` AS
SELECT `recipe_title_ranks`.`id`, `recipe_title_free_numbers`.`n` AS `number`
FROM `recipe_title_ranks`
INNER JOIN `recipe_title_free_numbers`
	ON `recipe_title_free_numbers`.`sort_key` = `recipe_title_ranks`.`sort_key`
	AND `recipe_title_free_numbers`.`rank` = `recipe_title_ranks`.`rank`
WHERE `recipe_title_ranks`.`rank` > 0;
--> statement-breakpoint
UPDATE `recipes` SET
	`title` = `title` || ' (' || (SELECT `number` FROM `recipe_title_numbers` WHERE `recipe_title_numbers`.`id` = `recipes`.`id`) || ')',
	`sort_key` = `sort_key` || ' (' || (SELECT `number` FROM `recipe_title_numbers` WHERE `recipe_title_numbers`.`id` = `recipes`.`id`) || ')',
	`updated_at` = max(`updated_at` + 1, (cast(unixepoch('subsec') * 1000 as integer)))
WHERE `id` IN (SELECT `id` FROM `recipe_title_numbers`);
--> statement-breakpoint
DROP TABLE `recipe_title_numbers`;
--> statement-breakpoint
DROP TABLE `recipe_title_free_numbers`;
--> statement-breakpoint
DROP TABLE `recipe_title_ranks`;
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_sort_key_unique` ON `recipes` (`sort_key`);
