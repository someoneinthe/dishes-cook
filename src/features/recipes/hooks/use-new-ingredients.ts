import { useState } from 'react';
import type { AppDatabase } from '@/db/types';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Quantity } from '@/lib/units';
import { useDatabase } from '@/db/database-context';
import {
  findIngredientByName,
  findSimilarIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { toNameKey } from '@/lib/text';
import type { ScannedIngredient } from '../recipe-from-text';

// The scanned ingredients the form adds, and the quantities read (by ingredient id: added ones,
// and the ones the form already had).
export type ScanResult = Readonly<{
  addedList: Ingredient[];
  quantityList: [number, Quantity][];
}>;

type Picked = Readonly<{ existing: Ingredient | undefined; scanned: ScannedIngredient }>;

type Resolved = Readonly<{
  // The last temporary id given (below 0).
  lastId: number;
  newNameList: [number, string][];
  newSimilarList: [number, Ingredient][];
}> &
  ScanResult;

// Ingredients read from a photo, in the recipe form. One that exists (same name, ignoring case) is
// used; the others are new, with a temporary id below 0, and created when the recipe is saved.
// When a new one looks like an existing one ("carrot" / "Carrots"), the user chooses: use the
// existing one, or keep the new one; the recipe can't be saved before. `initialList`: the
// ingredients of a recipe started from a photo (useNewRecipe), read when the form opens.
export function useNewIngredients(initialList: readonly ScannedIngredient[] = []) {
  const database = useDatabase();
  const [initial] = useState(() => resolveScanned(database, initialList, [], 0));
  const [lastId, setLastId] = useState(initial.lastId);
  const [nameMap, setNameMap] = useState<ReadonlyMap<number, string>>(
    () => new Map(initial.newNameList),
  );
  // The existing ingredient each undecided new one looks like.
  const [similarMap, setSimilarMap] = useState<ReadonlyMap<number, Ingredient>>(
    () => new Map(initial.newSimilarList),
  );

  const forget = (id: number) => {
    setSimilarMap((previous) => withoutKey(previous, id));
  };

  return {
    // The scanned ingredients not in the form yet, as the form adds them, and the quantities read.
    add: (
      scannedList: readonly ScannedIngredient[],
      selectedList: readonly Ingredient[],
    ): ScanResult => {
      const resolved = resolveScanned(database, scannedList, selectedList, lastId);
      setLastId(resolved.lastId);
      setNameMap((previous) => new Map([...previous, ...resolved.newNameList]));
      setSimilarMap((previous) => new Map([...previous, ...resolved.newSimilarList]));
      return resolved;
    },
    // The existing ingredient replaces the new one (the form swaps them): nothing to create.
    chooseSimilar: (id: number) => {
      forget(id);
      setNameMap((previous) => withoutKey(previous, id));
    },
    // The ingredients of `initialList`, as the form starts with them, and their quantities.
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

// The scanned ingredients not selected yet: existing ones found by name, the others new (with the
// existing ingredient they look like, if any), numbered below `lastId`. The quantities read are
// kept for the selected ingredients too.
function resolveScanned(
  database: AppDatabase,
  scannedList: readonly ScannedIngredient[],
  selectedList: readonly Ingredient[],
  lastId: number,
): Resolved {
  const selectedByKey = new Map(
    selectedList.map((ingredient) => [toNameKey(ingredient.name), ingredient]),
  );
  const pickedByKey = new Map<string, Picked>();
  const quantityList: [number, Quantity][] = [];
  for (const scanned of scannedList) {
    const existing = findIngredientByName(database, scanned.name);
    const nameKey = toNameKey(existing?.name ?? scanned.name);
    const selected = selectedByKey.get(nameKey);
    if (selected && scanned.quantity) {
      quantityList.push([selected.id, scanned.quantity]);
    }
    if (!selected && !pickedByKey.has(nameKey)) {
      pickedByKey.set(nameKey, { existing, scanned });
    }
  }
  const newNameList: [number, string][] = [];
  const newSimilarList: [number, Ingredient][] = [];
  const addedList = [...pickedByKey.values()].map(({ existing, scanned }) => {
    const ingredient = existing ?? { id: lastId - newNameList.length - 1, name: scanned.name };
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
  return {
    addedList,
    lastId: lastId - newNameList.length,
    newNameList,
    newSimilarList,
    quantityList,
  };
}

function withoutKey<Value>(
  map: ReadonlyMap<number, Value>,
  key: number,
): ReadonlyMap<number, Value> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
