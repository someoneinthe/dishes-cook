-- Sort and search keys write the ligatures out, as people type them (toSearchText): "œuf" -> "oeuf",
-- so searching "oeuf" finds "Œuf". The keys are in lowercase already. They aren't synced (each
-- device computes them from the name): updated_at stays.
UPDATE `ingredients` SET `sort_key` = replace(replace(`sort_key`, 'œ', 'oe'), 'æ', 'ae') WHERE `sort_key` LIKE '%œ%' OR `sort_key` LIKE '%æ%';
--> statement-breakpoint
UPDATE `recipes` SET `sort_key` = replace(replace(`sort_key`, 'œ', 'oe'), 'æ', 'ae') WHERE `sort_key` LIKE '%œ%' OR `sort_key` LIKE '%æ%';
