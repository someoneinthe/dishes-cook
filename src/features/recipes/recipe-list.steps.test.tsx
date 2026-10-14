import { fireEvent, screen } from '@testing-library/react-native';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { Course, Season } from '@/db/schema';
import type { DatabaseConnection } from '@/db/types';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipesScreen } from './recipes-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const feature = loadFeature('./recipe-list.feature', { loadRelativePath: true });

// An empty course cell is a recipe without a course.
type RecipeRow = Readonly<{
  course: '' | Course;
  ingredients: string;
  season: Season;
  title: string;
}>;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const row of rowList) {
      const ingredientIdList = row.ingredients
        .split(',')
        .map((name) => findOrCreateIngredient(connection.db, name).id);
      saveRecipe(connection.db, {
        course: row.course || null,
        ingredientIdList,
        instructions: '',
        season: row.season,
        title: row.title,
      });
    }
  };

  const openTheRecipeList = async () => {
    await renderWithDatabase(<RecipesScreen />, connection);
  };

  // A season or a course.
  const chooseTheOption = async (option: string) => {
    await fireEvent.press(screen.getByRole('radio', { name: option }));
  };

  const selectTheIngredient = async (name: string) => {
    await fireEvent.press(screen.getByRole('button', { name: `Add ${name}` }));
  };

  // Titles of the listed rows, in order: each row is read "title, season[, course]".
  const listedTitles = () =>
    screen
      .queryAllByRole('button', { name: /^.+, (Winter|Summer)/ })
      .map((row) => String(row.props.accessibilityLabel).split(', ', 1)[0])
      .join(', ');

  // Assertions stay inline in each `then` (not in shared step functions) so Sonar sees them (S2699).
  const matchCountText = (count: string) =>
    count === '1' ? '1 recipe matches.' : `${count} recipes match.`;

  test('Every recipe is listed without filters', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    then(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('A season also includes the recipes for both seasons', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    then(/^I see that (\d+) recipes match$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('A course keeps only the recipes of that course', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I choose the "(.*)" course$/, chooseTheOption);
    then(/^I see that (\d+) recipe matches$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('Listed recipes contain every selected ingredient', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then(/^I see that (\d+) recipe matches$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('The title search and the filters add up', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I search for "(.*)"$/, async (search: string) => {
      await fireEvent.changeText(screen.getByLabelText('Search recipes'), search);
    });
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    then(/^I see that (\d+) recipes match$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('Nothing is listed when no recipe matches', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then('I see that no recipe matches', () => {
      expect(screen.getByText('No recipe matches these filters.')).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });
});
