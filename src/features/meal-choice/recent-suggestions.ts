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

// Read once from storage, then kept in memory.
const state: { current?: readonly Suggestion[] } = {};

// The recipes suggested at or after `since` (ms), by sync id, the one suggested longest ago first.
export function getSuggestedSince(since: number): readonly string[] {
  return read()
    .filter((suggestion) => suggestion.at >= since)
    .map((suggestion) => suggestion.syncId);
}

// A recipe suggested again moves to the end, with its new time.
export function recordSuggestion(syncId: string, now = Date.now()): void {
  const nextList = [
    ...read().filter(
      (suggestion) => suggestion.syncId !== syncId && suggestion.at > now - LONGEST_DELAY,
    ),
    { at: now, syncId },
  ].slice(-MAX_RECENT_SUGGESTIONS);
  // Stored first: if the write throws, nothing changes (the recipe may be suggested again sooner).
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(nextList));
  state.current = nextList;
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
    return Array.isArray(parsed) ? parsed.filter(isSuggestion) : [];
  } catch {
    return [];
  }
}

function read(): readonly Suggestion[] {
  state.current ??= parse(Storage.getItemSync(STORAGE_KEY));
  return state.current;
}
