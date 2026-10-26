import type { Course, RecipeKind, Season } from '@/db/schema';
import type { Quantity } from '@/lib/units';
import { COURSE_LIST, RECIPE_KIND_LIST, SEASON_LIST } from '@/db/schema';
import { toQuantity } from '@/lib/units';

// Merging a recipe changed both on this phone and on the server (by another phone) since they last
// agreed (see docs/sync.md › How it works › Changes on two phones): from what both started from
// (`recipes.synced_content`), each field takes the side that changed it, and the newest side when
// both did. Ingredients are merged one by one: added, removed, or their quantity changed.

// A recipe's content as the server has it in a version, in this phone's terms: ingredients by this
// phone's sync id for them (an ingredient the server knows under another phone's id, see
// ingredient_aliases, under this phone's own), each with its quantity (null = none).
export type SyncedContent = Readonly<{
  cookMinutes: null | number;
  course: Course;
  ingredients: Readonly<Record<string, null | Quantity>>;
  instructions: string;
  kind: RecipeKind;
  maturationMonths: null | number;
  prepMinutes: null | number;
  season: Season;
  title: string;
}>;

const FIELD_LIST = [
  'cookMinutes',
  'course',
  'instructions',
  'kind',
  'maturationMonths',
  'prepMinutes',
  'season',
  'title',
] as const;

// Whether two contents are the same recipe (ingredients in any order).
export function isSameContent(content: SyncedContent, other: SyncedContent): boolean {
  return (
    FIELD_LIST.every((field) => content[field] === other[field]) &&
    isSameIngredients(content.ingredients, other.ingredients)
  );
}

// The merged content. `isLocalNewer`: this phone's change is the newest, it wins a field both
// sides changed.
export function mergeContent(
  base: SyncedContent,
  local: SyncedContent,
  remote: SyncedContent,
  isLocalNewer: boolean,
): SyncedContent {
  const pick = <T>(
    baseValue: T,
    localValue: T,
    remoteValue: T,
    isSame: (a: T, b: T) => boolean,
  ) => {
    if (isSame(localValue, baseValue)) {
      return remoteValue;
    }
    if (isSame(remoteValue, baseValue)) {
      return localValue;
    }
    return isLocalNewer ? localValue : remoteValue;
  };
  const isEqual = <T>(value: T, other: T) => value === other;
  const ingredients: Record<string, null | Quantity> = {};
  const keySet = new Set([
    ...Object.keys(base.ingredients),
    ...Object.keys(local.ingredients),
    ...Object.keys(remote.ingredients),
  ]);
  for (const key of keySet) {
    // undefined: not in the recipe.
    const value = pick(
      ingredientOf(base, key),
      ingredientOf(local, key),
      ingredientOf(remote, key),
      isSameQuantity,
    );
    if (value !== undefined) {
      ingredients[key] = value;
    }
  }
  return {
    cookMinutes: pick(base.cookMinutes, local.cookMinutes, remote.cookMinutes, isEqual),
    course: pick(base.course, local.course, remote.course, isEqual),
    ingredients,
    instructions: pick(base.instructions, local.instructions, remote.instructions, isEqual),
    kind: pick(base.kind, local.kind, remote.kind, isEqual),
    maturationMonths: pick(
      base.maturationMonths,
      local.maturationMonths,
      remote.maturationMonths,
      isEqual,
    ),
    prepMinutes: pick(base.prepMinutes, local.prepMinutes, remote.prepMinutes, isEqual),
    season: pick(base.season, local.season, remote.season, isEqual),
    title: pick(base.title, local.title, remote.title, isEqual),
  };
}

// A stored content (recipes.synced_content); undefined when there's none, or it isn't usable (the
// pull then keeps the newest change, whole, as before).
export function parseSyncedContent(json: null | string): SyncedContent | undefined {
  if (json === null) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const content = value as Record<string, unknown>;
    if (!isContentShape(content)) {
      return undefined;
    }
    const ingredients: Record<string, null | Quantity> = {};
    for (const [syncId, quantity] of Object.entries(content.ingredients)) {
      const { amount, unit } = (quantity ?? {}) as Record<string, unknown>;
      ingredients[syncId] = toQuantity(amount, unit) ?? null;
    }
    return {
      cookMinutes: toNumberOrNull(content.cookMinutes),
      course: content.course as Course,
      ingredients,
      instructions: content.instructions,
      kind: content.kind as RecipeKind,
      maturationMonths: toNumberOrNull(content.maturationMonths),
      prepMinutes: toNumberOrNull(content.prepMinutes),
      season: content.season as Season,
      title: content.title,
    };
  } catch {
    return undefined;
  }
}

// An ingredient's quantity in a content: null = without one, undefined = not in the recipe.
function ingredientOf(content: SyncedContent, syncId: string): null | Quantity | undefined {
  return Object.hasOwn(content.ingredients, syncId) ? content.ingredients[syncId] : undefined;
}

// Whether a stored content has every field, with a usable value.
function isContentShape(content: Record<string, unknown>): content is Record<string, unknown> & {
  ingredients: object;
  instructions: string;
  title: string;
} {
  return (
    typeof content.title === 'string' &&
    typeof content.instructions === 'string' &&
    COURSE_LIST.includes(content.course as Course) &&
    SEASON_LIST.includes(content.season as Season) &&
    RECIPE_KIND_LIST.includes(content.kind as RecipeKind) &&
    typeof content.ingredients === 'object' &&
    content.ingredients !== null
  );
}

function isSameIngredients(
  ingredients: SyncedContent['ingredients'],
  other: SyncedContent['ingredients'],
): boolean {
  const keyList = Object.keys(ingredients);
  return (
    keyList.length === Object.keys(other).length &&
    keyList.every(
      (syncId) =>
        Object.hasOwn(other, syncId) && isSameQuantity(ingredients[syncId], other[syncId]),
    )
  );
}

function isSameQuantity(
  quantity: null | Quantity | undefined,
  other: null | Quantity | undefined,
): boolean {
  return quantity === undefined || other === undefined || quantity === null || other === null
    ? quantity === other
    : quantity.amount === other.amount && quantity.unit === other.unit;
}

function toNumberOrNull(value: unknown): null | number {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
