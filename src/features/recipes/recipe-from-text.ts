import type { Quantity, Unit } from '@/lib/units';
import { cleanName, toNameKey, toSearchText } from '@/lib/text';
import { parseAmount, toQuantity } from '@/lib/units';
import { toReadingOrder } from './page-layout';

// A recipe read from a photo (text recognized on the phone): a draft the user checks in the recipe
// form before saving. Recipe pages vary a lot, so this guesses, in English and French, once the
// blocks of text are in reading order (page-layout.ts):
// - the title: the largest text before the ingredients, clearly larger than their heading (a
//   website's menu isn't a title);
// - the ingredients: the lines under an "Ingredients" heading, each with its quantity when it
//   starts with one ("200 g de farine", "2 tbsp olive oil", "3 poireaux"); a quantity and its name
//   on two lines, as on recipe websites' ingredient cards ("100 g" / "de beurre"), are one.
//   Without that heading (a cropped page, a book), the short blocks before the steps;
// - the instructions: what follows, one paragraph per block of text; "Étape 2" numbers its step.
// What comes before the ingredients' heading (menus, servings) is left out.

// A block of text (a paragraph, a list, a card) as the text recognition reads it, and where it is
// on the page (any unit; without it, the blocks are taken in the given order).
export type ScannedBlock = Readonly<{ frame?: ScannedFrame; lineList: readonly ScannedLine[] }>;

export type ScannedFrame = Readonly<{ bottom: number; left: number; right: number; top: number }>;

export type ScannedIngredient = Readonly<{ name: string; quantity?: Quantity }>;

// A line of text and the height of its letters (any unit: only compared with the other lines).
export type ScannedLine = Readonly<{ height: number; text: string }>;

export type ScannedRecipe = Readonly<{
  ingredientList: readonly ScannedIngredient[];
  instructions: string;
  title: string;
}>;

type Line = Readonly<{ blockIndex: number; row: number }> & ScannedLine;

