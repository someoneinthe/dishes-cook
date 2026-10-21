// Text helpers for user-typed names (ingredients, recipe titles).

const COMBINING_MARKS = /[̀-ͯ]/g;
// Ligatures Unicode doesn't split into letters (NFD keeps "œ"): written out, as people type them.
const LIGATURE = /[æœ]/g;
const LIGATURE_LETTERS: Readonly<Record<string, string>> = { æ: 'ae', œ: 'oe' };
const WHITESPACE_RUN = /\s+/g;

// Trims and collapses inner whitespace: "  Olive   oil " -> "Olive oil".
export function cleanName(name: string): string {
  return name.trim().replaceAll(WHITESPACE_RUN, ' ');
}

// An ingredient's name as shown: its first letter capitalized ("huile d'olive" -> "Huile d'olive").
// Names are saved in lowercase (toNameKey).
export function toDisplayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// `%` and `_` typed by the user match themselves in a `LIKE … ESCAPE '\\'` pattern.
export function toLikeContains(search: string): string {
  const escaped = toSearchText(search).replaceAll(/[\\%_]/g, (character) => `\\${character}`);
  return `%${escaped}%`;
}

// Identity of an ingredient: case-insensitive but accent-sensitive ("pâte" and "pâté" differ). It
// is also the saved name: ingredients are saved in lowercase and shown with toDisplayName.
export function toNameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

// Loose form for searching: no case, no accents, ligatures written out ("ecrase" finds "Écrasé",
// "oeuf" finds "Œuf").
export function toSearchText(text: string): string {
  return cleanName(text)
    .normalize('NFD')
    .replaceAll(COMBINING_MARKS, '')
    .toLowerCase()
    .replaceAll(LIGATURE, (ligature) => LIGATURE_LETTERS[ligature] ?? ligature);
}

// Stored as `sort_key` to sort and search in SQL, which can't strip accents.
export function toSortKey(text: string): string {
  return toSearchText(text);
}

// Most sort keys an ingredient's name is compared with (one per mix of word forms).
const MAX_WORD_FORMS = 32;
// Shorter words ("de", "of", "à") have no plural to guess.
const MIN_INFLECTED_LENGTH = 3;

// The sort keys of the name with each word in the singular or the plural (English and French
// rules of thumb: "carrot" / "carrots", "poireau" / "poireaux", "tomato" / "tomatoes",
// "cherry" / "cherries"), to find an ingredient written another way.
export function toWordForms(name: string): string[] {
  let formList = [''];
  for (const word of toSearchText(name).split(' ')) {
    const wordFormList = toInflections(word);
    formList = formList
      .flatMap((start) => wordFormList.map((form) => (start ? `${start} ${form}` : form)))
      .slice(0, MAX_WORD_FORMS);
  }
  return formList;
}

// Endings and what they may be in the other number, in order: the first ending that matches is
// used ('' matches any word: "carrot" -> "carrots").
const INFLECTION_RULE_LIST: readonly (readonly [ending: string, replacementList: string[]])[] = [
  ['eaux', ['eau']],
  ['ies', ['y']],
  ['es', ['e', '']],
  ['s', ['']],
  ['x', ['']],
  ['eau', ['eaux']],
  ['eu', ['eux']],
  ['y', ['ies', 'ys']],
  ['o', ['oes', 'os']],
  ['ch', ['ches']],
  ['sh', ['shes']],
  ['', ['s']],
];

// A word (lowercase, no accents), then its likely singulars or plurals.
function toInflections(word: string): string[] {
  if (word.length < MIN_INFLECTED_LENGTH) {
    return [word];
  }
  // The '' rule matches every word.
  const [ending, replacementList] = INFLECTION_RULE_LIST.find(([rule]) => word.endsWith(rule)) ?? [
    '',
    [],
  ];
  const stem = word.slice(0, word.length - ending.length);
  return [word, ...replacementList.map((replacement) => stem.concat(replacement))];
}
