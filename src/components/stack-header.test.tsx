import { router, Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { StackHeader } from './stack-header';

const TITLE = 'Slow-roasted pumpkin and chestnut soup';

function HomeScreen() {
  return <Text>Home</Text>;
}

function RecipeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: TITLE }} />
      <Text>Recipe</Text>
    </>
  );
}

function StackLayout() {
  return <Stack screenOptions={{ header: StackHeader }} />;
}

describe('stackHeader', () => {
  const openRecipe = async () => {
    await renderRouter({ _layout: StackLayout, index: HomeScreen, 'recipe/new': RecipeScreen });
    await act(() => Promise.resolve(router.push('/recipe/new')));
  };

  it('shows the screen title on one line, as a heading read in full', async () => {
    await openRecipe();

    expect(screen.getByRole('header', { name: TITLE })).toHaveProp('numberOfLines', 1);
  });

  it('has a back button only when there is a screen to go back to', async () => {
    await renderRouter({ _layout: StackLayout, index: HomeScreen, 'recipe/new': RecipeScreen });

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeOnTheScreen();

    await act(() => Promise.resolve(router.push('/recipe/new')));

    expect(screen.getByRole('button', { name: 'Go back' })).toBeVisible();
  });
});
