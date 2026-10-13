import { render, screen } from '@testing-library/react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { renderedIconColorList } from '@/test/icons';
import { CourseLabel, SeasonLabel } from './recipe-labels';

describe('recipe labels', () => {
  const colors = () => UnistylesRuntime.getTheme().colors;

  it('shows the season after its colored icon', async () => {
    await render(<SeasonLabel season="winter" />);

    expect(screen.getByText('Winter')).toBeVisible();
    expect(renderedIconColorList()).toStrictEqual([colors().seasonWinter]);
  });

  it('shows both icons for winter & summer', async () => {
    await render(<SeasonLabel season="both" />);

    expect(screen.getByText('Winter & summer')).toBeVisible();
    expect(renderedIconColorList()).toStrictEqual([colors().seasonWinter, colors().seasonSummer]);
  });

  it('shows the course after its colored icon', async () => {
    await render(<CourseLabel course="main" />);

    expect(screen.getByText('Main course')).toBeVisible();
    expect(renderedIconColorList()).toStrictEqual([colors().courseMain]);
  });
});
