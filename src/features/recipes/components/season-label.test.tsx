import { render, screen } from '@testing-library/react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { SeasonLabel } from './season-label';

describe('seasonLabel', () => {
  const colors = () => UnistylesRuntime.getTheme().colors;
  const iconWithColor = (color: string) => ({
    props: { style: expect.arrayContaining([expect.objectContaining({ color })]) as unknown },
  });

  it('shows the season after its colored icon', async () => {
    await render(<SeasonLabel season="winter" />);

    expect(screen.getByText('Winter')).toBeVisible();
    expect(screen.toJSON()).toMatchObject({
      children: [{ children: [iconWithColor(colors().seasonWinter)] }, {}],
    });
  });

  it('shows both icons for winter & summer', async () => {
    await render(<SeasonLabel season="both" />);

    expect(screen.getByText('Winter & summer')).toBeVisible();
    expect(screen.toJSON()).toMatchObject({
      children: [
        {
          children: [iconWithColor(colors().seasonWinter), iconWithColor(colors().seasonSummer)],
        },
        {},
      ],
    });
  });
});
