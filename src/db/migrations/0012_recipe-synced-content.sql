ALTER TABLE `recipes` ADD `synced_content` text;--> statement-breakpoint
-- Recipes the server has in their current version: its content is theirs (SyncedContent in
-- src/features/sync/recipe-merge.ts). The others get one at their next pull or push.
UPDATE `recipes` SET `synced_content` = json_object(
	'title', `title`,
	'instructions', `instructions`,
	'season', `season`,
	'course', `course`,
	'kind', `kind`,
	'prepMinutes', `prep_minutes`,
	'cookMinutes', `cook_minutes`,
	'maturationMonths', `maturation_months`,
	'ingredients', (
		SELECT json_group_object(
			`ingredients`.`sync_id`,
			CASE WHEN `recipe_ingredients`.`amount` IS NULL THEN json('null')
			ELSE json_object('amount', `recipe_ingredients`.`amount`, 'unit', `recipe_ingredients`.`unit`) END
		)
		FROM `recipe_ingredients`
		INNER JOIN `ingredients` ON `ingredients`.`id` = `recipe_ingredients`.`ingredient_id`
		WHERE `recipe_ingredients`.`recipe_id` = `recipes`.`id`
	)
) WHERE `server_version` = `updated_at`;
