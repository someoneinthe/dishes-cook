import { render, screen } from '@testing-library/react-native';
import { drawerIcon } from './drawer-icon';

describe('drawerIcon', () => {
  it('renders an icon with the color and size of the menu entry', async () => {
    const CarrotIcon = drawerIcon('carrot');

    await render(<CarrotIcon color="#C2410C" size={24} />);

    expect(screen.toJSON()).toMatchObject({
      props: {
        style: expect.arrayContaining([{ color: '#C2410C', fontSize: 24 }]) as unknown,
      },
      type: 'Text',
    });
  });
});
