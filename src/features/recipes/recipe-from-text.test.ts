import type { ScannedBlock } from './recipe-from-text';
import { parseScannedRecipe, readIngredientLine, readRecipeText } from './recipe-from-text';

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

    it('reads nothing from text that is not a recipe', () => {
      expect(parseScannedRecipe(undefined)).toBeUndefined();
      expect(parseScannedRecipe('{')).toBeUndefined();
      expect(parseScannedRecipe('"soup"')).toBeUndefined();
      expect(parseScannedRecipe('{"title":"Soup"}')).toBeUndefined();
    });
  });

  describe('readRecipeText', () => {
    it('reads the title, the ingredients and the instructions of a French page', () => {
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
          'Pour 4 personnes',
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

    it('takes the largest of the first lines as the title when there is no ingredients heading', () => {
      expect(
        readRecipeText([
          block(['Page 12']),
          block(['Tarte aux pommes'], 36),
          block(['Bon appétit']),
        ]),
      ).toStrictEqual({
        ingredientList: [],
        instructions: 'Page 12\n\nBon appétit',
        title: 'Tarte aux pommes',
      });
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
