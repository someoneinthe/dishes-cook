import { useSyncExternalStore } from 'react';

// The meals picked for the shopping list, by recipe sync id (stable: SQLite can give a deleted
// recipe's integer id to a new one), in the order they were picked. Kept in memory only, on
// purpose (user's choice): the list is shared, not saved. It's forgotten when the app closes, or
// once its meals are marked as cooked.

// At most this many meals: the shopping list's queries stay bounded.
export const MAX_PICKS = 50;

const state: { pickList: readonly string[] } = { pickList: [] };
const listenerSet = new Set<() => void>();

// 'full': not added, the list already holds MAX_PICKS meals.
export function addPick(syncId: string): 'added' | 'full' {
  if (state.pickList.includes(syncId)) {
    return 'added';
  }
  if (state.pickList.length >= MAX_PICKS) {
    return 'full';
  }
  publish([...state.pickList, syncId]);
  return 'added';
}

export function clearPicks(): void {
  publish([]);
}

export function getPicks(): readonly string[] {
  return state.pickList;
}

export function removePick(syncId: string): void {
  publish(state.pickList.filter((id) => id !== syncId));
}

// A new list on each change: compared by identity, it tells whether the list changed.
export function usePicks(): readonly string[] {
  return useSyncExternalStore(subscribe, getPicks);
}

function publish(pickList: readonly string[]): void {
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
