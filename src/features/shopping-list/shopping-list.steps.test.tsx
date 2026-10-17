import type { ReactElement } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { Share } from 'react-native';
import type { DatabaseConnection } from '@/db/types';
import type { Unit } from '@/lib/units';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { MealChoiceScreen } from '@/features/meal-choice/meal-choice-screen';
import { getLastCookedMeal } from '@/features/meal-history/db/cooked-meal-queries';
import { getRecipeSyncId, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { RecipeDetailScreen } from '@/features/recipes/recipe-detail-screen';
import { calendarDaysAgo } from '@/lib/dates';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { addPick, clearPicks, getPicks } from './meal-picks';
import { ShoppingListScreen } from './shopping-list-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useIsFocused: () => true,
  useLocalSearchParams: jest.fn(),
}));

const feature = loadFeature('./shopping-list.feature', { loadRelativePath: true });

// "Leek: 3, Potato: 500 g, Salt": ingredients, with their quantity when they have one.
type RecipeRow = Readonly<{ ingredients: string; title: string }>;

// The meal choice, with the recipe screen opened over it (it stays mounted).
function MealChoiceWithRecipe({ isRecipeOpen = false }: Readonly<{ isRecipeOpen?: boolean }>) {
  return (
    <>
      <MealChoiceScreen />
      {isRecipeOpen && <RecipeDetailScreen />}
    </>
  );
}

