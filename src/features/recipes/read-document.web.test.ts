import { getDocument } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { removeBrowser, setBrowser } from '@/test/browser';
import { openDocument, wordDocument } from '@/test/documents';
import { deletePickerCopies, readDocument } from './read-document.web';

// Tesseract's result for a page: a title on its own row, then a short line.
const recognized = (rowHeight: number) => ({
  data: {
    blocks: [
      {
        bbox: { x0: 0, x1: 400, y0: 0, y1: 120 },
        paragraphs: [
          {
            lines: [
              {
                bbox: { x0: 0, x1: 400, y0: 0, y1: 60 },
                rowAttributes: { rowHeight },
                text: 'Gratin dauphinois\n',
              },
              {
                bbox: { x0: 0, x1: 100, y0: 80, y1: 100 },
                rowAttributes: { rowHeight: 0 },
                text: ' ',
              },
            ],
          },
        ],
      },
    ],
  },
});

jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }));

// pdf.js draws two pages; the canvas they're drawn on is the browser's.
jest.mock('pdfjs-dist', () => ({ getDocument: jest.fn(), GlobalWorkerOptions: {} }));

describe('reading a document in a browser', () => {
  const worker = { recognize: jest.fn(), terminate: jest.fn(() => Promise.resolve()) };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createWorker).mockResolvedValue(worker as never);
    worker.recognize.mockResolvedValue(recognized(48));
    setBrowser({
      document: { createElement: () => ({ height: 0, width: 0 }) },
      location: { origin: 'https://recipes.example.org' },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    removeBrowser();
  });

  const fetched = (body: BodyInit) =>
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));

  it('reads a photo with Tesseract, from the app’s own files, by its row heights', async () => {
    fetched(new Blob(['png']));

    const { blockList, isLevel } = await readDocument('blob:photo', 'image');

    expect(createWorker).toHaveBeenCalledWith(
      ['fra', 'eng'],
      1,
      expect.objectContaining({
        corePath: 'https://recipes.example.org/ocr/',
        workerPath: 'https://recipes.example.org/ocr/worker.min.js',
      }),
    );
    expect(isLevel).toBe(false);
    expect(blockList).toStrictEqual([
      {
        frame: { bottom: 120, left: 0, right: 400, top: 0 },
        lineList: [{ height: 48, text: 'Gratin dauphinois' }],
      },
    ]);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('measures a line by its box when Tesseract has no row height', async () => {
    fetched(new Blob(['png']));
    worker.recognize.mockResolvedValue(recognized(0));

    const { blockList } = await readDocument('blob:photo', 'image');

    expect(blockList[0]?.lineList[0]?.height).toBe(60);
  });

  it('reads the first pages of a PDF, drawn by pdf.js', async () => {
    fetched(new Blob(['%PDF']));
    const page = {
      cleanup: jest.fn(),
      getViewport: ({ scale }: { scale: number }) => ({ height: 842 * scale, width: 595 * scale }),
      render: jest.fn((_options: unknown) => ({ promise: Promise.resolve() })),
    };
    const destroy = jest.fn(() => Promise.resolve());
    jest.mocked(getDocument).mockReturnValue({
      destroy,
      promise: Promise.resolve({ getPage: jest.fn(() => Promise.resolve(page)), numPages: 7 }),
    } as never);

    const { blockList, isCut, isLevel } = await readDocument('blob:pdf', 'pdf');

    // Five pages of seven, at 1600 pixels wide.
    expect(page.render).toHaveBeenCalledTimes(5);
    expect(page.render.mock.calls[0]?.[0]).toMatchObject({ canvas: { height: 2264, width: 1600 } });
    expect({ isCut, isLevel }).toStrictEqual({ isCut: true, isLevel: true });
    expect(blockList[0]?.lineList[0]).toStrictEqual({ height: 60, text: 'Gratin dauphinois' });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('draws a very tall page smaller, within what a browser can draw', async () => {
    fetched(new Blob(['%PDF']));
    const page = {
      cleanup: jest.fn(),
      // A receipt-like page, 100 times taller than wide.
      getViewport: ({ scale }: { scale: number }) => ({
        height: 50_000 * scale,
        width: 500 * scale,
      }),
      render: jest.fn((_options: unknown) => ({ promise: Promise.resolve() })),
    };
    jest.mocked(getDocument).mockReturnValue({
      destroy: jest.fn(() => Promise.resolve()),
      promise: Promise.resolve({ getPage: jest.fn(() => Promise.resolve(page)), numPages: 1 }),
    } as never);

    await readDocument('blob:pdf', 'pdf');

    expect(page.render.mock.calls[0]?.[0]).toMatchObject({
      canvas: { height: 32_767, width: 328 },
    });
  });

  it('lets the PDF go when the text recognition can’t start', async () => {
    fetched(new Blob(['%PDF']));
    const destroy = jest.fn(() => Promise.resolve());
    jest.mocked(getDocument).mockReturnValue({
      destroy,
      promise: Promise.resolve({ getPage: jest.fn(), numPages: 1 }),
    } as never);
    jest.mocked(createWorker).mockRejectedValueOnce(new Error('No engine'));

    await expect(readDocument('blob:pdf', 'pdf')).rejects.toThrow('No engine');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reads Word, OpenDocument and text files by itself', async () => {
    const docx = new Uint8Array(wordDocument('Soupe', ['Ingrédients']));
    fetched(new Blob([docx]));

    await expect(readDocument('blob:docx', 'docx')).resolves.toMatchObject({ isLevel: true });

    const odt = new Uint8Array(openDocument('Soupe', ['Ingrédients']));
    fetched(new Blob([odt]));

    await expect(readDocument('blob:odt', 'odt')).resolves.toMatchObject({ isCut: false });

    fetched('Soupe\nIngrédients');
    const { blockList } = await readDocument('blob:txt', 'text');

    expect(blockList.flatMap(({ lineList }) => lineList.map(({ text }) => text))).toContain(
      'Soupe',
    );
    expect(createWorker).not.toHaveBeenCalled();
  });

  it('has no picker copies to delete', () => {
    expect(deletePickerCopies).not.toThrow();
  });
});
