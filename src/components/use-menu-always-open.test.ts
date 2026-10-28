import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useIsMenuAlwaysOpen } from './use-menu-always-open';

const device = { isTv: false, isWeb: true };
jest.mock('../lib/device', () => ({
  get isTv() {
    return device.isTv;
  },
  get isWeb() {
    return device.isWeb;
  },
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('useIsMenuAlwaysOpen', () => {
  const isOpenAtWidth = async (width: number) => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ fontScale: 1, height: 800, scale: 1, width });
    const { result } = await renderHook(() => useIsMenuAlwaysOpen());
    return result.current;
  };

  it('keeps the menu open in a browser window wide enough for it and a screen', async () => {
    Object.assign(device, { isTv: false, isWeb: true });

    await expect(isOpenAtWidth(1280)).resolves.toBe(true);
    await expect(isOpenAtWidth(800)).resolves.toBe(false);
  });

  it('always on a TV, never on a phone', async () => {
    Object.assign(device, { isTv: true, isWeb: false });

    await expect(isOpenAtWidth(800)).resolves.toBe(true);

    Object.assign(device, { isTv: false, isWeb: false });

    await expect(isOpenAtWidth(1280)).resolves.toBe(false);
  });
});
