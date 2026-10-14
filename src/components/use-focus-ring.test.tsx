import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './button';

describe('useFocusRing', () => {
  it('rings a button while it has the focus (TV remote, keyboard)', async () => {
    await render(<Button label="Save" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).not.toHaveStyle({ outlineStyle: 'solid' });

    await fireEvent(button, 'focus');

    expect(button).toHaveStyle({ outlineStyle: 'solid', outlineWidth: 3 });

    await fireEvent(button, 'blur');

    expect(button).not.toHaveStyle({ outlineStyle: 'solid' });
  });
});
