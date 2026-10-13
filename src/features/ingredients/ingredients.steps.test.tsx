import { fireEvent, screen } from '@testing-library/react-native';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { DatabaseConnection } from '@/db/types';
import { saveRecipe } from '@/features/recipes/db/recipe-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { findOrCreateIngredient } from './db/ingredient-queries';
import { IngredientsScreen } from './ingredients-screen';

const feature = loadFeature('./ingredients.feature', { loadRelativePath: true });

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  const theIngredientListIsOpen = async () => {
    await renderWithDatabase(<IngredientsScreen />, connection);
  };

  const addTheIngredient = async (name: string) => {
    await fireEvent.changeText(screen.getByLabelText('Search or add an ingredient'), name);
    await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
  };

  test('An ingredient is added once, whatever its case', ({ and, given, then, when }) => {
    given('the ingredient list is open', theIngredientListIsOpen);
    when(/^I add the ingredient "(.*)"$/, addTheIngredient);
    and(/^I add the ingredient "(.*)"$/, addTheIngredient);
    then(/^I am told that "(.*)" already exists$/, (name: string) => {
      expect(screen.getByText(`“${name}” already exists.`)).toBeOnTheScreen();
    });
    and(/^the list contains only "(.*)"$/, async (name: string) => {
      await fireEvent.changeText(screen.getByLabelText('Search or add an ingredient'), '');

      expect(screen.getAllByRole('button', { name: /^Rename / })).toHaveLength(1);
      expect(screen.getByText(name)).toBeOnTheScreen();
    });
  });

  test('An ingredient used by a recipe cannot be deleted', ({ and, given, then }) => {
    given(/^the recipe "(.*)" made with "(.*)"$/, (title: string, ingredientName: string) => {
      const ingredientId = findOrCreateIngredient(connection.db, ingredientName).id;
      saveRecipe(connection.db, {
        ingredientIdList: [ingredientId],
        instructions: '',
        season: 'both',
        title,
      });
    });
    and('the ingredient list is open', theIngredientListIsOpen);
    then(/^"(.*)" is used in 1 recipe$/, () => {
      expect(screen.getByText('Used in 1 recipe')).toBeOnTheScreen();
    });
    and(/^"(.*)" cannot be deleted$/, (name: string) => {
      expect(screen.queryByRole('button', { name: `Delete ${name}` })).not.toBeOnTheScreen();
    });
  });
});
