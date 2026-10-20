import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { updatePreferences } from '@/features/settings/preferences';
import { InstructionsField } from './instructions-field';

describe('instructionsField', () => {
  afterEach(async () => {
    await act(() => {
      updatePreferences({ isShowingButtonLabels: false });
    });
  });

  it('switches between writing and previewing with icons, their text read by screen readers', async () => {
    await render(
      <InstructionsField onChange={jest.fn()} placeholder="Steps…" value="**Simmer**." />,
    );

    expect(screen.getByLabelText('Recipe text')).toBeOnTheScreen();
    // Icons only: the text is for screen readers (and Settings › Show button labels).
    expect(screen.queryByText('Preview')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Preview' }));

    expect(screen.queryByLabelText('Recipe text')).not.toBeOnTheScreen();
    expect(screen.getByText('Simmer')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Preview' })).toBeChecked();
  });

  it('shows the switch’s text with Settings › Show button labels', async () => {
    await render(<InstructionsField onChange={jest.fn()} placeholder="Steps…" value="" />);

    await act(() => {
      updatePreferences({ isShowingButtonLabels: true });
    });

    expect(screen.getByText('Write')).toBeOnTheScreen();
    expect(screen.getByText('Preview')).toBeOnTheScreen();
  });
});
