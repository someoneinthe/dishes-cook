// Text helpers for user-typed names (ingredients, recipe titles).

const COMBINING_MARKS = /[̀-ͯ]/g;
const WHITESPACE_RUN = /\s+/g;

// Accent- and case-insensitive, numbers in natural order ("Œufs" next to "oignon", "2" < "10").
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Trims and collapses inner whitespace: "  Olive   oil " -> "Olive oil".
export function cleanName(name: string): string {
  return name.trim().replaceAll(WHITESPACE_RUN, ' ');
}

export function compareText(left: string, right: string): number {
  return collator.compare(left, right);
}

export function isMatchingSearch(text: string, search: string): boolean {
  return toSearchText(text).includes(toSearchText(search));
}

export function sortByText<T>(itemList: readonly T[], getText: (item: T) => string): T[] {
  // Copy then sort: Hermes has no Array.prototype.toSorted.
  return [...itemList].sort((left, right) => compareText(getText(left), getText(right)));
}

// Identity of an ingredient: case-insensitive but accent-sensitive ("pâte" and "pâté" differ).
export function toNameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

// Loose form for searching: no case, no accents ("ecrase" finds "Écrasé").
export function toSearchText(text: string): string {
  return cleanName(text).normalize('NFD').replaceAll(COMBINING_MARKS, '').toLowerCase();
}
