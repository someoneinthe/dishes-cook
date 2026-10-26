import type { Quantity } from '@/lib/units';
import { cleanName } from '@/lib/text';
import { toQuantity } from '@/lib/units';

// A recipe read from a photo or a file (recipe-from-text.ts), as the recipe form receives it: the
// blocks of recognized text it's read from, and the draft (title, ingredients, instructions).

// A block of text (a paragraph, a list, a card) as the text recognition reads it, and where it is
// on the page (any unit; without it, the blocks are taken in the given order).
export type ScannedBlock = Readonly<{ frame?: ScannedFrame; lineList: readonly ScannedLine[] }>;

export type ScannedFrame = Readonly<{ bottom: number; left: number; right: number; top: number }>;

export type ScannedIngredient = Readonly<{ name: string; quantity?: Quantity }>;

// A line of text and the height of its letters (any unit: only compared with the other lines).
export type ScannedLine = Readonly<{ height: number; text: string }>;

export type ScannedRecipe = Readonly<{
  ingredientList: readonly ScannedIngredient[];
  instructions: string;
  title: string;
}>;

// More lines are likely not ingredients (a misread page): the user adds the rest.
export const MAX_INGREDIENTS = 40;

// Longest texts a recipe passed as text keeps, as the sync server accepts them (server/migrations).
const MAX_PASSED_NAME_LENGTH = 200;

const MAX_PASSED_TITLE_LENGTH = 500;

const MAX_PASSED_INSTRUCTIONS_LENGTH = 100_000;

// A recipe passed as text (the new-recipe form's `scanned` parameter, from useNewRecipe), checked
// field by field; undefined when it isn't one. Any app can open the form with one (a
// dishescook:// link): no more ingredients than a photo gives, nor longer texts than a sync keeps.
export function parseScannedRecipe(json: string | undefined): ScannedRecipe | undefined {
  try {
    const value: unknown = json === undefined ? undefined : JSON.parse(json);
    if (!isRecord(value) || !Array.isArray(value.ingredientList)) {
      return undefined;
    }
    return {
      ingredientList: value.ingredientList
        .slice(0, MAX_INGREDIENTS)
        .flatMap((item: unknown) => toScannedIngredient(item)),
      instructions:
        typeof value.instructions === 'string'
          ? value.instructions.slice(0, MAX_PASSED_INSTRUCTIONS_LENGTH)
          : '',
      title: typeof value.title === 'string' ? value.title.slice(0, MAX_PASSED_TITLE_LENGTH) : '',
    };
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// An ingredient of a parsed recipe: kept when it has a name, its quantity when usable.
function toScannedIngredient(value: unknown): ScannedIngredient[] {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !cleanName(value.name) ||
    value.name.length > MAX_PASSED_NAME_LENGTH
  ) {
    return [];
  }
  const quantity = isRecord(value.quantity)
    ? toQuantity(value.quantity.amount, value.quantity.unit)
    : undefined;
  return [quantity ? { name: value.name, quantity } : { name: value.name }];
}
