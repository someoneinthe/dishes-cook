import { removeBrowser, setBrowser } from '@/test/browser';
import { deleteSharedPdfs, shareRecipePdf } from './share-recipe-pdf.web';

// A hidden frame as the browser makes it: it loads (or fails) once added to the page.
function fakeFrame(event: 'error' | 'load', isEmpty = false) {
  const listenerMap = new Map<string, () => void>();
  const printed = {
    createElement: () => ({ textContent: '' }),
    head: { append: jest.fn() },
    title: '',
  };
  const printWindow = { focus: jest.fn(), print: jest.fn() };
  const frame = {
    addEventListener: (name: string, listener: () => void) => listenerMap.set(name, listener),
    contentDocument: isEmpty ? null : printed,
    contentWindow: isEmpty ? null : printWindow,
    remove: jest.fn(),
    setAttribute: jest.fn(),
    srcdoc: '',
    style: {},
  };
  setBrowser({
    document: {
      body: { append: () => listenerMap.get(event)?.() },
      createElement: () => frame,
    },
  });
  return { frame, printed, printWindow };
}

const OPTIONS = {
  dialogTitle: 'Share “Soup”',
  html: '<html><head><title>Soup</title></head><body>Soup</body></html>',
  title: 'Soupe / potiron : maison?',
  units: 'us',
} as const;

describe('sharing a recipe as a PDF in a browser', () => {
  afterEach(() => {
    removeBrowser();
  });

  it('prints the recipe alone, on Letter pages, named after it, then removes the frame', async () => {
    const { frame, printed, printWindow } = fakeFrame('load');

    await shareRecipePdf(OPTIONS);

    expect(frame.srcdoc).toBe(OPTIONS.html);
    expect(printed.head.append).toHaveBeenCalledWith({ textContent: '@page { size: letter; }' });
    expect(printed.title).toBe('Soupe potiron maison');
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(frame.remove).toHaveBeenCalledTimes(1);
  });

  it('fails when the frame can’t load', async () => {
    const { frame } = fakeFrame('error');

    await expect(shareRecipePdf({ ...OPTIONS, units: 'metric' })).rejects.toThrow(
      'Recipe print failed',
    );
    expect(frame.remove).toHaveBeenCalledTimes(1);
  });

  it('fails without a page to print', async () => {
    fakeFrame('load', true);

    await expect(shareRecipePdf(OPTIONS)).rejects.toThrow('Recipe print failed');
  });

  it('keeps no PDF to delete', () => {
    expect(deleteSharedPdfs).not.toThrow();
  });
});
