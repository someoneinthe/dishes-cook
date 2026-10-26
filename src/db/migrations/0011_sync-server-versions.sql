CREATE TABLE `ingredient_aliases` (
	`ingredient_id` integer NOT NULL,
	`sync_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredient_aliases_ingredient_idx` ON `ingredient_aliases` (`ingredient_id`);--> statement-breakpoint
DROP INDEX `cooked_meals_updated_at_id_idx`;--> statement-breakpoint
ALTER TABLE `cooked_meals` ADD `server_version` integer;--> statement-breakpoint
CREATE INDEX `cooked_meals_to_push_idx` ON `cooked_meals` (`updated_at`,`id`) WHERE "cooked_meals"."server_version" is not "cooked_meals"."updated_at";--> statement-breakpoint
DROP INDEX `ingredients_updated_at_id_idx`;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `server_version` integer;--> statement-breakpoint
CREATE INDEX `ingredients_to_push_idx` ON `ingredients` (`updated_at`,`id`) WHERE "ingredients"."server_version" is not "ingredients"."updated_at";--> statement-breakpoint
DROP INDEX `recipes_updated_at_id_idx`;--> statement-breakpoint
ALTER TABLE `recipes` ADD `server_version` integer;--> statement-breakpoint
CREATE INDEX `recipes_to_push_idx` ON `recipes` (`updated_at`,`id`) WHERE "recipes"."server_version" is not "recipes"."updated_at";