import type { Unit } from '@/lib/units';
import { cleanName, toSearchText } from '@/lib/text';
import { parseAmount } from '@/lib/units';
import type { ScannedIngredient } from './scanned-recipe';

// One ingredient line of a recipe read from a photo or a file (recipe-from-text.ts): its quantity,
// unit and name, in English and French ("200 g de farine", "2 tbsp olive oil").

// Units as written in recipes, compared without case nor accents. An alias only matches a whole
// word ("g" isn't the start of "gousses"), so their order doesn't matter.
const UNIT_ALIAS_LIST: readonly (readonly [string, Unit])[] = [
  ['bunch', 'bunch'],
  ['bunches', 'bunch'],
  ['botte', 'bunch'],
  ['bottes', 'bunch'],
  ['bouquet', 'bunch'],
  ['bouquets', 'bunch'],
  ['can', 'can'],
  ['cans', 'can'],
  ['tin', 'can'],
  ['tins', 'can'],
  ['boite', 'can'],
  ['boites', 'can'],
  ['cl', 'cl'],
  ['clove', 'clove'],
  ['cloves', 'clove'],
  ['gousse', 'clove'],
  ['gousses', 'clove'],
  ['cup', 'cup'],
  ['cups', 'cup'],
  // eslint-disable-next-line no-restricted-syntax -- a unit as written in recipes, not UI text
  ['fl oz', 'fl_oz'],
  ['fl. oz', 'fl_oz'],
  ['g', 'g'],
  ['gr', 'g'],
  ['gram', 'g'],
  ['grams', 'g'],
  ['gramme', 'g'],
  ['grammes', 'g'],
  ['kg', 'kg'],
  ['kilo', 'kg'],
  ['kilos', 'kg'],
  ['l', 'l'],
  ['litre', 'l'],
  ['litres', 'l'],
  ['liter', 'l'],
  ['liters', 'l'],
  ['leaf', 'leaf'],
  ['leaves', 'leaf'],
  ['feuille', 'leaf'],
  ['feuilles', 'leaf'],
  ['lb', 'lb'],
  ['lbs', 'lb'],
  ['pound', 'lb'],
  ['pounds', 'lb'],
  ['ml', 'ml'],
  ['oz', 'oz'],
  ['ounce', 'oz'],
  ['ounces', 'oz'],
  ['pinch', 'pinch'],
  ['pinches', 'pinch'],
  ['pincee', 'pinch'],
  ['pincees', 'pinch'],
  ['sprig', 'sprig'],
  ['sprigs', 'sprig'],
  ['brin', 'sprig'],
  ['brins', 'sprig'],
  ['tbsp', 'tbsp'],
  ['tablespoon', 'tbsp'],
  ['tablespoons', 'tbsp'],
  ['cs', 'tbsp'],
  ['cas', 'tbsp'],
  ['c. a s.', 'tbsp'],
  ['c.a.s.', 'tbsp'],
  ['c.a.s', 'tbsp'],
  ['c. a soupe', 'tbsp'],
  ['cuillere a soupe', 'tbsp'],
  ['cuilleres a soupe', 'tbsp'],
  ['tsp', 'tsp'],
  ['teaspoon', 'tsp'],
  ['teaspoons', 'tsp'],
  ['cc', 'tsp'],
  ['cac', 'tsp'],
  ['c. a c.', 'tsp'],
  ['c.a.c.', 'tsp'],
  ['c.a.c', 'tsp'],
  ['c. a cafe', 'tsp'],
  ['cuillere a cafe', 'tsp'],
  ['cuilleres a cafe', 'tsp'],
];

// "200", "1,5", "1/2", "1 1/2" (checked by parseAmount), "½"; spaces after it included.
export const AMOUNT_PATTERN = /^(?:\d[\d\s/.,]*|[¼½¾]\s*)/;

// A list bullet: "-", "•", "o "…
const BULLET_PATTERN = /^\s*(?:[-–—•·*▪◦]|o(?=\s))\s*/;

// "de", "d'", "of" between a quantity and the ingredient: "200 g de farine", "2 cups of milk".
const LINK_WORD_PATTERN = /^(?:de\s+|d['’]\s*|of\s+)/i;

const UNICODE_FRACTIONS: Readonly<Record<string, string>> = { '½': '1/2', '¼': '1/4', '¾': '3/4' };

// A line that goes on with the name above it: "de beurre", "of milk", or a lowercase word
// without a quantity ("bon"). A new ingredient starts with a quantity, a bullet or a capital.
export function isNameContinuation(text: string): boolean {
  return LINK_WORD_PATTERN.test(text) || (/^\p{Ll}/u.test(text) && !AMOUNT_PATTERN.test(text));
}

// "200 g de farine" -> farine, 200 g; "Sel" -> Sel, no quantity; undefined when no name is left.
export function readIngredientLine(text: string): ScannedIngredient | undefined {
  // Composed accents ("é" as one character): matchUnit counts characters on an accent-free copy.
  let rest = cleanName(text.normalize('NFC').replace(BULLET_PATTERN, ''));
  const amountMatch = AMOUNT_PATTERN.exec(rest);
  const amountText = amountMatch?.[0].trim();
  const amount =
    amountText === undefined ? undefined : parseAmount(UNICODE_FRACTIONS[amountText] ?? amountText);
  let unit: undefined | Unit;
  if (amountMatch) {
    rest = rest.slice(amountMatch[0].length);
    const unitMatch = matchUnit(rest);
    if (unitMatch) {
      unit = unitMatch.unit;
      rest = rest.slice(unitMatch.length).trimStart();
    }
    rest = rest.replace(LINK_WORD_PATTERN, '');
  }
  const name = stripColon(cleanName(rest.replace(/^[.,;:]+\s*/, '')));
  if (!/\p{L}/u.test(name)) {
    return undefined;
  }
  if (amount === undefined) {
    // "2 x" misread, "0 g": the line is kept whole as the name, without a quantity.
    return { name: amountMatch ? cleanName(text.replace(BULLET_PATTERN, '')) : name };
  }
  return { name, quantity: unit === undefined ? { amount } : { amount, unit } };
}

// "Ingrédients :" -> "Ingrédients".
export function stripColon(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(':') ? trimmed.slice(0, -1).trimEnd() : trimmed;
}

// The unit at the start of the text, followed by a space, a dot or the end ("200 gr." / "200 g").
function matchUnit(text: string): Readonly<{ length: number; unit: Unit }> | undefined {
  const key = toSearchText(text);
  const isWordStart = (candidate: string) => {
    const next = key.charAt(candidate.length);
    return (
      key.startsWith(candidate) &&
      (next === '' || next === ' ' || next === '.' || candidate.endsWith('.'))
    );
  };
  const [alias, unit] = UNIT_ALIAS_LIST.find(([candidate]) => isWordStart(candidate)) ?? [];
  if (alias === undefined || unit === undefined) {
    return undefined;
  }
  // toSearchText keeps one character per character here (accents dropped, case lowered).
  return { length: key.charAt(alias.length) === '.' ? alias.length + 1 : alias.length, unit };
}
