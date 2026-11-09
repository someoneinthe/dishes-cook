import Storage from 'expo-sqlite/kv-store';
import { SUGGESTION_DELAY_HOURS_LIST } from '@/features/settings/preferences';

// The recipes the meal choice suggested lately, by sync id, with when: it doesn't suggest them again
// before Settings › Suggest a meal again after. Kept on this device only, in expo-sqlite's key-value
// store (the delay outlives the app being closed), never synced nor in the recipes' database.

// At most this many: the pick's query stays bounded. Past it, the oldest are forgotten.
export const MAX_RECENT_SUGGESTIONS = 200;

const HOUR = 60 * 60 * 1000;
// Older suggestions matter for no delay: forgotten.
const LONGEST_DELAY = Math.max(...SUGGESTION_DELAY_HOURS_LIST) * HOUR;
const STORAGE_KEY = 'recentSuggestions';

// Oldest first; `at`: when it was suggested (ms).
type Suggestion = Readonly<{ at: number; syncId: string }>;

// Read once from storage, then kept in memory. `isUnreadable`: the stored list couldn't be read, so
// it is never overwritten (it may still be readable at the next launch).
const state: { current?: readonly Suggestion[]; isUnreadable?: boolean } = {};

// The recipes suggested between `since` (ms) and now, by sync id, the one suggested longest ago
// first. Those dated after now (suggested while the clock was ahead) are ignored: they would stay
// skipped for longer than the delay.
export function getSuggestedSince(since: number, now = Date.now()): readonly string[] {
  return read()
    .filter((suggestion) => suggestion.at >= since && suggestion.at <= now)
    .map((suggestion) => suggestion.syncId);
}

// A recipe suggested again moves to the end, with its new time.
export function recordSuggestion(syncId: string, now = Date.now()): void {
  const nextList = [
    ...readForWriting().filter(
      (suggestion) =>
        suggestion.syncId !== syncId && suggestion.at > now - LONGEST_DELAY && suggestion.at <= now,
    ),
    { at: now, syncId },
  ].slice(-MAX_RECENT_SUGGESTIONS);
  // Kept in memory even when it can't be stored (e.g. a full disk): the meal choice still works,
  // and only the next launch may suggest the recipe again sooner.
  state.current = nextList;
  if (state.isUnreadable) {
    return;
  }
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(nextList));
  } catch {
    // Not stored: forgotten when the app closes.
  }
}

// The start of the delay ending now: the recipes suggested since then aren't suggested again.
export function startOfDelay(hours: number, now = Date.now()): number {
  return now - hours * HOUR;
}

function isSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { at, syncId } = value as Record<string, unknown>;
  return typeof at === 'number' && typeof syncId === 'string';
}

// Unreadable (e.g. written by a future version): none.
function parse(stored: null | string): readonly Suggestion[] {
  if (!stored) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    // At most MAX_RECENT_SUGGESTIONS, even if more were stored: the pick's query stays bounded.
    return Array.isArray(parsed) ? parsed.filter(isSuggestion).slice(-MAX_RECENT_SUGGESTIONS) : [];
  } catch {
    return [];
  }
}

// Not readable (the storage failing): none, and the meal choice still works.
function read(): readonly Suggestion[] {
  if (state.current === undefined) {
    const storedList = readStored();
    state.current = storedList ?? [];
    state.isUnreadable = storedList === undefined;
  }
  return state.current;
}

// Before writing, a stored list that couldn't be read is read again: once the storage works again,
// it is merged with the suggestions made meanwhile (newer, so after it) instead of being lost.
function readForWriting(): readonly Suggestion[] {
  const currentList = read();
  if (!state.isUnreadable) {
    return currentList;
  }
  const storedList = readStored();
  if (storedList === undefined) {
    return currentList;
  }
  state.isUnreadable = false;
  const suggestedMeanwhile = new Set(currentList.map((suggestion) => suggestion.syncId));
  return [
    ...storedList.filter((suggestion) => !suggestedMeanwhile.has(suggestion.syncId)),
    ...currentList,
  ];
}

// undefined: the storage failed.
function readStored(): readonly Suggestion[] | undefined {
  try {
    return parse(Storage.getItemSync(STORAGE_KEY));
  } catch {
    return undefined;
  }
}
