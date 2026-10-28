import { removeBrowser, setBrowser } from '@/test/browser';
import { deleteSyncToken, getSyncToken, setSyncToken } from './sync-token.web';

describe('the sign-in token in a browser', () => {
  beforeEach(() => {
    const itemMap = new Map<string, string>();
    setBrowser({
      localStorage: {
        getItem: (key: string) => itemMap.get(key) ?? null,
        removeItem: (key: string) => itemMap.delete(key),
        setItem: (key: string, value: string) => itemMap.set(key, value),
      },
    });
  });

  afterEach(() => {
    removeBrowser();
  });

  it('is kept in the site’s storage until deleted', async () => {
    expect(getSyncToken()).toBeNull();

    setSyncToken('token-1');

    expect(getSyncToken()).toBe('token-1');

    await deleteSyncToken();

    expect(getSyncToken()).toBeNull();
  });
});
