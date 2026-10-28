import type { Bbox, Page, Worker } from 'tesseract.js';
import type { DocumentKind } from './recipe-documents';
import type { ScannedBlock, ScannedLine } from './scanned-recipe';
import { joinPages, readDocx, readOdt, readPlainText } from './recipe-documents';

// The text of a chosen file in a browser, as blocks for the recipe reader, like on a phone
// (read-document.ts): photos and PDF pages by Tesseract.js (in English and French) instead of
// ML Kit, PDFs drawn by pdf.js instead of Android. Both are loaded only when a photo or a PDF is
// read, from the app's own files (public/ocr/, scripts/web-ocr-files.mjs): nothing is sent anywhere.

export const MAX_PDF_PAGES = 5;
const PDF_PAGE_WIDTH = 1600;
// Tesseract's languages: French first, the recipes' language here, English too.
const LANGUAGES = ['fra', 'eng'];
// Tesseract's mode: its neural network only (the engine files copied are the "lstm" ones).
const LSTM_ONLY = 1;

// A browser's file picker keeps no copy: nothing to delete.
export function deletePickerCopies(): void {}

export async function readDocument(
  uri: string,
  kind: DocumentKind,
): Promise<Readonly<{ blockList: ScannedBlock[]; isCut: boolean; isLevel: boolean }>> {
  switch (kind) {
    case 'docx': {
      return { blockList: readDocx(await readBytes(uri)), isCut: false, isLevel: true };
    }
    case 'image': {
      return { blockList: await readImage(uri), isCut: false, isLevel: false };
    }
    case 'odt': {
      return { blockList: readOdt(await readBytes(uri)), isCut: false, isLevel: true };
    }
    case 'pdf': {
      return readPdf(uri);
    }
    case 'text': {
      const response = await fetch(uri);
      return { blockList: readPlainText(await response.text()), isCut: false, isLevel: true };
    }
  }
}

function boxHeight({ y0, y1 }: Bbox): number {
  return y1 - y0;
}

function middleHeight(heightList: readonly number[], lineBox: Bbox): number {
  const sortedList = [...heightList].sort((first, second) => first - second);
  return sortedList[Math.floor(sortedList.length / 2)] ?? boxHeight(lineBox);
}

// The site's address of a text recognition file (absolute: Tesseract's worker runs from a blob).
function ocrFile(name: string): string {
  return new URL(`/ocr/${name}`, location.origin).href;
}

async function readBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  return new Uint8Array(await response.arrayBuffer());
}

async function readImage(uri: string): Promise<ScannedBlock[]> {
  const worker = await startTextRecognition();
  try {
    const response = await fetch(uri);
    const { data } = await worker.recognize(await response.blob(), {}, { blocks: true });
    return toScannedBlocks(data, false);
  } finally {
    await worker.terminate();
  }
}

// A PDF's first pages, drawn then read one after the other.
async function readPdf(uri: string) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = ocrFile('pdf.worker.min.mjs');
  const loading = pdfjs.getDocument({ data: await readBytes(uri) });
  const pdf = await loading.promise;
  const worker = await startTextRecognition();
  try {
    const pageList: ScannedBlock[][] = [];
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    for (let number = 1; number <= pageCount; number += 1) {
      // eslint-disable-next-line no-await-in-loop -- one page at a time: each holds a large image
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({
        scale: PDF_PAGE_WIDTH / page.getViewport({ scale: 1 }).width,
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // eslint-disable-next-line no-await-in-loop -- one page at a time
      await page.render({ canvas, viewport }).promise;
      // eslint-disable-next-line no-await-in-loop -- one page at a time
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      pageList.push(toScannedBlocks(data, true));
      page.cleanup();
    }
    return { blockList: joinPages(pageList), isCut: pdf.numPages > MAX_PDF_PAGES, isLevel: true };
  } finally {
    await worker.terminate();
    await loading.destroy();
  }
}

// Tesseract's worker, from the app's own files; terminated once the document is read (it holds its
// languages' data, tens of MB).
async function startTextRecognition(): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker(LANGUAGES, LSTM_ONLY, {
    // The browser's cache keeps the files; Tesseract's own (IndexedDB) would store another copy.
    cacheMethod: 'none',
    corePath: ocrFile(''),
    gzip: true,
    langPath: ocrFile(''),
    workerPath: ocrFile('worker.min.js'),
  });
}

function toFrame({ x0, x1, y0, y1 }: Bbox) {
  return { bottom: y1, left: x0, right: x1, top: y0 };
}

// Tesseract's result as the recipe reader takes it (see toScannedBlocks in read-document.ts): the
// height of a photo's lines is their words' middle height (a slanted photo makes a long line's box
// taller than its letters), a PDF page's their box's.
function toScannedBlocks(page: Page, isLevel: boolean): ScannedBlock[] {
  return (page.blocks ?? []).map((block) => ({
    frame: toFrame(block.bbox),
    lineList: block.paragraphs
      .flatMap((paragraph) => paragraph.lines)
      .map((line): ScannedLine => ({
        height: isLevel
          ? boxHeight(line.bbox)
          : middleHeight(
              line.words.map(({ bbox }) => boxHeight(bbox)),
              line.bbox,
            ),
        text: line.text.trim(),
      }))
      .filter((line) => line.text !== ''),
  }));
}
