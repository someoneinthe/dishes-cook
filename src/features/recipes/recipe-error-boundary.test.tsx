import { fireEvent, render, screen } from '@testing-library/react-native';
import { RecipeErrorBoundary } from './recipe-error-boundary';

describe('recipeErrorBoundary', () => {
  it('says the recipe can’t be shown and tries again on demand', async () => {
    const retry = jest.fn(() => Promise.resolve());
    await render(<RecipeErrorBoundary error={new Error('Too deep')} retry={retry} />);

    expect(screen.getByRole('header', { name: 'This recipe can’t be shown' })).toBeOnTheScreen();
    // The error itself (for developers, in English) isn't shown.
    expect(screen.queryByText(/Too deep/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
