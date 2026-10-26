import { useRef, useState } from 'react';
import type { AppDatabase } from '@/db/types';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Quantity } from '@/lib/units';
import { useDatabase } from '@/db/database-context';
import {
  findIngredientByName,
  findSimilarIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { toDisplayName, toNameKey } from '@/lib/text';
import type { ScannedIngredient } from '../scanned-recipe';

// The ingredients a recipe read from a photo starts with, and the quantities read, by id.
export type ScanResult = Readonly<{
  addedList: Ingredient[];
  quantityList: [number, Quantity][];
}>;

type Picked = Readonly<{ existing: Ingredient | undefined; scanned: ScannedIngredient }>;

type Resolved = Readonly<{
  newNameList: [number, string][];
  newSimilarList: [number, Ingredient][];
}> &
  ScanResult;

// Ingredients typed or read from a photo, in the recipe form. One that exists (same name, ignoring
// case) is used; the others are new, with a temporary id below 0, and created when the recipe is
// saved (only if still in it).
// When a new one looks like an existing one ("carrot" / "Carrots"), the user chooses: use the
// existing one, or keep the new one; the recipe can't be saved before. `scannedList`: the
// ingredients of a recipe started from a photo (useNewRecipe), read when the form opens.
export function useNewIngredients(scannedList: readonly ScannedIngredient[] = []) {
  const database = useDatabase();
  const [initial] = useState(() => resolveScanned(database, scannedList));
  const [nameMap, setNameMap] = useState<ReadonlyMap<number, string>>(
    () => new Map(initial.newNameList),
  );
  // The existing ingredient each undecided new one looks like.
  const [similarMap, setSimilarMap] = useState<ReadonlyMap<number, Ingredient>>(
    () => new Map(initial.newSimilarList),
  );
  // The next temporary id, below the scanned ones'.
  const nextIdRef = useRef(-1 - initial.newNameList.length);

  const forget = (id: number) => {
    setSimilarMap((previous) => withoutKey(previous, id));
  };

  return {
    // An ingredient typed in the picker: the existing one with this name, or a new one (the same
    // one when typed again after being removed, keeping its quantity).
    add: (name: string): Ingredient => {
      const existing = findIngredientByName(database, name);
      if (existing) {
        return existing;
      }
      const nameKey = toNameKey(name);
      // Shown like the saved ones: a capital first letter (it's saved in lowercase).
      const shownName = toDisplayName(nameKey);
      const [addedId] =
        [...nameMap].find(([, addedName]) => toNameKey(addedName) === nameKey) ?? [];
      if (addedId !== undefined) {
        return { id: addedId, name: shownName };
      }
      const id = nextIdRef.current;
      nextIdRef.current -= 1;
      setNameMap((previous) => new Map(previous).set(id, name));
      return { id, name: shownName };
    },
    // The existing ingredient replaces the new one (the form swaps them): nothing to create.
    chooseSimilar: (id: number) => {
      forget(id);
      setNameMap((previous) => withoutKey(previous, id));
    },
    // The ingredients of `scannedList`, as the form starts with them, and their quantities.
    initial: initial as ScanResult,
    // Keeps the new ingredient, as read.
    keepNew: forget,
    // Names of the ingredients to create on Save, by temporary id.
    nameMap,
    // The existing ingredient a new one looks like, until the user chooses.
    similarOf: (id: number): Ingredient | undefined => similarMap.get(id),
    // The new ingredients still waiting for the user's choice.
    undecidedIdList: (selectedList: readonly Ingredient[]) =>
      selectedList.filter((ingredient) => similarMap.has(ingredient.id)).map(({ id }) => id),
  };
}

// The scanned ingredients, each once: existing ones found by name, the others new, with temporary
// ids below 0 (and the existing ingredient they look like, if any).
function resolveScanned(
  database: AppDatabase,
  scannedList: readonly ScannedIngredient[],
): Resolved {
  const pickedByKey = new Map<string, Picked>();
  for (const scanned of scannedList) {
    const existing = findIngredientByName(database, scanned.name);
    const nameKey = toNameKey(existing?.name ?? scanned.name);
    if (!pickedByKey.has(nameKey)) {
      pickedByKey.set(nameKey, { existing, scanned });
    }
  }
  const newNameList: [number, string][] = [];
  const newSimilarList: [number, Ingredient][] = [];
  const quantityList: [number, Quantity][] = [];
  const addedList = [...pickedByKey.values()].map(({ existing, scanned }) => {
    // Shown like the saved ones: a capital first letter (it's saved in lowercase).
    const shownName = toDisplayName(toNameKey(scanned.name));
    const ingredient = existing ?? { id: -1 - newNameList.length, name: shownName };
    if (!existing) {
      newNameList.push([ingredient.id, scanned.name]);
      const similar = findSimilarIngredient(database, scanned.name);
      if (similar) {
        newSimilarList.push([ingredient.id, similar]);
      }
    }
    if (scanned.quantity) {
      quantityList.push([ingredient.id, scanned.quantity]);
    }
    return ingredient;
  });
  return { addedList, newNameList, newSimilarList, quantityList };
}

function withoutKey<Value>(
  map: ReadonlyMap<number, Value>,
  key: number,
): ReadonlyMap<number, Value> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
