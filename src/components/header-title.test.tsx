import { fireEvent, render, screen } from '@testing-library/react-native';
import { spyOnAlert } from '@/test/alert';
import { renderedIconColorList } from '@/test/icons';
import { HeaderTitle, headerTitleWithIcon } from './header-title';

const TITLE = 'Ingredients';
const LONG_TITLE = 'Slow-roasted pumpkin and chestnut soup';

describe('headerTitle', () => {
  it('keeps a long title on one line, as a heading read in full', async () => {
    await render(<HeaderTitle>{LONG_TITLE}</HeaderTitle>);

    const title = screen.getByRole('header', { name: LONG_TITLE });

    expect(title.props).toMatchObject({ numberOfLines: 1 });
  });

  it('shows the full title on a long press', async () => {
    const alert = spyOnAlert();
    await render(<HeaderTitle>{LONG_TITLE}</HeaderTitle>);

    await fireEvent(screen.getByRole('header'), 'longPress');

    expect(alert.spy).toHaveBeenCalledWith('', LONG_TITLE);
  });

  it('starts with the menu icon, in its menu color', async () => {
    const IngredientsTitle = headerTitleWithIcon('carrot', '#C2410C');

    await render(<IngredientsTitle>{TITLE}</IngredientsTitle>);

    expect(screen.getByRole('header', { name: TITLE })).toBeVisible();
    expect(renderedIconColorList()).toStrictEqual(['#C2410C']);
  });
});