// 'other': left out (before the ingredients' heading, servings).
type LineKind = 'heading' | 'ingredient' | 'instruction' | 'other' | 'title';

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
// Longest texts a recipe passed as text keeps, as the sync server accepts them (server/migrations).
const MAX_PASSED_NAME_LENGTH = 200;
const MAX_PASSED_TITLE_LENGTH = 500;
const MAX_PASSED_INSTRUCTIONS_LENGTH = 100_000;
// The title is looked for among the first lines when there is no ingredients heading.
const TITLE_LOOKUP_LINES = 5;
// A title is at least this much larger than the ingredients' heading, or, without a heading, than
// most of the text (a slanted photo makes some words look a third larger).
const TITLE_HEADING_RATIO = 1.25;
const TITLE_TEXT_RATIO = 1.5;

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
const AMOUNT_PATTERN = /^(?:\d[\d\s/.,]*|[¼½¾]\s*)/;
// A list bullet: "-", "•", "o "…
const BULLET_PATTERN = /^\s*(?:[-–—•·*▪◦]|o(?=\s))\s*/;
// "de", "d'", "of" between a quantity and the ingredient: "200 g de farine", "2 cups of milk".
const LINK_WORD_PATTERN = /^(?:de\s+|d['’]\s*|of\s+)/i;
// "4 personnes", "Serves 4": the servings, not an ingredient (the word is one of SERVINGS_WORD_SET).
const SERVINGS_PATTERN = /^(?:pour\s|serves\s)?\d+\s*(\p{L}*)\.?$/iu;
const SERVINGS_WORD_SET = new Set([
  'parts',
  'people',
  'pers',
  'personne',
  'personnes',
  'portions',
  'servings',
]);
// The words of a recipe's times, without accents: labels and units ("Cuisson : 1 h 30").
const TIMING_WORD_SET = new Set([
  'cook',
  'cooking',
  'cuisson',
  'h',
  'heure',
  'heures',
  'hour',
  'hours',
  'min',
  'minute',
  'minutes',
  'mn',
  'prep',
  'preparation',
  'repos',
  'rest',
  'temps',
  'time',
  'total',
]);
// A duration in one word: "1h", "1h30", "45min".
const DURATION_WORD_PATTERN = /^\d+(?:h|min|mn)\d*$/;
// A step starting a new line: "1.", "2)", "Étape 3".
const STEP_START_PATTERN = /^(?:\d+[.)]\s|(?:étape|etape|step)\s?\d)/i;
// A step's number alone on its line, as recipe websites write it: "ÉTAPE 2".
const STEP_NUMBER_PATTERN = /^(?:étape|etape|step)\s?(\d+)$/i;
const UNICODE_FRACTIONS: Readonly<Record<string, string>> = { '½': '1/2', '¼': '1/4', '¾': '3/4' };

// A recipe passed as text (the new-recipe form's `scanned` parameter, from useNewRecipe), checked
// field by field; undefined when it isn't one. Any app can open the form with one (a
// dishescook:// link): no more ingredients than a photo gives, nor longer texts than a sync keeps.
export function parseScannedRecipe(json: string | undefined): ScannedRecipe | undefined {
  try {
    const value: unknown = json === undefined ? undefined : JSON.parse(json);
    if (!isRecord(value) || !Array.isArray(value.ingredientList)) {
      return undefined;
    }
    return {
      ingredientList: value.ingredientList
        .slice(0, MAX_INGREDIENTS)
        .flatMap((item: unknown) => toScannedIngredient(item)),
      instructions:
        typeof value.instructions === 'string'
          ? value.instructions.slice(0, MAX_PASSED_INSTRUCTIONS_LENGTH)
          : '',
      title: typeof value.title === 'string' ? value.title.slice(0, MAX_PASSED_TITLE_LENGTH) : '',
    };
  } catch {
    return undefined;
  }
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

// The recipe read from a page's blocks of text; a field is empty when nothing was found for it.
export function readRecipeText(blockList: readonly ScannedBlock[]): ScannedRecipe {
  const lineList = toReadingOrder(attachQuantities(blockList)).flatMap((block, blockIndex) =>
    block.lineList
      .map((line) => ({ ...line, blockIndex, row: block.row, text: cleanName(line.text) }))
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

// A one-line block that is only a quantity ("4", "100 g": no name) goes on top of the block right
// under it, as on recipe websites' cards where the quantity is above the name and read apart.
// Without positions, the blocks stay as they are.
function attachQuantities(blockList: readonly ScannedBlock[]): ScannedBlock[] {
  const isQuantityOnly = (block: ScannedBlock) => {
    const [line, ...restList] = block.lineList;
    return (
      line !== undefined &&
      restList.length === 0 &&
      AMOUNT_PATTERN.test(cleanName(line.text)) &&
      readIngredientLine(line.text) === undefined
    );
  };
  const quantityList = blockList.filter((block) => block.frame && isQuantityOnly(block));
  const attachedSet = new Set<ScannedBlock>();
  const nameList = blockList.map((block) => {
    const quantity = quantityList.find(
      (candidate) => !attachedSet.has(candidate) && isRightAbove(candidate, block),
    );
    if (!quantity?.frame || !block.frame) {
      return block;
    }
    attachedSet.add(quantity);
    return {
      frame: { ...block.frame, top: quantity.frame.top },
      lineList: [...quantity.lineList, ...block.lineList],
    };
  });
  return nameList.filter((block) => !attachedSet.has(block));
}

// The largest line before the ingredients (or among the first lines), the first one on a tie; it
// must be clearly larger than the ingredients' heading (or than most of the text).
function findTitleIndex(lineList: readonly Line[], ingredientHeadingIndex: number): number {
  const heading = lineList[ingredientHeadingIndex];
  const end = heading ? ingredientHeadingIndex : TITLE_LOOKUP_LINES;
  const minHeight = heading
    ? heading.height * TITLE_HEADING_RATIO
    : medianHeight(lineList) * TITLE_TEXT_RATIO;
  const candidateList = lineList.slice(0, end);
  let titleIndex = -1;
  for (const [index, line] of candidateList.entries()) {
    const isLarger = line.height > Math.max(candidateList[titleIndex]?.height ?? 0, minHeight);
    titleIndex = isLarger && !isInstructionHeading(line.text) ? index : titleIndex;
  }
  return titleIndex;
}

function headingKey(text: string): string {
  return toSearchText(stripColon(text));
}

// A line under the ingredients' heading: an ingredient, unless it's the servings or beside the
// heading (a button such as "Version veggie": in another block on the heading's row).
function ingredientLineKind(line: Line, heading: Line | undefined): LineKind {
  const isBesideHeading = line.row === heading?.row && line.blockIndex !== heading.blockIndex;
  return isBesideHeading || isServings(line.text) ? 'other' : 'ingredient';
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

// A line that goes on with the name above it: "de beurre", "of milk", or a lowercase word
// without a quantity ("bon"). A new ingredient starts with a quantity, a bullet or a capital.
function isNameContinuation(text: string): boolean {
  return LINK_WORD_PATTERN.test(text) || (/^\p{Ll}/u.test(text) && !AMOUNT_PATTERN.test(text));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Whether `upper` is right above `lower`: overlapping columns, with less than a line between them.
function isRightAbove(upper: ScannedBlock, lower: ScannedBlock): boolean {
  if (upper === lower || !upper.frame || !lower.frame) {
    return false;
  }
  const lineHeight = upper.lineList[0]?.height ?? 0;
  const gap = lower.frame.top - upper.frame.bottom;
  const isSameColumn = upper.frame.left < lower.frame.right && lower.frame.left < upper.frame.right;
  return gap < lineHeight && gap >= -lineHeight / 2 && isSameColumn;
}

function isServings(text: string): boolean {
  const word = SERVINGS_PATTERN.exec(text)?.[1];
  return word !== undefined && SERVINGS_WORD_SET.has(word.toLowerCase());
}

// "Cuisson : 4h", "Temps total: 5h Repos:", "1h": times, not a step (the form has no field for
// them yet).
function isTiming(text: string): boolean {
  const wordList = toSearchText(text.replaceAll(/[:.,-]/g, ' '))
    .split(' ')
    .filter(Boolean);
  const isTimingWord = (word: string) =>
    TIMING_WORD_SET.has(word) || DURATION_WORD_PATTERN.test(word);
  return (
    wordList.some((word) => isTimingWord(word)) &&
    wordList.every((word) => isTimingWord(word) || /^\d+$/.test(word))
  );
}

// One text per ingredient. In a block (a card), a line without a name joins the next one ("100 g"
// + "de beurre", "4" + "oignons"), and so does a line followed by "de…" / "of…" ("1 bouteille" +
// "de vin rouge"); the lowercase lines after it end the name ("assez" + "bon"). Across blocks
// nothing joins: the next block may be another card (a quantity above its name is in the name's
// block already, see attachQuantities).
function joinIngredientLines(lineList: readonly Line[]): string[] {
  const textList: string[] = [];
  let pending: Line | undefined;
  for (const line of lineList) {
    const isContinued =
      pending?.blockIndex === line.blockIndex &&
      (readIngredientLine(pending.text) === undefined || isNameContinuation(line.text));
    const text = pending && isContinued ? `${pending.text} ${line.text}` : line.text;
    if (pending && !isContinued) {
      textList.push(pending.text);
    }
    pending = { ...line, text };
  }
  return pending ? [...textList, pending.text] : textList;
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

// The height of most of the text: the middle one.
function medianHeight(lineList: readonly Line[]): number {
  const heightList = lineList.map(({ height }) => height).sort((first, second) => first - second);
  return heightList[Math.floor(heightList.length / 2)] ?? 0;
}

// "ÉTAPE 2" alone, then its text: "2. Its text" (a Markdown numbered step).
function numberSteps(paragraphList: readonly string[]): string[] {
  const numberedList: string[] = [];
  let stepNumber: string | undefined;
  for (const paragraph of paragraphList) {
    const number = STEP_NUMBER_PATTERN.exec(paragraph)?.[1];
    if (number === undefined) {
      numberedList.push(stepNumber === undefined ? paragraph : `${stepNumber}. ${paragraph}`);
    }
    stepNumber = number;
  }
  return stepNumber === undefined ? numberedList : [...numberedList, `${stepNumber}.`];
}

// Each ingredient once, at most MAX_INGREDIENTS.
function readIngredientLines(lineList: readonly Line[]): ScannedIngredient[] {
  const byNameKey = new Map<string, ScannedIngredient>();
  for (const text of joinIngredientLines(lineList)) {
    const ingredient = readIngredientLine(text);
    const nameKey = ingredient && toNameKey(ingredient.name);
    if (nameKey && !byNameKey.has(nameKey)) {
      byNameKey.set(nameKey, ingredient);
    }
  }
  return [...byNameKey.values()].slice(0, MAX_INGREDIENTS);
}

// "Ingrédients :" -> "Ingrédients".
function stripColon(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(':') ? trimmed.slice(0, -1).trimEnd() : trimmed;
}

// No ingredients heading (a cropped page, a book): before the steps (their heading or "Étape 1"),
// the blocks of short lines are the ingredients ("100 g / de beurre", "poivre"); a block with a
// sentence is instructions.
function toKindsWithoutHeading(lineList: readonly Line[], titleIndex: number): LineKind[] {
  const stepsIndex = lineList.findIndex(
    ({ text }) => isInstructionHeading(text) || STEP_START_PATTERN.test(text),
  );
  const sentenceBlockSet = new Set(
    lineList
      .filter(({ text }) => wordCount(text) > MAX_INGREDIENT_WORDS)
      .map(({ blockIndex }) => blockIndex),
  );
  return lineList.map((line, index): LineKind => {
    if (index === titleIndex) {
      return 'title';
    }
    if (isInstructionHeading(line.text)) {
      return 'heading';
    }
    if (isServings(line.text) || isTiming(line.text)) {
      return 'other';
    }
    const isBeforeSteps = stepsIndex === -1 || index < stepsIndex;
    return isBeforeSteps && !sentenceBlockSet.has(line.blockIndex) ? 'ingredient' : 'instruction';
  });
}

// What each line is: the title, a heading, then the ingredients under their heading, until the
// instructions' heading or a sentence; everything else is instructions.
function toLineKinds(
  lineList: readonly Line[],
  ingredientHeadingIndex: number,
  titleIndex: number,
): LineKind[] {
  if (ingredientHeadingIndex === -1) {
    return toKindsWithoutHeading(lineList, titleIndex);
  }
  let section: 'ingredients' | 'instructions' | 'top' = 'top';
  return lineList.map((line, index): LineKind => {
    if (index === titleIndex) {
      return 'title';
    }
    if (index === ingredientHeadingIndex || isInstructionHeading(line.text)) {
      section = index === ingredientHeadingIndex ? 'ingredients' : 'instructions';
      return 'heading';
    }
    if (section === 'ingredients' && wordCount(line.text) > MAX_INGREDIENT_WORDS) {
      section = 'instructions';
    }
    if (section === 'ingredients') {
      return ingredientLineKind(line, lineList[ingredientHeadingIndex]);
    }
    if (section === 'instructions' && isTiming(line.text)) {
      return 'other';
    }
    // Before the ingredients' heading: a website's menu, the servings…
    return section === 'top' && ingredientHeadingIndex !== -1 ? 'other' : 'instruction';
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
  return numberSteps(paragraphList).join('\n\n');
}

// An ingredient of a parsed recipe: kept when it has a name, its quantity when usable.
function toScannedIngredient(value: unknown): ScannedIngredient[] {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !cleanName(value.name) ||
    value.name.length > MAX_PASSED_NAME_LENGTH
  ) {
    return [];
  }
  const quantity = isRecord(value.quantity)
    ? toQuantity(value.quantity.amount, value.quantity.unit)
    : undefined;
  return [quantity ? { name: value.name, quantity } : { name: value.name }];
}

function wordCount(text: string): number {
  return text.split(' ').length;
}
