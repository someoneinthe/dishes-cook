import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from './home-screen';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

describe('homeScreen', () => {
  it('renders the welcome title', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('What should we eat today?')).toBeOnTheScreen();
  });
});
