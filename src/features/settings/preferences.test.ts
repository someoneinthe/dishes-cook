import Storage from 'expo-sqlite/kv-store';
import type * as PreferencesModule from './preferences';

describe('preferences', () => {
  const loadPreferences = () => {
    let module: typeof PreferencesModule | undefined;
    jest.isolateModules(() => {
      module = jest.requireActual<typeof PreferencesModule>('./preferences');
    });
    return module!;
  };

  beforeEach(() => {
    Storage.setItemSync('preferences', '');
  });

  it('starts from the defaults', () => {
    expect(loadPreferences().getPreferences()).toStrictEqual({
      colorScheme: 'system',
      isShowingButtonLabels: false,
    });
  });

  it('keeps the changes for the next launch', () => {
    loadPreferences().updatePreferences({ isShowingButtonLabels: true });

    expect(loadPreferences().getPreferences()).toStrictEqual({
      colorScheme: 'system',
      isShowingButtonLabels: true,
    });
  });

  it('keeps the saved preferences when they cannot be stored', () => {
    const preferences = loadPreferences();
    jest.spyOn(Storage, 'setItemSync').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => preferences.updatePreferences({ isShowingButtonLabels: true })).toThrow(
      'disk full',
    );
    expect(preferences.getPreferences().isShowingButtonLabels).toBe(false);
  });

  it('ignores unreadable or unknown stored values', () => {
    Storage.setItemSync('preferences', '{"colorScheme":"sepia"');

    expect(loadPreferences().getPreferences().colorScheme).toBe('system');

    Storage.setItemSync('preferences', '{"colorScheme":"sepia","isShowingButtonLabels":"yes"}');

    expect(loadPreferences().getPreferences()).toStrictEqual({
      colorScheme: 'system',
      isShowingButtonLabels: false,
    });
  });
});
