import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// After changing this file, generate a migration with `npm run db:generate` (never edit applied
// migrations). See docs/database.md for the design and the query plans it is built for.

export const SEASON_LIST = ['winter', 'summer', 'both'] as const;
export type Season = (typeof SEASON_LIST)[number];
const SEASON_SQL_LIST = SEASON_LIST.map((season) => `'${season}'`).join(', ');

export const COURSE_LIST = ['starter', 'main', 'dessert'] as const;
export type Course = (typeof COURSE_LIST)[number];
const COURSE_SQL_LIST = COURSE_LIST.map((course) => `'${course}'`).join(', ');

// Milliseconds since the epoch, set by SQLite so every writer agrees.
export const NOW_MS = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

export const ingredients = sqliteTable(
  'ingredients',
  {
    createdAt: integer('created_at').notNull().default(NOW_MS),
    // Integer primary key = SQLite's rowid: the fastest key for lookups and joins.
    id: integer('id').primaryKey(),
    // As the user typed it, for display.
    name: text('name').notNull(),
    // Uniqueness key computed by `toNameKey` (trimmed, single spaces, lower case). SQLite's
    // NOCASE only folds ASCII, so "Œuf" and "œuf" are folded in JS instead.
    nameKey: text('name_key').notNull(),
    // Sort and search key computed by `toSortKey` (no case, no accents: "Échalote" -> "echalote").
    // Lists are sorted and paginated by it in SQL, which can't strip accents itself.
    sortKey: text('sort_key').notNull(),
  },
  (table) => [
    check('ingredients_name_not_blank', sql`length(trim(${table.name})) > 0`),
    // Enforces "one ingredient per name" and serves lookups by name.
    uniqueIndex('ingredients_name_key_unique').on(table.nameKey),
    // Pages of the alphabetical list: `(sort_key, id) > (last one)` then LIMIT, read in index order.
    index('ingredients_sort_key_id_idx').on(table.sortKey, table.id),
  ],
);

export const recipes = sqliteTable(
  'recipes',
  {
    // Starter, main course or dessert: every recipe has one, a main course unless chosen otherwise.
    course: text('course', { enum: COURSE_LIST }).notNull().default('main'),
    createdAt: integer('created_at').notNull().default(NOW_MS),
    id: integer('id').primaryKey(),
    // The recipe itself (steps, quantities…). Never selected by list queries: it can be long.
    instructions: text('instructions').notNull().default(''),
    season: text('season', { enum: SEASON_LIST }).notNull().default('both'),
    // Sort and search key of the title, see ingredients.sortKey.
    sortKey: text('sort_key').notNull(),
    title: text('title').notNull(),
    updatedAt: integer('updated_at').notNull().default(NOW_MS),
  },
  (table) => [
    check('recipes_title_not_blank', sql`length(trim(${table.title})) > 0`),
    check('recipes_season_valid', sql`${table.season} in (${sql.raw(SEASON_SQL_LIST)})`),
    check('recipes_course_valid', sql`${table.course} in (${sql.raw(COURSE_SQL_LIST)})`),
    // No index on season or course: 3 values each, so an index can't beat a scan of the (small) table.
    // Pages of the alphabetical list, see ingredients_sort_key_id_idx.
    index('recipes_sort_key_id_idx').on(table.sortKey, table.id),
  ],
);

// Many-to-many link: a recipe uses many ingredients, an ingredient is used by many recipes.
export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    ingredientId: integer('ingredient_id')
      .notNull()
      // An ingredient still used by a recipe can't be deleted (the UI explains why).
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // (recipe_id, ingredient_id): "ingredients of a recipe", and no duplicate link.
    primaryKey({ columns: [table.recipeId, table.ingredientId] }),
    // (ingredient_id, recipe_id): "recipes using these ingredients" (meal choice filter, usage
    // counts, restrict check on delete). Both indexes cover their queries: no table lookup.
    index('recipe_ingredients_ingredient_recipe_idx').on(table.ingredientId, table.recipeId),
  ],
);
