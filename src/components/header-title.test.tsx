import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, ToastAndroid } from 'react-native';
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
    // jest-expo runs as iOS; the toast is Android's.
    jest.replaceProperty(Platform, 'OS', 'android');
    const show = jest.spyOn(ToastAndroid, 'show').mockReturnValue();
    await render(<HeaderTitle>{LONG_TITLE}</HeaderTitle>);

    await fireEvent(screen.getByRole('header'), 'longPress');

    expect(show).toHaveBeenCalledWith(LONG_TITLE, ToastAndroid.SHORT);
  });

  it('starts with the menu icon, in its menu color', async () => {
    const IngredientsTitle = headerTitleWithIcon('carrot', '#C2410C');

    await render(<IngredientsTitle>{TITLE}</IngredientsTitle>);

    expect(screen.toJSON()).toMatchObject({
      children: [
        {
          props: {
            style: expect.arrayContaining([
              expect.objectContaining({ color: '#C2410C' }),
            ]) as unknown,
          },
        },
        { children: [TITLE] },
      ],
    });
  });
});
