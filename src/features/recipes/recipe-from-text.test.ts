import type { ScannedBlock } from './scanned-recipe';
import { readIngredientLine } from './ingredient-line';
import { readRecipeText } from './recipe-from-text';
import { parseScannedRecipe } from './scanned-recipe';

// A block of lines in body text, or in a larger print.
function block(lineList: readonly string[], height = 20): ScannedBlock {
  return { lineList: lineList.map((text) => ({ height, text })) };
}

describe('recipe-from-text', () => {
  describe('readIngredientLine', () => {
    it('reads an amount, a unit and the name, without the link word', () => {
      expect(readIngredientLine('200 g de farine')).toStrictEqual({
        name: 'farine',
        quantity: { amount: 200, unit: 'g' },
      });
      expect(readIngredientLine('2 cups of milk')).toStrictEqual({
        name: 'milk',
        quantity: { amount: 2, unit: 'cup' },
      });
      expect(readIngredientLine("2 gousses d'ail")).toStrictEqual({
        name: 'ail',
        quantity: { amount: 2, unit: 'clove' },
      });
    });

    it('reads herbs counted in sprigs and leaves', () => {
      expect(readIngredientLine('3 brins de thym')).toStrictEqual({
        name: 'thym',
        quantity: { amount: 3, unit: 'sprig' },
      });
      expect(readIngredientLine('2 feuilles de laurier')).toStrictEqual({
        name: 'laurier',
        quantity: { amount: 2, unit: 'leaf' },
      });
      expect(readIngredientLine('4 basil leaves')).toStrictEqual({
        name: 'basil leaves',
        quantity: { amount: 4 },
      });
      expect(readIngredientLine('1 sprig of rosemary')).toStrictEqual({
        name: 'rosemary',
        quantity: { amount: 1, unit: 'sprig' },
      });
    });

    it('reads a unit stuck to the amount, abbreviated or in words', () => {
      expect(readIngredientLine('500g pommes de terre')).toStrictEqual({
        name: 'pommes de terre',
        quantity: { amount: 500, unit: 'g' },
      });
      expect(readIngredientLine("1 c. à soupe d'huile d'olive")).toStrictEqual({
        name: "huile d'olive",
        quantity: { amount: 1, unit: 'tbsp' },
      });
      expect(readIngredientLine('1 cuillère à café de sel')).toStrictEqual({
        name: 'sel',
        quantity: { amount: 1, unit: 'tsp' },
      });
      expect(readIngredientLine('25 cl de crème')).toStrictEqual({
        name: 'crème',
        quantity: { amount: 25, unit: 'cl' },
      });
      expect(readIngredientLine('8 fl oz cream')).toStrictEqual({
        name: 'cream',
        quantity: { amount: 8, unit: 'fl_oz' },
      });
    });

    it('reads decimals and fractions', () => {
      expect(readIngredientLine('1,5 kg de bœuf')?.quantity).toStrictEqual({
        amount: 1.5,
        unit: 'kg',
      });
      expect(readIngredientLine('1 1/2 cups flour')?.quantity).toStrictEqual({
        amount: 1.5,
        unit: 'cup',
      });
      expect(readIngredientLine('½ lb butter')?.quantity).toStrictEqual({
        amount: 0.5,
        unit: 'lb',
      });
    });

    it('reads a number of pieces, and a name without quantity', () => {
      expect(readIngredientLine('3 poireaux')).toStrictEqual({
        name: 'poireaux',
        quantity: { amount: 3 },
      });
      expect(readIngredientLine('Sel, poivre')).toStrictEqual({ name: 'Sel, poivre' });
    });

    it('does not take the start of a word for a unit', () => {
      expect(readIngredientLine('2 limes')).toStrictEqual({
        name: 'limes',
        quantity: { amount: 2 },
      });
      expect(readIngredientLine('4 gros oignons')).toStrictEqual({
        name: 'gros oignons',
        quantity: { amount: 4 },
      });
    });

    it('drops list bullets', () => {
      expect(readIngredientLine('- 2 eggs')).toStrictEqual({
        name: 'eggs',
        quantity: { amount: 2 },
      });
      expect(readIngredientLine('• Persil')).toStrictEqual({ name: 'Persil' });
    });

    it('keeps the whole line, without a quantity, when the amount is not one', () => {
      expect(readIngredientLine('0 g sucre')).toStrictEqual({ name: '0 g sucre' });
    });

    it('reads nothing from a line without letters', () => {
      expect(readIngredientLine('- 12')).toBeUndefined();
      expect(readIngredientLine('•')).toBeUndefined();
    });
  });

  describe('parseScannedRecipe', () => {
    it('reads back a recipe passed as text, keeping only what is usable', () => {
      expect(
        parseScannedRecipe(
          JSON.stringify({
            ingredientList: [
              { name: 'leeks', quantity: { amount: 2 } },
              { name: 'flour', quantity: { amount: 200, unit: 'g' } },
              { name: 'salt', quantity: { amount: -1 } },
              { name: ' ' },
              'egg',
            ],
            instructions: 'Cook.',
            title: 'Soup',
          }),
        ),
      ).toStrictEqual({
        ingredientList: [
          { name: 'leeks', quantity: { amount: 2 } },
          { name: 'flour', quantity: { amount: 200, unit: 'g' } },
          { name: 'salt' },
        ],
        instructions: 'Cook.',
        title: 'Soup',
      });
    });

    it('keeps no more than a photo gives, nor longer texts than a sync keeps', () => {
      const recipe = parseScannedRecipe(
        JSON.stringify({
          ingredientList: [
            { name: 'x'.repeat(201) },
            ...Array.from({ length: 1000 }, (_, index) => ({ name: `ingredient ${index}` })),
          ],
          instructions: 'Stir. '.repeat(30_000),
          title: 'Soup '.repeat(200),
        }),
      );

      // The first item, a name too long, is left out of the first 40.
      expect(recipe?.ingredientList).toHaveLength(39);
      expect(recipe?.instructions).toHaveLength(100_000);
      expect(recipe?.title).toHaveLength(500);
    });

    it('reads nothing from text that is not a recipe', () => {
      expect(parseScannedRecipe(undefined)).toBeUndefined();
      expect(parseScannedRecipe('{')).toBeUndefined();
      expect(parseScannedRecipe('"soup"')).toBeUndefined();
      expect(parseScannedRecipe('{"title":"Soup"}')).toBeUndefined();
    });
  });

  describe('readRecipeText', () => {
    it('reads the title, the ingredients and the instructions of a French page, without the servings', () => {
      expect(
        readRecipeText([
          block(['Soupe de poireaux'], 40),
          block(['Pour 4 personnes']),
          block(['Ingrédients :']),
          block(['3 poireaux', '500 g de pommes de terre', '1 l de bouillon', 'Sel']),
          block(['Préparation']),
          block(['Laver et couper les poireaux en', 'rondelles. Éplucher les pommes de terre.']),
          block(['Cuire 30 minutes dans le bouillon, puis mixer.']),
        ]),
      ).toStrictEqual({
        ingredientList: [
          { name: 'poireaux', quantity: { amount: 3 } },
          { name: 'pommes de terre', quantity: { amount: 500, unit: 'g' } },
          { name: 'bouillon', quantity: { amount: 1, unit: 'l' } },
          { name: 'Sel' },
        ],
        instructions: [
          'Laver et couper les poireaux en rondelles. Éplucher les pommes de terre.',
          'Cuire 30 minutes dans le bouillon, puis mixer.',
        ].join('\n\n'),
        title: 'Soupe de poireaux',
      });
    });

    it('reads an English page whose heading has a note and whose steps are numbered', () => {
      expect(
        readRecipeText([
          block(['Pancakes'], 30),
          block(['Ingredients (serves 4)', '2 eggs', '250 ml milk']),
          block(['Method']),
          block(['1. Whisk the eggs and the milk.', '2. Cook in a hot pan.']),
        ]),
      ).toStrictEqual({
        ingredientList: [
          { name: 'eggs', quantity: { amount: 2 } },
          { name: 'milk', quantity: { amount: 250, unit: 'ml' } },
        ],
        instructions: '1. Whisk the eggs and the milk.\n\n2. Cook in a hot pan.',
        title: 'Pancakes',
      });
    });

    it('ends the ingredients at a sentence when no heading does', () => {
      expect(
        readRecipeText([
          block(['Omelette'], 30),
          block(['Ingredients', '3 eggs', 'Beat the eggs with a fork, then cook them in butter.']),
        ]),
      ).toStrictEqual({
        ingredientList: [{ name: 'eggs', quantity: { amount: 3 } }],
        instructions: 'Beat the eggs with a fork, then cook them in butter.',
        title: 'Omelette',
      });
    });

    it('keeps each ingredient once', () => {
      expect(
        readRecipeText([block(['Ingredients', '2 eggs', '1 egg', '2 Eggs'])]).ingredientList,
      ).toStrictEqual([
        { name: 'eggs', quantity: { amount: 2 } },
        { name: 'egg', quantity: { amount: 1 } },
      ]);
    });

    it('finds the title of a level page (a PDF’s) when it is only a little larger than a heading', () => {
      const blockList = [
        block(['Tarte aux pommes'], 64),
        block(['Ingrédients'], 56),
        block(['4 pommes']),
      ];

      expect(readRecipeText(blockList).title).toBe('');
      expect(readRecipeText(blockList, true).title).toBe('Tarte aux pommes');
    });

    it('takes the ingredients from the short lines before the steps when there is no heading', () => {
      expect(
        readRecipeText([
          block(['Tarte aux pommes'], 36),
          block(['4 pommes']),
          block(['1 pâte brisée']),
          block(['Préparation']),
          block(['Étaler la pâte, couper les pommes en lamelles et les poser dessus.']),
        ]),
      ).toStrictEqual({
        ingredientList: [
          { name: 'pommes', quantity: { amount: 4 } },
          { name: 'pâte brisée', quantity: { amount: 1 } },
        ],
        instructions: 'Étaler la pâte, couper les pommes en lamelles et les poser dessus.',
        title: 'Tarte aux pommes',
      });
    });

    it('keeps sentences and what follows the first step as instructions without a heading', () => {
      expect(
        readRecipeText([
          block(['A quick soup for cold evenings, ready in no time at all.']),
          block(['2 leeks']),
          block(['Step 1']),
          block(['Cook the leeks.']),
          block(['Serve hot']),
        ]),
      ).toStrictEqual({
        ingredientList: [{ name: 'leeks', quantity: { amount: 2 } }],
        instructions: [
          'A quick soup for cold evenings, ready in no time at all.',
          '1. Cook the leeks.',
          'Serve hot',
        ].join('\n\n'),
        title: '',
      });
    });

    it('reads a recipe website: menu, ingredient cards, step numbers and times, in any order', () => {
      // Where each text is, as on a photo of the screen: (left, top), letters 20 high (40 for the
      // headings); a card's quantity and name are one block, or two ("4" / "onions").
      const at = (lineList: readonly string[], left: number, top: number, height = 20) => ({
        frame: { bottom: top + lineList.length * (height + 5), left, right: left + 200, top },
        lineList: lineList.map((text) => ({ height, text })),
      });

      expect(
        readRecipeText([
          at(['STEP 2'], 0, 700),
          at(['Peel the onions, then cook them slowly in the butter for a long time.'], 0, 530),
          at(['What shall we eat tonight?'], 0, 0, 30),
          at(['Cooking time: 1 h 30'], 0, 410),
          at(['pepper'], 300, 205),
          at(['Ingredients'], 0, 100, 40),
          at(['Veggie version'], 600, 100),
          at(['4 people'], 0, 160),
          at(['100 g', 'of butter'], 0, 200),
          at(['4'], 600, 200),
          at(['onions'], 600, 230),
          at(['Method'], 0, 350, 40),
          at(['STEP 1'], 0, 480),
          at(['Add a little water and serve.'], 0, 750),
        ]),
      ).toStrictEqual({
        ingredientList: [
          { name: 'butter', quantity: { amount: 100, unit: 'g' } },
          { name: 'pepper' },
          { name: 'onions', quantity: { amount: 4 } },
        ],
        instructions: [
          '1. Peel the onions, then cook them slowly in the butter for a long time.',
          '2. Add a little water and serve.',
        ].join('\n\n'),
        title: '',
      });
    });

    it('never gives a quantity to the next card', () => {
      // A lone "2" with nothing right under it, then another card on the next row.
      const at = (text: string, left: number, top: number) => ({
        frame: { bottom: top + 20, left, right: left + 100, top },
        lineList: [{ height: 20, text }],
      });

      expect(
        readRecipeText([at('Ingredients', 0, 0), at('2', 300, 100), at('salt', 0, 300)])
          .ingredientList,
      ).toStrictEqual([{ name: 'salt' }]);
    });

    it('reads an empty page as an empty recipe', () => {
      expect(readRecipeText([block(['  ', ''])])).toStrictEqual({
        ingredientList: [],
        instructions: '',
        title: '',
      });
    });
  });
});
