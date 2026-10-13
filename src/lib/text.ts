// Text helpers for user-typed names (ingredients, recipe titles).

const COMBINING_MARKS = /[̀-ͯ]/g;
const WHITESPACE_RUN = /\s+/g;

// Trims and collapses inner whitespace: "  Olive   oil " -> "Olive oil".
export function cleanName(name: string): string {
  return name.trim().replaceAll(WHITESPACE_RUN, ' ');
}

// `%` and `_` typed by the user match themselves in a `LIKE … ESCAPE '\\'` pattern.
export function toLikeContains(search: string): string {
  const escaped = toSearchText(search).replaceAll(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

// Identity of an ingredient: case-insensitive but accent-sensitive ("pâte" and "pâté" differ).
export function toNameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

// Loose form for searching: no case, no accents ("ecrase" finds "Écrasé").
export function toSearchText(text: string): string {
  return cleanName(text).normalize('NFD').replaceAll(COMBINING_MARKS, '').toLowerCase();
}

// Stored as `sort_key` to sort and search in SQL, which can't strip accents.
export function toSortKey(text: string): string {
  return toSearchText(text);
}
