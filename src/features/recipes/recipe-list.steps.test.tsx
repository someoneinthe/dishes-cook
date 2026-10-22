import { fireEvent, screen } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';
import { defineFeature, loadFeature } from 'jest-cucumber';
import type { Course, Season } from '@/db/schema';
import type { DatabaseConnection } from '@/db/types';
import type { SyncState } from '@/features/sync/sync-store';
import { recipes } from '@/db/schema';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { toDisplayName } from '@/lib/text';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { saveRecipe } from './db/recipe-queries';
import { RecipesScreen } from './recipes-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => true }));

// The sync server the phone is connected to (none by default).
const mockSync: { connection: SyncState['connection'] } = { connection: undefined };
jest.mock('../sync/sync-store', () => ({
  ...jest.requireActual<object>('../sync/sync-store'),
  useSyncState: () => ({
    connection: mockSync.connection,
    isAppUpdateAvailable: false,
    isSyncing: false,
  }),
}));

const MY_ACCOUNT_ID = 'a00000000000001';

const feature = loadFeature('./recipe-list.feature', { loadRelativePath: true });

type RecipeRow = Readonly<{
  course: Course;
  ingredients: string;
  season: Season;
  title: string;
}>;

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
    mockSync.connection = undefined;
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const row of rowList) {
      const ingredientIdList = row.ingredients
        .split(',')
        .map((name) => findOrCreateIngredient(connection.db, name).id);
      saveRecipe(connection.db, {
        course: row.course,
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

  const showTheFilters = async () => {
    await fireEvent.press(screen.getByRole('button', { name: /^Filters/ }));
  };

  // A season or a course.
  const chooseTheOption = async (option: string) => {
    await fireEvent.press(screen.getByRole('radio', { name: option }));
  };

  const selectTheIngredient = async (name: string) => {
    await fireEvent.press(screen.getByRole('button', { name: `Add ${toDisplayName(name)}` }));
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
    and('I show the filters', showTheFilters);
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
    and('I show the filters', showTheFilters);
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
    and('I show the filters', showTheFilters);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then(/^I see that (\d+) recipe matches$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('Synced with a server, "Added by: Me" keeps the recipes I added', ({
    and,
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    given(
      /^the phone syncs with a server where "(.*)" was added by someone else$/,
      (title: string) => {
        mockSync.connection = {
          accountId: MY_ACCOUNT_ID,
          email: 'me@example.org',
          serverUrl: 'https://sync.example.org',
        };
        const setAuthor = (recipeTitle: string, createdBy: string) =>
          connection.db
            .update(recipes)
            .set({ createdBy })
            .where(eq(recipes.title, recipeTitle.toLowerCase()))
            .run();
        // Pumpkin soup stays as added here and not synced yet: mine too.
        setAuthor('Tomato salad', MY_ACCOUNT_ID);
        setAuthor(title, 'b00000000000002');
      },
    );
    when('I open the recipe list', openTheRecipeList);
    and('I show the filters', showTheFilters);
    and(/^I choose "(.*)" for who added them$/, chooseTheOption);
    then(/^I see that (\d+) recipes match$/, (count: string) => {
      expect(screen.getByText(matchCountText(count))).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('Without a server, every recipe is mine: there is no "Added by" filter', ({
    and,
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and('I show the filters', showTheFilters);
    then("I can't choose who added the recipes", () => {
      expect(screen.getByRole('radio', { name: 'Winter' })).toBeOnTheScreen();
      expect(screen.queryByRole('radio', { name: 'Me' })).not.toBeOnTheScreen();
    });
  });

  const searchFor = async (search: string) => {
    await fireEvent.changeText(screen.getByLabelText('Search recipes'), search);
  };

  test('The title search ignores case and accents', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I search for "(.*)"$/, searchFor);
    then(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('A title search can match nothing', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and(/^I search for "(.*)"$/, searchFor);
    then(/^I see that no recipe is titled "(.*)"$/, (search: string) => {
      expect(screen.getByText(`No recipe matches “${search}”.`)).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('The title search and the filters add up', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    and('I show the filters', showTheFilters);
    and(/^I search for "(.*)"$/, searchFor);
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
    and('I show the filters', showTheFilters);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and(/^I select the ingredient "(.*)"$/, selectTheIngredient);
    then('I see that no recipe matches', () => {
      expect(screen.getByText('No recipe matches these filters.')).toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });

  test('Filters are hidden at first and stay applied once hidden', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the recipe list', openTheRecipeList);
    then('only the title search is shown', () => {
      expect(screen.getByLabelText('Search recipes')).toBeOnTheScreen();
      expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Filters' })).not.toBeExpanded();
    });
    when('I show the filters', showTheFilters);
    and(/^I choose the "(.*)" season$/, chooseTheOption);
    and('I hide the filters', async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Filters/ }));
    });
    then(/^the filters button tells that (\d+) filter is on$/, (count: string) => {
      expect(screen.getByRole('button', { name: `Filters (${count})` })).not.toBeExpanded();
      expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    });
    and(/^the list shows "(.*)"$/, (titles: string) => {
      expect(listedTitles()).toBe(titles);
    });
  });
});
