import type { Quantity, Unit } from '@/lib/units';
import { cleanName, toNameKey, toSearchText } from '@/lib/text';
import { parseAmount } from '@/lib/units';

// A recipe read from a photo (text recognized on the phone): a draft the user checks in the recipe
// form before saving. Recipe pages vary a lot, so this guesses, in English and French:
// - the title: the largest text before the ingredients;
// - the ingredients: the lines under an "Ingredients" heading, each with its quantity when it
//   starts with one ("200 g de farine", "2 tbsp olive oil", "3 poireaux");
// - the instructions: the rest, one paragraph per block of text.

// A block of text (a paragraph, a list) as the text recognition reads it, in reading order.
export type ScannedBlock = Readonly<{ lineList: readonly ScannedLine[] }>;

export type ScannedIngredient = Readonly<{ name: string; quantity?: Quantity }>;

// A line of text and the height of its letters (any unit: only compared with the other lines).
export type ScannedLine = Readonly<{ height: number; text: string }>;

export type ScannedRecipe = Readonly<{
  ingredientList: readonly ScannedIngredient[];
  instructions: string;
  title: string;
}>;

type Line = Readonly<{ blockIndex: number }> & ScannedLine;

type LineKind = 'heading' | 'ingredient' | 'instruction' | 'title';

