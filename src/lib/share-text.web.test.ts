import { removeBrowser, setBrowser } from '@/test/browser';
import { shareText } from './share-text.web';

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
});
