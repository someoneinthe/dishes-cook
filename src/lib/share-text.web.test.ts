import { removeBrowser, setBrowser } from '@/test/browser';
import { isCancelled, shareText } from './share-text.web';

// What a browser rejects with: a DOMException's name.
const domError = (name: string) => new DOMException(name, name);

describe('sharing a text in a browser', () => {
  afterEach(() => {
    removeBrowser();
  });

  it('uses the browser’s share sheet when it has one', async () => {
    const share = jest.fn(() => Promise.resolve());
    setBrowser({ navigator: { share } });

    await expect(shareText('Leeks')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'Leeks' });
  });

  it('copies the text otherwise', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    setBrowser({ navigator: { clipboard: { writeText } } });

    await expect(shareText('Leeks')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Leeks');
  });

  it('copies the text when the share sheet refuses it, not when it’s closed', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    const share = jest.fn(() => Promise.reject(domError('NotAllowedError')));
    setBrowser({ navigator: { clipboard: { writeText }, share } });

    await expect(shareText('Leeks')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Leeks');

    share.mockRejectedValueOnce(domError('AbortError'));
    const closed = shareText('Leeks');

    await expect(closed).rejects.toThrow('AbortError');
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('tells a closed share sheet from a failure', () => {
    expect(isCancelled(domError('AbortError'))).toBe(true);
    expect(isCancelled(domError('NotAllowedError'))).toBe(false);
    expect(isCancelled('AbortError')).toBe(false);
  });
});
