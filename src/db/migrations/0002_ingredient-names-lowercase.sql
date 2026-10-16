-- Ingredients are saved in lowercase and shown with a capital first letter (toDisplayName).
-- name_key is already the lowercase name (lowercased in JavaScript, accents included: "Œuf" ->
-- "œuf"; SQLite's lower() only knows ASCII). updated_at changes so the sync sends the new names.
UPDATE `ingredients` SET `name` = `name_key`, `updated_at` = (cast(unixepoch('subsec') * 1000 as integer)) WHERE `name` <> `name_key`;