defineFeature(feature, (test) => {
  let connection: DatabaseConnection;
  let shareSpy: jest.SpiedFunction<typeof Share.share>;
  const idByTitle = new Map<string, number>();

  beforeEach(() => {
    connection = createTestConnection();
    idByTitle.clear();
    clearPicks();
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  });

  afterEach(() => {
    shareSpy.mockRestore();
  });

  const theseRecipes = (rowList: RecipeRow[]) => {
    for (const { ingredients, title } of rowList) {
      const quantities = new Map<number, Readonly<{ amount: number; unit?: Unit }>>();
      const ingredientIdList = ingredients.split(', ').map((text) => {
        const [name = '', quantity] = text.split(': ', 2);
        const { id } = findOrCreateIngredient(connection.db, name);
        if (quantity) {
          const [amount, unit] = quantity.split(' ', 2);
          quantities.set(
            id,
            unit ? { amount: Number(amount), unit: unit as Unit } : { amount: Number(amount) },
          );
        }
        return id;
      });
      idByTitle.set(
        title,
        saveRecipe(connection.db, {
          ingredientIdList,
          instructions: '',
          quantities,
          season: 'both',
          title,
        }),
      );
    }
  };
  const inTheList = (first: string, second: string) => {
    addPick(getRecipeSyncId(connection.db, idByTitle.get(first)!)!);
    addPick(getRecipeSyncId(connection.db, idByTitle.get(second)!)!);
  };

  // Title of the suggested recipe, shown as a header on its card.
  const currentSuggestion = () =>
    [...idByTitle.keys()].find((title) => screen.queryByRole('header', { name: title }));
  let firstSuggestion: string | undefined;
  const openTheMealChoice = async () => {
    await renderWithDatabase(<MealChoiceScreen />, connection);
    firstSuggestion = currentSuggestion();
  };
  const addTheSuggestion = async () => {
    await fireEvent.press(
      screen.getByRole('button', { name: `Add ${currentSuggestion()} to the shopping list` }),
    );
  };
  const openTheShoppingList = async () => {
    await renderWithDatabase(<ShoppingListScreen />, connection);
  };
  const openTheRecipe = async (title: string) => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(idByTitle.get(title)) });
    await renderWithDatabase(<RecipeDetailScreen />, connection);
  };
  // The ingredient lines shown, without their bullet.
  const shownIngredients = () =>
    screen.getAllByText(/^• /).map((line) => (line.props.children as string).slice(2));

  test('The suggestion can be added to the list, and another recipe is proposed', ({
    and,
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I add the suggestion to the shopping list', addTheSuggestion);
    then('the other recipe is suggested', () => {
      expect(firstSuggestion).toBeDefined();
      expect(currentSuggestion()).toBeDefined();
      expect(currentSuggestion()).not.toBe(firstSuggestion);
    });
    and(/^the shopping list holds (\d+) meal$/, (count: string) => {
      expect(getPicks()).toHaveLength(Number(count));
      expect(
        screen.getByRole('button', { name: `Shopping list, ${count} meal` }),
      ).toBeOnTheScreen();
    });
  });

  test("The meal choice doesn't suggest the meals in the list", ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I add the suggestion to the shopping list', addTheSuggestion);
    and('I ask for another suggestion', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Suggest another one' }));
    });
    then('the other recipe is suggested', () => {
      expect(currentSuggestion()).toBeDefined();
      expect(currentSuggestion()).not.toBe(firstSuggestion);
    });
  });

  test('Nothing is suggested once every matching recipe is in the list', ({
    and,
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    when('I open the meal choice', openTheMealChoice);
    and('I add the suggestion to the shopping list', addTheSuggestion);
    and('I add the suggestion to the shopping list', addTheSuggestion);
    then('I am told that every matching recipe is in the shopping list', () => {
      expect(screen.getByText('Every matching recipe is in your shopping list.')).toBeOnTheScreen();
      expect(currentSuggestion()).toBeUndefined();
    });
  });

  test('The list adds up the ingredients of its meals', ({ given, then, when }) => {
    given('these recipes:', theseRecipes);
    given(/^"(.*)" and "(.*)" are in the shopping list$/, inTheList);
    when('I open the shopping list', openTheShoppingList);
    then(/^it lists "(.*)", "(.*)", "(.*)" and "(.*)"$/, (...nameList: string[]) => {
      expect(shownIngredients()).toStrictEqual(nameList);
    });
  });

  test('Sharing the list, then marking its meals as cooked', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    given(/^"(.*)" and "(.*)" are in the shopping list$/, inTheList);
    when('I open the shopping list', openTheShoppingList);
    and('I share it', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    });
    then(/^the shared text lists the meals and "(.*)"$/, (line: string) => {
      const { message } = shareSpy.mock.lastCall?.[0] as { message: string };

      expect(message).toContain('Meals: Leek pie, Leek soup');
      expect(message).toContain(line);
    });
    when('I mark the meals as cooked', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Mark as cooked' }));
    });
    then('the shopping list is empty', () => {
      expect(getPicks()).toStrictEqual([]);
      expect(screen.getByText('No meals picked yet')).toBeOnTheScreen();
    });
    and(/^"(.*)" and "(.*)" were cooked today$/, (first: string, second: string) => {
      const daysAgoOf = (title: string) =>
        calendarDaysAgo(getLastCookedMeal(connection.db, idByTitle.get(title)!)?.cookedAt ?? 0);

      expect([daysAgoOf(first), daysAgoOf(second)]).toStrictEqual([0, 0]);
    });
  });

  test('A meal can be taken out of the list', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    given(/^"(.*)" and "(.*)" are in the shopping list$/, inTheList);
    when('I open the shopping list', openTheShoppingList);
    and(/^I take "(.*)" out of the list$/, async (title: string) => {
      await fireEvent.press(screen.getByRole('button', { name: `Remove ${title} from the list` }));
    });
    then(/^it lists "(.*)", "(.*)" and "(.*)"$/, (...nameList: string[]) => {
      expect(shownIngredients()).toStrictEqual(nameList);
    });
  });

  test('A suggestion added to the list from its page is replaced', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    // The meal choice stays mounted under the recipe screen, as in the app's stack.
    let rerender: (ui: ReactElement) => Promise<void>;
    when('I open the meal choice', async () => {
      ({ rerender } = await renderWithDatabase(<MealChoiceWithRecipe />, connection));
      firstSuggestion = currentSuggestion();
    });
    and('I open the suggestion and add it to the shopping list', async () => {
      jest
        .mocked(useLocalSearchParams)
        .mockReturnValue({ id: String(idByTitle.get(firstSuggestion!)) });
      await rerender(<MealChoiceWithRecipe isRecipeOpen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Add to the shopping list' }));
    });
    and('I go back to the meal choice', async () => {
      await rerender(<MealChoiceWithRecipe />);
    });
    then('the other recipe is suggested', () => {
      expect(currentSuggestion()).toBeDefined();
      expect(currentSuggestion()).not.toBe(firstSuggestion);
    });
  });

  test('The offer to mark the meals as cooked goes once the list changes', ({
    and,
    given,
    then,
    when,
  }) => {
    given('these recipes:', theseRecipes);
    given(/^"(.*)" is in the shopping list$/, (title: string) => {
      addPick(getRecipeSyncId(connection.db, idByTitle.get(title)!)!);
    });
    when('I open the shopping list', openTheShoppingList);
    and('I share it', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

      expect(screen.getByRole('button', { name: 'Mark as cooked' })).toBeOnTheScreen();
    });
    and(/^"(.*)" is added to the list$/, async (title: string) => {
      await act(() => {
        addPick(getRecipeSyncId(connection.db, idByTitle.get(title)!)!);
      });
    });
    then("I'm not offered to mark the meals as cooked", () => {
      expect(screen.queryByRole('button', { name: 'Mark as cooked' })).not.toBeOnTheScreen();
    });
  });

  test('A recipe can be added to the list from its page', ({ and, given, then, when }) => {
    given('these recipes:', theseRecipes);
    when(/^I open "(.*)"$/, openTheRecipe);
    and('I add it to the shopping list', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Add to the shopping list' }));
    });
    then(/^the shopping list holds (\d+) meal$/, (count: string) => {
      expect(getPicks()).toHaveLength(Number(count));
    });
    when('I take it out of the shopping list', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Remove from the shopping list' }));
    });
    then('the shopping list is empty', () => {
      expect(getPicks()).toStrictEqual([]);
    });
  });
});