// Headings, compared without case, accents nor a trailing colon.
const INGREDIENT_HEADING_LIST = ['ingredient', 'ingredients'];
const INSTRUCTION_HEADING_SET = new Set([
  'deroulement',
  'directions',
  'etapes',
  'instructions',
  'method',
  'preparation',
  'realisation',
  'recette',
  'steps',
]);
// "Ingrédients (pour 4 personnes)": a heading followed by a short note.
const MAX_HEADING_LENGTH = 40;
// Ingredient lines are short: a sentence ends the list when no heading does.
const MAX_INGREDIENT_WORDS = 8;
// More lines are likely not ingredients (a misread page): the user adds the rest.
const MAX_INGREDIENTS = 40;
// The title is looked for among the first lines when there is no ingredients heading.
const TITLE_LOOKUP_LINES = 5;

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
const AMOUNT_PATTERN = /^(?:\d[\d\s/.,]*|[¼½¾]\s*)/;
// A list bullet: "-", "•", "o "…
const BULLET_PATTERN = /^\s*(?:[-–—•·*▪◦]|o(?=\s))\s*/;
// "de", "d'", "of" between a quantity and the ingredient: "200 g de farine", "2 cups of milk".
const LINK_WORD_PATTERN = /^(?:de\s+|d['’]\s*|of\s+)/i;
// A step starting a new line: "1.", "2)", "Étape 3".
const STEP_START_PATTERN = /^(?:\d+[.)]\s|(?:étape|etape|step)\s?\d)/i;
const UNICODE_FRACTIONS: Readonly<Record<string, string>> = { '½': '1/2', '¼': '1/4', '¾': '3/4' };

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

// The recipe read from a page's blocks of text; a field is empty when nothing was found for it.
export function readRecipeText(blockList: readonly ScannedBlock[]): ScannedRecipe {
  const lineList = blockList.flatMap((block, blockIndex) =>
    block.lineList
      .map((line) => ({ ...line, blockIndex, text: cleanName(line.text) }))
      .filter((line) => line.text !== ''),
  );
  const ingredientHeadingIndex = lineList.findIndex((line) => isIngredientHeading(line.text));
  const titleIndex = findTitleIndex(lineList, ingredientHeadingIndex);
  const kindList = toLineKinds(lineList, ingredientHeadingIndex, titleIndex);
  const linesOf = (kind: LineKind) => lineList.filter((_, index) => kindList[index] === kind);
  return {
    ingredientList: readIngredientLines(linesOf('ingredient')),
    instructions: toParagraphs(linesOf('instruction')),
    title: stripColon(lineList[titleIndex]?.text ?? ''),
  };
}

// The largest line before the ingredients (or among the first lines), the first one on a tie.
function findTitleIndex(lineList: readonly Line[], ingredientHeadingIndex: number): number {
  const end = ingredientHeadingIndex === -1 ? TITLE_LOOKUP_LINES : ingredientHeadingIndex;
  let titleIndex = -1;
  let titleHeight = 0;
  for (const [index, line] of lineList.slice(0, end).entries()) {
    if (line.height <= titleHeight || isInstructionHeading(line.text)) {
      continue;
    }

    titleIndex = index;
    titleHeight = line.height;
  }
  return titleIndex;
}

function headingKey(text: string): string {
  return toSearchText(stripColon(text));
}

function isIngredientHeading(text: string): boolean {
  const key = headingKey(text);
  return (
    key.length <= MAX_HEADING_LENGTH &&
    INGREDIENT_HEADING_LIST.some(
      (heading) =>
        key === heading || key.startsWith(`${heading} `) || key.startsWith(`${heading}(`),
    )
  );
}

function isInstructionHeading(text: string): boolean {
  return INSTRUCTION_HEADING_SET.has(headingKey(text));
}

// The unit at the start of the text, followed by a space, a dot or the end ("200 gr." / "200 g").
function matchUnit(text: string): Readonly<{ length: number; unit: Unit }> | undefined {
  const key = toSearchText(text);
  for (const [alias, unit] of UNIT_ALIAS_LIST) {
    if (!key.startsWith(alias)) {
      continue;
    }

    const next = key.charAt(alias.length);
    if (next === '' || next === ' ' || next === '.' || alias.endsWith('.')) {
      // toSearchText keeps one character per character here (accents dropped, case lowered).
      const length = next === '.' ? alias.length + 1 : alias.length;
      return { length, unit };
    }
  }
  return undefined;
}

// One ingredient per line, each name once, at most MAX_INGREDIENTS.
function readIngredientLines(lineList: readonly Line[]): ScannedIngredient[] {
  const ingredientList: ScannedIngredient[] = [];
  const nameKeySet = new Set<string>();
  for (const line of lineList) {
    const ingredient = readIngredientLine(line.text);
    const nameKey = ingredient && toNameKey(ingredient.name);
    if (!(nameKey && !nameKeySet.has(nameKey) && ingredientList.length < MAX_INGREDIENTS)) {
      continue;
    }

    nameKeySet.add(nameKey);
    ingredientList.push(ingredient);
  }
  return ingredientList;
}

// "Ingrédients :" -> "Ingrédients".
function stripColon(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(':') ? trimmed.slice(0, -1).trimEnd() : trimmed;
}

// What each line is: the title, a heading, then the ingredients under their heading, until the
// instructions' heading or a sentence; everything else is instructions.
function toLineKinds(
  lineList: readonly Line[],
  ingredientHeadingIndex: number,
  titleIndex: number,
): LineKind[] {
  let isInIngredients = false;
  return lineList.map((line, index) => {
    if (index === titleIndex) {
      return 'title';
    }
    if (index === ingredientHeadingIndex || isInstructionHeading(line.text)) {
      isInIngredients = index === ingredientHeadingIndex;
      return 'heading';
    }
    if (wordCount(line.text) > MAX_INGREDIENT_WORDS) {
      isInIngredients = false;
    }
    return isInIngredients ? 'ingredient' : 'instruction';
  });
}

// One paragraph per block of text, its lines joined; a numbered step starts a new line.
function toParagraphs(lineList: readonly Line[]): string {
  const paragraphList: string[] = [];
  let textList: string[] = [];
  let currentBlock: number | undefined;
  const flush = () => {
    if (textList.length > 0) {
      paragraphList.push(textList.join(' '));
    }
    textList = [];
  };
  for (const line of lineList) {
    if (line.blockIndex !== currentBlock || STEP_START_PATTERN.test(line.text)) {
      flush();
      currentBlock = line.blockIndex;
    }
    textList.push(line.text);
  }
  flush();
  return paragraphList.join('\n\n');
}

function wordCount(text: string): number {
  return text.split(' ').length;
}
