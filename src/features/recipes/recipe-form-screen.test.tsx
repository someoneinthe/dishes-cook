import type { TextInputProps } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, TextInput } from 'react-native';
import type { DatabaseConnection } from '@/db/types';
import type { NavigationMock } from '@/test/navigation-mock';
import { findOrCreateIngredient } from '@/features/ingredients/db/ingredient-queries';
import { toStored } from '@/lib/units';
import { spyOnAlert } from '@/test/alert';
import { firstIngredientPage, firstRecipePage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { deleteRecipe, getRecipe, saveRecipe } from './db/recipe-queries';
import { RecipeFormScreen } from './recipe-form-screen';
import { putScannedDraft } from './scanned-recipe';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.requireActual<NavigationMock>('@/test/navigation-mock').ScreenWithHeaderButtons,
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

describe('recipeFormScreen', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // A new recipe, unless a test opens one.
    jest.mocked(useLocalSearchParams).mockReturnValue({});
  });

  it('creates a recipe with an existing and a new ingredient', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Carrot soup');
    await fireEvent.press(screen.getByRole('radio', { name: 'Winter' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add Carrot' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'Ginger');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Ginger' }));
    await fireEvent.changeText(screen.getByLabelText('Recipe text'), 'Simmer.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    const [{ id: savedId } = { id: -1 }] = firstRecipePage(connection.db);

    expect(getRecipe(connection.db, savedId)).toStrictEqual({
      addedBy: { accountId: null },
      // Main course unless chosen otherwise.
      course: 'main',
      id: savedId,
      ingredientList: [
        { id: carrot.id, name: 'Carrot' },
        { id: expect.any(Number) as number, name: 'Ginger' },
      ],
      instructions: 'Simmer.',
      kind: 'dish',
      season: 'winter',
      title: 'Carrot soup',
    });
    expect(router.replace).toHaveBeenCalledWith({
      params: { id: String(savedId) },
      pathname: '/recipe/[id]',
    });
  });

  it('creates a new ingredient on Save, and only if it is still in the recipe', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Carrot soup');
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'Ginger');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Ginger' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'leek');
    await fireEvent.press(screen.getByRole('button', { name: 'Create leek' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Ginger' }));

    // Picked, not saved yet.
    expect(firstIngredientPage(connection.db)).toStrictEqual([]);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(firstIngredientPage(connection.db).map(({ name }) => name)).toStrictEqual(['Leek']);
  });

  it('keeps one new ingredient typed again after being removed, with its quantity', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Ginger tea');
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'Ginger');
    await fireEvent.press(screen.getByRole('button', { name: 'Create Ginger' }));
    await fireEvent.changeText(screen.getByLabelText('Quantity of Ginger'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Ginger' }));
    await fireEvent.changeText(screen.getByLabelText('Search ingredients'), 'GINGER');
    await fireEvent.press(screen.getByRole('button', { name: 'Create GINGER' }));

    // The same new ingredient: its quantity as typed before it was removed.
    expect(screen.getByLabelText('Quantity of Ginger')).toHaveDisplayValue('2');

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    const [{ id: savedId } = { id: -1 }] = firstRecipePage(connection.db);

    expect(getRecipe(connection.db, savedId)?.ingredientList).toStrictEqual([
      { id: expect.any(Number) as number, name: 'Ginger', quantity: { amount: 2 } },
    ]);
  });

  it('saves a new recipe once, however fast Save is tapped again', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Soup');

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(firstRecipePage(connection.db)).toHaveLength(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('offers to save as a new recipe one deleted meanwhile on another device', async () => {
    const alert = spyOnAlert();
    const id = saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      photo: { file: 'soup.jpg' },
      season: 'both',
      title: 'Soup',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Recipe text'), 'Simmer.');
    // Pulled by a sync while the form is open.
    deleteRecipe(connection.db, id);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(alert.spy).toHaveBeenCalledWith(
      'This recipe was deleted',
      expect.stringContaining('Save your version as a new recipe?'),
      expect.anything(),
    );

    await alert.press('Save as new');
    // A second alert, if Save was tapped twice before the first showed.
    await alert.press('Save as new');

    expect(firstRecipePage(connection.db)).toHaveLength(1);

    const [{ id: savedId } = { id: -1 }] = firstRecipePage(connection.db);

    // With the photo the form showed, unchanged.
    expect(getRecipe(connection.db, savedId)).toMatchObject({
      instructions: 'Simmer.',
      photoFile: 'soup.jpg',
      title: 'Soup',
    });
    // The deleted recipe's screen, under the form, shows the new one instead.
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(jest.mocked(router.replace).mock.calls).toStrictEqual([
      [{ params: { id: String(savedId) }, pathname: '/recipe/[id]' }],
    ]);
  });

  it('requires a title', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(screen.getByText('Give the recipe a title.')).toBeOnTheScreen();
    expect(firstRecipePage(connection.db)).toStrictEqual([]);
  });

  it('brings the first wrong field into view and gives it the focus on Save', async () => {
    // The mocked TextInput's focus is shared by every field: the title is the only one wrong.
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => expect(focus).toHaveBeenCalledWith());

    // The title's field, by its label: no other field was focused. Each call's `this` is the mocked
    // field component (an earlier test's Save may focus its own title here too).
    const focusedList = focus.mock.contexts as Readonly<{ props: TextInputProps }>[];

    expect(new Set(focusedList.map(({ props }) => props.accessibilityLabel))).toStrictEqual(
      new Set(['Title']),
    );
  });

  it('gives the focus to the first wrong amount on Save', async () => {
    findOrCreateIngredient(connection.db, 'carrot');
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Soup');
    await fireEvent.press(screen.getByRole('button', { name: 'Add Carrot' }));
    await fireEvent.changeText(screen.getByLabelText('Quantity of Carrot'), 'a lot');
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => expect(focus).toHaveBeenCalledWith());

    const focusedList = focus.mock.contexts as Readonly<{ props: TextInputProps }>[];

    expect(new Set(focusedList.map(({ props }) => props.accessibilityLabel))).toStrictEqual(
      new Set(['Quantity of Carrot']),
    );
  });

  it('gives the focus to the first wrong time on Save, before a wrong amount', async () => {
    findOrCreateIngredient(connection.db, 'carrot');
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    await renderWithDatabase(<RecipeFormScreen />, connection);
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Soup');
    await fireEvent.changeText(screen.getByLabelText('Cooking (min)'), 'long');
    await fireEvent.press(screen.getByRole('button', { name: 'Add Carrot' }));
    await fireEvent.changeText(screen.getByLabelText('Quantity of Carrot'), 'a lot');
    focus.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => expect(focus).toHaveBeenCalledWith());

    const focusedList = focus.mock.contexts as Readonly<{ props: TextInputProps }>[];

    expect(new Set(focusedList.map(({ props }) => props.accessibilityLabel))).toStrictEqual(
      new Set(['Cooking (min)']),
    );
  });

  it('gives the screen reader the unanswered question about a similar ingredient on Save', async () => {
    const sendEvent = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    findOrCreateIngredient(connection.db, 'carrot');
    const scanned = { ingredientList: [{ name: 'carrots' }], instructions: '', title: 'Soup' };
    jest.mocked(useLocalSearchParams).mockReturnValue({ draft: putScannedDraft(scanned) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => expect(sendEvent).toHaveBeenCalledWith(expect.anything(), 'focus'));

    // The question, turned into an error: the screen reader reads it there.
    // Jest's Text is a component instance with the props it was given.
    const question = sendEvent.mock.calls[0]?.[0] as
      Readonly<{ props: Readonly<{ children: string }> }> | undefined;

    expect(question?.props.children).toMatch(/^You already have “carrot”: choose one/i);
  });

  it('explains that the recipe can be written in Markdown', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    const hint = /^Format it with Markdown: # Heading, \*\*bold\*\*/;

    // Shown under the field, and read by screen readers with the field (not a second time).
    expect(screen.getByText(hint, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText(hint)).not.toBeOnTheScreen();
    expect(screen.getByHintText(hint)).toHaveAccessibleName('Recipe text');
  });

  it('has nothing to preview while the recipe is empty', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    await fireEvent.press(screen.getByRole('radio', { name: 'Preview' }));

    expect(screen.getByText('Nothing to preview yet.')).toBeOnTheScreen();
  });

  it('edits an existing recipe', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    const id = saveRecipe(connection.db, {
      ingredientIdList: [carrot.id],
      instructions: 'Simmer.',
      season: 'winter',
      title: 'Carrot soup',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByLabelText('Title')).toHaveDisplayValue('Carrot soup');

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Carrot' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Both' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dessert' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(getRecipe(connection.db, id)).toMatchObject({
      course: 'dessert',
      ingredientList: [],
      season: 'both',
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('edits a drink’s maturation time, shown as typed, and empties it', async () => {
    const id = saveRecipe(connection.db, {
      ingredientIdList: [],
      instructions: '',
      kind: 'drink',
      maturationMonths: 1.5,
      season: 'both',
      title: 'Limoncello',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByLabelText('Maturation (months)')).toHaveDisplayValue('1.5');

    await fireEvent.changeText(screen.getByLabelText('Maturation (months)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));

    expect(getRecipe(connection.db, id)?.maturationMonths).toBeUndefined();
  });

  it('asks a dish for no maturation time', async () => {
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByLabelText('Cooking (min)')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Maturation (months)')).not.toBeOnTheScreen();
  });

  it('requires a course: main course for a new recipe, the saved one when editing', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('radio', { name: 'Main course' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'None' })).not.toBeOnTheScreen();

    await screen.unmount();
    const id = saveRecipe(connection.db, {
      course: 'starter',
      ingredientIdList: [],
      instructions: '',
      season: 'summer',
      title: 'Tomato salad',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('radio', { name: 'Starter' })).toBeChecked();
  });

  it('keeps the exact quantity of a row left as shown, and saves an edited row as typed', async () => {
    const flour = findOrCreateIngredient(connection.db, 'Flour').id;
    const milk = findOrCreateIngredient(connection.db, 'Milk').id;
    const id = saveRecipe(connection.db, {
      ingredientIdList: [flour, milk],
      instructions: '',
      quantities: new Map([
        [flour, { amount: 8, unit: 'oz' }],
        [milk, { amount: 1, unit: 'cup' }],
      ]),
      season: 'both',
      title: 'Cake',
    });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    // Shown rounded in European units: 8 oz = 226.8 g, 1 cup = 236.6 ml.
    expect(screen.getByLabelText('Quantity of Flour')).toHaveDisplayValue('227');
    expect(screen.getByLabelText('Quantity of Milk')).toHaveDisplayValue('237');

    await fireEvent.changeText(screen.getByLabelText('Quantity of Milk'), '250');
    await fireEvent.press(screen.getByRole('button', { name: 'Save recipe' }));

    expect(
      getRecipe(connection.db, id)?.ingredientList.map(({ quantity }) => quantity),
    ).toStrictEqual([toStored({ amount: 8, unit: 'oz' }), { amount: 250, unit: 'ml' }]);
  });

  it('tells when the recipe to edit no longer exists', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: '42' });
    await renderWithDatabase(<RecipeFormScreen />, connection);

    expect(screen.getByRole('header', { name: 'Recipe not found' })).toBeOnTheScreen();
  });
});
