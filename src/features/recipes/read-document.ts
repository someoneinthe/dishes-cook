import type { Rect, Text, TextLine } from '@infinitered/react-native-mlkit-text-recognition';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { Directory, File } from 'expo-file-system';
import { renderPdfPages } from '@/lib/pdf-pages';
import type { DocumentKind } from './recipe-documents';
import type { ScannedBlock } from './scanned-recipe';
import { joinPages, readDocx, readOdt, readPlainText } from './recipe-documents';

// Pages of a PDF read: a recipe often runs onto a second page; more would be a cookbook.
export const MAX_PDF_PAGES = 5;
// Width of a rendered PDF page, in pixels: about a sharp phone photo's, for the text recognition.
const PDF_PAGE_WIDTH = 1600;

// A copy that can't be deleted stays in the cache, which Android clears when it needs room.
export function deleteFolder(folder: Directory) {
  try {
    if (folder.exists) {
      folder.delete();
    }
  } catch {
    // Nothing the user can do about it: the recipe was read all the same.
  }
}

// The text of a chosen file, as blocks for the recipe reader, all on the phone: a photo and a PDF's
// pages by the text recognition, the other documents by reading them. `isCut`: a PDF with more
// than MAX_PDF_PAGES pages, of which only the first ones were read. `isLevel`: not a photo, so not
// slanted (see readRecipeText).
export async function readDocument(
  uri: string,
  kind: DocumentKind,
): Promise<Readonly<{ blockList: ScannedBlock[]; isCut: boolean; isLevel: boolean }>> {
  switch (kind) {
    case 'docx': {
      return { blockList: readDocx(await new File(uri).bytes()), isCut: false, isLevel: true };
    }
    case 'image': {
      return { blockList: toScannedBlocks(await recognizeText(uri)), isCut: false, isLevel: false };
    }
    case 'odt': {
      return { blockList: readOdt(await new File(uri).bytes()), isCut: false, isLevel: true };
    }
    case 'pdf': {
      return readPdf(uri);
    }
    case 'text': {
      return { blockList: readPlainText(await new File(uri).text()), isCut: false, isLevel: true };
    }
  }
}

// The text recognition's result as the recipe reader takes it: blocks of lines, where they are on
// the page, and the height of their letters. On a photo, the middle height of their words: a
// slanted photo makes a long line's box taller than its letters. On a page drawn from a PDF
// (`isLevel`), never slanted, the line's box: from its tallest letter to its lowest, where a word's
// box only spans its own letters ("aux" is shorter than "Ingrédients" in a smaller font).
export function toScannedBlocks(text: Text, isLevel = false): ScannedBlock[] {
  return text.blocks.map((block) => ({
    frame: block.frame,
    lineList: block.lines.map((line) => ({
      height: isLevel ? frameHeight(line.frame) : letterHeight(line),
      text: line.text,
    })),
  }));
}

function frameHeight({ bottom, top }: Rect): number {
  return bottom - top;
}

function letterHeight(line: TextLine): number {
  const heightList = line.elements.map(({ frame }) => frameHeight(frame));
  const sortedList = [...heightList].sort((first, second) => first - second);
  return sortedList[Math.floor(sortedList.length / 2)] ?? frameHeight(line.frame);
}

// A PDF's first pages, rendered then read one after the other; the images are deleted once read.
async function readPdf(uri: string) {
  const { folderUri, pageCount, pageUriList } = await renderPdfPages(
    uri,
    MAX_PDF_PAGES,
    PDF_PAGE_WIDTH,
  );
  try {
    const pageList: ScannedBlock[][] = [];
    for (const pageUri of pageUriList) {
      // eslint-disable-next-line no-await-in-loop -- one page at a time: each recognition holds a large image in memory
      pageList.push(toScannedBlocks(await recognizeText(pageUri), true));
    }
    return { blockList: joinPages(pageList), isCut: pageCount > MAX_PDF_PAGES, isLevel: true };
  } finally {
    deleteFolder(new Directory(folderUri));
  }
}
