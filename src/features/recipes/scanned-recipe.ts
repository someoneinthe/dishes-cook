import type { Quantity } from '@/lib/units';
import { cleanName } from '@/lib/text';

// A recipe read from a photo or a file (recipe-from-text.ts), as the recipe form receives it: the
// blocks of recognized text it's read from, and the draft (title, ingredients, instructions) handed
// to the form in memory.

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

// Longest texts a draft keeps, as the sync server accepts them (server/migrations).
const MAX_DRAFT_NAME_LENGTH = 200;

const MAX_DRAFT_TITLE_LENGTH = 500;

const MAX_DRAFT_INSTRUCTIONS_LENGTH = 100_000;

// The recipes read, waiting for the form that opens with them (its `draft` parameter), by id. Kept
// in memory, never in the link: no other app can open the form filled in. A few at most: each goes
// when its form closes.
const draftMap = new Map<string, ScannedRecipe>();
const draftCounter = { lastId: 0 };

// Forgets a draft once its form is gone (saved or left).
export function forgetScannedDraft(id: string): void {
  draftMap.delete(id);
}

export function getScannedDraft(id: string | undefined): ScannedRecipe | undefined {
  return id === undefined ? undefined : draftMap.get(id);
}

// Keeps a recipe read from a photo or a file for the form; returns the id the form reads it by. A
// misread page or a long document is cut down to what a recipe can hold: no more ingredients than
// a photo gives (unnamed ones dropped), nor longer texts than a sync keeps.
export function putScannedDraft(recipe: ScannedRecipe): string {
  draftCounter.lastId += 1;
  const id = String(draftCounter.lastId);
  draftMap.set(id, {
    ingredientList: recipe.ingredientList
      .slice(0, MAX_INGREDIENTS)
      .filter(({ name }) => cleanName(name) && name.length <= MAX_DRAFT_NAME_LENGTH),
    instructions: recipe.instructions.slice(0, MAX_DRAFT_INSTRUCTIONS_LENGTH),
    title: recipe.title.slice(0, MAX_DRAFT_TITLE_LENGTH),
  });
  return id;
}
