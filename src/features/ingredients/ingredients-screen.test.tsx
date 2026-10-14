import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { DatabaseConnection } from '@/db/types';
import { deleteRecipe, saveRecipe } from '@/features/recipes/db/recipe-queries';
import { updatePreferences } from '@/features/settings/preferences';
import { spyOnAlert } from '@/test/alert';
import { AppLanguage } from '@/test/app-language';
import { firstIngredientPage } from '@/test/queries';
import { createTestConnection, renderWithDatabase } from '@/test/test-database';
import { findOrCreateIngredient } from './db/ingredient-queries';
import { IngredientsScreen } from './ingredients-screen';

describe('ingredientsScreen', () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createTestConnection();
    updatePreferences({ language: 'system' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const typeInSearch = async (text: string) => {
    await fireEvent.changeText(screen.getByLabelText('Search or add an ingredient'), text);
  };

  it('invites to add the first ingredient', async () => {
    await renderWithDatabase(<IngredientsScreen />, connection);

    expect(screen.getByRole('header', { name: 'No ingredients yet' })).toBeOnTheScreen();
  });

  it('adds an ingredient and shows it in the list', async () => {
    await renderWithDatabase(<IngredientsScreen />, connection);

    await typeInSearch('  Carrot ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));

    await expect(screen.findByText('Carrot')).resolves.toBeOnTheScreen();
    expect(screen.getByLabelText('Search or add an ingredient')).toHaveDisplayValue('');
  });

  it('refreshes when recipes change elsewhere, cascading deletes included', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<IngredientsScreen />, connection);

    expect(screen.getByText('Not used yet')).toBeOnTheScreen();

    const recipeId = saveRecipe(connection.db, {
      ingredientIdList: [carrot.id],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });

    await expect(screen.findByText('Used in 1 recipe')).resolves.toBeOnTheScreen();

    // Only "recipes" is written; its links go through ON DELETE CASCADE.
    deleteRecipe(connection.db, recipeId);

    await expect(screen.findByText('Not used yet')).resolves.toBeOnTheScreen();
  });

  it('refuses a duplicate or a blank name', async () => {
    findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<IngredientsScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));

    expect(screen.getByText('Type the name of the ingredient to add.')).toBeOnTheScreen();

    await typeInSearch('CARROT');
    await fireEvent(screen.getByLabelText('Search or add an ingredient'), 'submitEditing');

    expect(screen.getByText('“Carrot” already exists.')).toBeOnTheScreen();
    expect(firstIngredientPage(connection.db)).toHaveLength(1);
  });

  it('filters the list while typing, ignoring accents', async () => {
    findOrCreateIngredient(connection.db, 'Échalote');
    findOrCreateIngredient(connection.db, 'Carrot');
    await renderWithDatabase(<IngredientsScreen />, connection);

    await typeInSearch('echa');

    expect(screen.getByText('Échalote')).toBeOnTheScreen();
    expect(screen.queryByText('Carrot')).not.toBeOnTheScreen();
  });

  it('renames an ingredient', async () => {
    findOrCreateIngredient(connection.db, 'Carot');
    await renderWithDatabase(<IngredientsScreen />, connection);

    await fireEvent.press(screen.getByRole('button', { name: 'Rename Carot' }));
    await fireEvent.changeText(screen.getByLabelText('Rename Carot'), 'Carrot');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await expect(screen.findByText('Carrot')).resolves.toBeOnTheScreen();
  });

  it('shows the usage of an ingredient and only lets delete unused ones', async () => {
    const carrot = findOrCreateIngredient(connection.db, 'Carrot');
    findOrCreateIngredient(connection.db, 'Leek');
    saveRecipe(connection.db, {
      ingredientIdList: [carrot.id],
      instructions: '',
      season: 'both',
      title: 'Soup',
    });
    const alert = spyOnAlert();
    await renderWithDatabase(<IngredientsScreen />, connection);

    expect(screen.getByText('Used in 1 recipe')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete Carrot' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Leek' }));
    await alert.press('Delete');

    await waitFor(() => expect(screen.queryByText('Leek')).not.toBeOnTheScreen());

    expect(firstIngredientPage(connection.db).map((ingredient) => ingredient.name)).toStrictEqual([
      'Carrot',
    ]);
  });

  it('speaks French, its delete question included, when the app is in French', async () => {
    updatePreferences({ language: 'fr' });
    findOrCreateIngredient(connection.db, 'Poireau');
    const alert = spyOnAlert();
    await renderWithDatabase(
      <AppLanguage>
        <IngredientsScreen />
      </AppLanguage>,
      connection,
    );

    expect(screen.getByText('Pas encore utilisé')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer Poireau' }));

    expect(alert.spy).toHaveBeenCalledWith('Supprimer «\u{A0}Poireau\u{A0}»\u{202F}?', undefined, [
      { style: 'cancel', text: 'Annuler' },
      expect.objectContaining({ style: 'destructive', text: 'Supprimer' }),
    ]);
  });
});
