import { useRef, useState } from 'react';
import type { Ingredient } from '@/features/ingredients/db/ingredient-queries';
import type { Quantity } from '@/lib/units';
import { useDatabase } from '@/db/database-context';
import {
  findIngredientByName,
  findSimilarIngredient,
} from '@/features/ingredients/db/ingredient-queries';
import { toNameKey } from '@/lib/text';
import type { ScannedIngredient } from '../recipe-from-text';

export type AddedIngredient = Ingredient & Readonly<{ quantity?: Quantity }>;

// Ingredients read from a photo, in the recipe form. One that exists (same name, ignoring case) is
// used; the others are new, with a temporary id below 0, and created when the recipe is saved.
// When a new one looks like an existing one ("carrot" / "Carrots"), the user chooses: use the
// existing one, or keep the new one; the recipe can't be saved before.
export function useNewIngredients() {
  const database = useDatabase();
  const [nameMap, setNameMap] = useState<ReadonlyMap<number, string>>(new Map());
  // The existing ingredient each undecided new one looks like.
  const [similarMap, setSimilarMap] = useState<ReadonlyMap<number, Ingredient>>(new Map());
  const nextId = useRef(-1);

  const forget = (id: number) => {
    setSimilarMap((previous) => withoutKey(previous, id));
  };

  return {
    // The scanned ingredients not in the form yet, as the form adds them.
    add: (
      scannedList: readonly ScannedIngredient[],
      selectedList: readonly Ingredient[],
    ): AddedIngredient[] => {
      const nameKeySet = new Set(selectedList.map((ingredient) => toNameKey(ingredient.name)));
      const addedList: AddedIngredient[] = [];
      const newNameList: [number, string][] = [];
      const newSimilarList: [number, Ingredient][] = [];
      for (const { name, quantity } of scannedList) {
        const existing = findIngredientByName(database, name);
        if (nameKeySet.has(toNameKey(existing?.name ?? name))) {
          continue;
        }
        nameKeySet.add(toNameKey(existing?.name ?? name));
        const ingredient = existing ?? { id: nextId.current--, name };
        if (!existing) {
          newNameList.push([ingredient.id, name]);
          const similar = findSimilarIngredient(database, name);
          if (similar) {
            newSimilarList.push([ingredient.id, similar]);
          }
        }
        addedList.push(quantity ? { ...ingredient, quantity } : ingredient);
      }
      setNameMap((previous) => new Map([...previous, ...newNameList]));
      setSimilarMap((previous) => new Map([...previous, ...newSimilarList]));
      return addedList;
    },
    // The existing ingredient replaces the new one (the form swaps them): nothing to create.
    chooseSimilar: (id: number) => {
      forget(id);
      setNameMap((previous) => withoutKey(previous, id));
    },
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

function withoutKey<Value>(
  map: ReadonlyMap<number, Value>,
  key: number,
): ReadonlyMap<number, Value> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
