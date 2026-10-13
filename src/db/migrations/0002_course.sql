-- Hand-written instead of drizzle-kit's output, which rebuilt the table (copy, DROP, rename) to add
-- the CHECK: inside the migration transaction `PRAGMA foreign_keys=OFF` has no effect, so dropping
-- `recipes` would cascade-delete every recipe_ingredients row. Same schema, added in place (a NULL
-- course passes the CHECK).
ALTER TABLE `recipes` ADD `course` text CONSTRAINT "recipes_course_valid" CHECK("course" in ('starter', 'main', 'dessert'));
