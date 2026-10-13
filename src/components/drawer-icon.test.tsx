import { render, screen } from '@testing-library/react-native';
import { drawerIcon } from './drawer-icon';

describe('drawerIcon', () => {
  it('renders an icon in its own color, at the size of the menu entry', async () => {
    const CarrotIcon = drawerIcon('carrot', '#C2410C');

    await render(<CarrotIcon size={24} />);

    expect(screen.toJSON()).toMatchObject({
      props: {
        style: expect.arrayContaining([{ color: '#C2410C', fontSize: 24 }]) as unknown,
      },
      type: 'Text',
    });
  });
});
