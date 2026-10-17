import { useSyncExternalStore } from 'react';

// The meals picked for the shopping list (recipe ids), in the order they were picked. Kept in
// memory only, on purpose (user's choice): the list is shared, not saved. It's forgotten when the
// app closes, or once its meals are marked as cooked.

// At most this many meals: the shopping list's queries stay bounded.
export const MAX_PICKS = 50;

const state: { pickList: readonly number[] } = { pickList: [] };
const listenerSet = new Set<() => void>();

export function addPick(recipeId: number): void {
  if (state.pickList.includes(recipeId) || state.pickList.length >= MAX_PICKS) {
    return;
  }
  publish([...state.pickList, recipeId]);
}

export function clearPicks(): void {
  publish([]);
}

export function getPicks(): readonly number[] {
  return state.pickList;
}

export function removePick(recipeId: number): void {
  publish(state.pickList.filter((id) => id !== recipeId));
}

export function usePicks(): readonly number[] {
  return useSyncExternalStore(subscribe, getPicks);
}

function publish(pickList: readonly number[]): void {
  state.pickList = pickList;
  for (const listener of listenerSet) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listenerSet.add(listener);
  return () => {
    listenerSet.delete(listener);
  };
}
