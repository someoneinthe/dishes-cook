import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Messages } from '@/i18n/en';
import type { Quantity, UnitSystem } from '@/lib/units';
import { formatAmount, parseAmount, toDisplay, toStored } from '@/lib/units';
import type { QuantityDraft } from './components/ingredient-quantity-row';
import type { Recipe } from './db/recipe-queries';

// The recipe form's quantities (recipe-form-screen.tsx): what's typed for each ingredient, read into
// stored quantities on Save, and kept with its ingredient when one replaces another.

export const EMPTY_DRAFT: QuantityDraft = { amountText: '' };

// A row of the form, read when saving.
type RowReading = Readonly<{ isInvalid: boolean; quantity?: Quantity }>;

type SavedQuantity = Readonly<{ draft: QuantityDraft; stored: Quantity }>;

// The typed quantity follows the ingredient it was typed for, unless the other one has its own.
export function moveDraft(
  draftMap: ReadonlyMap<number, QuantityDraft>,
  fromId: number,
  toId: number,
): Map<number, QuantityDraft> {
  const next = new Map(draftMap);
  const draft = draftMap.get(fromId);
  if (draft && !draftMap.get(toId)?.amountText) {
    next.set(toId, draft);
  }
  next.delete(fromId);
  return next;
}

// The quantities of the selected ingredients; an empty amount = no quantity.
export function readQuantities(
  selectedList: readonly Ingredient[],
  draftMap: ReadonlyMap<number, QuantityDraft>,
  savedMap: ReadonlyMap<number, SavedQuantity>,
): Readonly<{ invalidIdList: number[]; quantities: Map<number, Quantity> }> {
  const invalidIdList: number[] = [];
  const quantities = new Map<number, Quantity>();
  for (const { id } of selectedList) {
    const { isInvalid, quantity } = readRow(draftMap.get(id) ?? EMPTY_DRAFT, savedMap.get(id));
    if (isInvalid) {
      invalidIdList.push(id);
    }
    if (quantity) {
      quantities.set(id, quantity);
    }
  }
  return { invalidIdList, quantities };
}

// The saved quantities: as the form shows them (in the reader's units, "1,5" in French), and as
// stored, kept for the rows the user doesn't touch (a display rounds: 226.8 g shows as 227 g).
export function savedQuantities(
  recipe: Recipe | undefined,
  t: Messages,
  units: UnitSystem,
): Map<number, SavedQuantity> {
  const savedMap = new Map<number, SavedQuantity>();
  const ingredientList = recipe?.ingredientList ?? [];
  for (const { id, quantity } of ingredientList) {
    const saved = quantity && toSaved(quantity, t, units);
    if (saved) {
      savedMap.set(id, saved);
    }
  }
  return savedMap;
}

// The existing ingredient takes the new one's place, or the new one goes when it's already there.
export function swapIngredient(
  selectedList: readonly Ingredient[],
  fromId: number,
  to: Ingredient,
): Ingredient[] {
  const isSelected = selectedList.some((ingredient) => ingredient.id === to.id);
  return selectedList.flatMap((ingredient) => {
    if (ingredient.id !== fromId) {
      return [ingredient];
    }
    return isSelected ? [] : [to];
  });
}

export function withoutId(idSet: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(idSet);
  next.delete(id);
  return next;
}

// The quantities read from a photo, in the reader's units ("2 cups" shows as 473 ml in European
// units).
export function withScannedDrafts(
  draftMap: ReadonlyMap<number, QuantityDraft>,
  quantityList: readonly (readonly [number, Quantity])[],
  t: Messages,
  units: UnitSystem,
): Map<number, QuantityDraft> {
  const next = new Map(draftMap);
  for (const [id, quantity] of quantityList) {
    next.set(id, toSaved(toStored(quantity), t, units).draft);
  }
  return next;
}

// One row: left as shown, its stored quantity; edited, as typed; nothing when empty.
function readRow(draft: QuantityDraft, saved: SavedQuantity | undefined): RowReading {
  if (draft.amountText === saved?.draft.amountText && draft.unit === saved.draft.unit) {
    return { isInvalid: false, quantity: saved.stored };
  }
  const amount = parseAmount(draft.amountText);
  if (amount === undefined) {
    return { isInvalid: draft.amountText.trim() !== '' };
  }
  return {
    isInvalid: false,
    quantity: draft.unit === undefined ? { amount } : { amount, unit: draft.unit },
  };
}

// A stored quantity, and how the form shows it.
function toSaved(quantity: Quantity, t: Messages, units: UnitSystem): SavedQuantity {
  const shown = toDisplay(quantity, units);
  return {
    draft: {
      amountText: formatAmount(shown.amount, t.quantities.decimalSeparator),
      unit: shown.unit,
    },
    stored: quantity,
  };
}
