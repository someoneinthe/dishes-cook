import { strFromU8, unzipSync } from 'fflate';
import type { ScannedBlock, ScannedFrame } from './scanned-recipe';

// Recipes read from a chosen file (useRecipeScan): a photo or a PDF's pages are read by the text
// recognition; a Word, OpenDocument or text file is read here, as blocks of text for the recipe
// reader, one per paragraph, in the document's order. Their letter height comes from the
// paragraph's font size, else its style (title, heading), so the reader finds the title as on a
// photo.

// What a chosen file is, for reading it.
export type DocumentKind = 'docx' | 'image' | 'odt' | 'pdf' | 'text';

// An element of a document's XML: its tag, its opening tag's attributes, its content (XML).
type XmlElement = Readonly<{ attributes: string; content: string; tag: string }>;

// The documents the picker offers, by their type.
const KIND_BY_TYPE: Readonly<Record<string, DocumentKind>> = {
  'application/pdf': 'pdf',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'text',
};

// The file types the picker offers: photos and these documents, and old Word files (.doc), which
// it would show greyed out: chosen, they're refused with how to read them (save them as .docx).
export const DOCUMENT_TYPE_LIST: readonly string[] = [
  'image/*',
  ...Object.keys(KIND_BY_TYPE),
  'application/msword',
];

// Letter heights (points) of a paragraph without a font size: body text, headings, the title.
const BODY_HEIGHT = 11;
const HEADING_HEIGHT = 16;
const TITLE_HEIGHT = 26;
// The largest Unicode code point (&#x10FFFF;).
const MAX_CODE_POINT = 0x10_ff_ff;
// Largest unzipped XML of a document read (bytes): a recipe's is a few KB, a long book's a few
// MB; a small file claiming more is refused rather than filling the phone's memory.
const MAX_XML_SIZE = 20 * 1024 * 1024;
// A text file's first line, its title: larger than the others, as the reader expects.
const TEXT_TITLE_RATIO = 2;
// The gap left between two pages of a PDF, as a share of the first page's height.
const PAGE_GAP_RATIO = 0.05;

const KIND_BY_EXTENSION: Readonly<Record<string, DocumentKind>> = {
  docx: 'docx',
  jpeg: 'image',
  jpg: 'image',
  odt: 'odt',
  pdf: 'pdf',
  png: 'image',
  txt: 'text',
  webp: 'image',
};
const XML_ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

// The pages of a PDF, read one by one, as one page: each page's blocks below the previous page's.
export function joinPages(pageList: readonly (readonly ScannedBlock[])[]): ScannedBlock[] {
  const blockList: ScannedBlock[] = [];
  let top = 0;
  for (const pageBlockList of pageList) {
    const bottomList = pageBlockList.map((block) => block.frame?.bottom ?? 0);
    const pageBottom = Math.max(0, ...bottomList);
    blockList.push(...pageBlockList.map((block) => withTopOffset(block, top)));
    top += pageBottom * (1 + PAGE_GAP_RATIO);
  }
  return blockList;
}

// A Word document (.docx: zipped XML): its paragraphs (w:p), with their size or style.
export function readDocx(bytes: Uint8Array): ScannedBlock[] {
  const xml = readZipEntry(bytes, 'word/document.xml');
  const paragraphList = readElements(xml, ['w:p']).map(({ content: paragraph }) => ({
    height: docxHeight(paragraph),
    text: decodeXml(
      paragraph
        .replaceAll(/<w:(?:tab|br|cr)\b[^>/]*\/>/g, ' ')
        .replaceAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, '\0$1\0')
        .split('\0')
        .filter((_, index) => index % 2 === 1)
        .join(''),
    ),
  }));
  return toBlocks(paragraphList);
}

// An OpenDocument text (.odt: zipped XML): its paragraphs (text:p) and headings (text:h).
export function readOdt(bytes: Uint8Array): ScannedBlock[] {
  const xml = readZipEntry(bytes, 'content.xml');
  const body = xml.slice(Math.max(0, xml.indexOf('<office:body')));
  const paragraphList = readElements(body, ['text:p', 'text:h']).map(
    ({ attributes, content, tag }) => ({
      height: odtHeight(tag, attributes),
      text: decodeXml(stripTags(content.replaceAll(/<text:(?:s|tab|line-break)\b[^>/]*\/>/g, ' '))),
    }),
  );
  return toBlocks(paragraphList);
}

// A plain text file: one block per line, the first line larger (its title).
export function readPlainText(text: string): ScannedBlock[] {
  return toBlocks(text.split(/\r?\n/).map((line) => ({ height: BODY_HEIGHT, text: line })));
}

// What the file is, from its type, else its name's extension; undefined when it can't be read
// (an old .doc, a spreadsheet…).
export function toDocumentKind(
  file: Readonly<{ mimeType?: string; name: string }>,
): DocumentKind | undefined {
  const { mimeType = '' } = file;
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  const byType = KIND_BY_TYPE[mimeType];
  if (byType) {
    return byType;
  }
  const extension = /\.([a-z]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return KIND_BY_EXTENSION[extension];
}

function decodeXml(text: string): string {
  return text.replaceAll(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      // Not a character (beyond Unicode): kept as written rather than failing the whole file.
      return codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : entity;
    }
    return XML_ENTITY_MAP[code] ?? entity;
  });
}

// A Word paragraph's letter height: its largest font size (w:sz, in half points), else its style.
function docxHeight(paragraph: string): number {
  const sizeList = [...paragraph.matchAll(/<w:sz w:val="(\d+)"/g)].map(
    ([, size]) => Number(size) / 2,
  );
  if (sizeList.length > 0) {
    return Math.max(...sizeList);
  }
  const style = /<w:pStyle w:val="([^"]+)"/.exec(paragraph)?.[1] ?? '';
  return styleHeight(style);
}

// `<tag>`, `<tag …>` or `<tag/>` at `index`, not a longer name starting with it (w:pPr for w:p).
function isOpeningTag(xml: string, index: number, tag: string): boolean {
  const next = xml.charAt(index + tag.length + 1);
  return xml.startsWith(tag, index + 1) && (next === '>' || next === '/' || /\s/.test(next));
}

// An OpenDocument paragraph's letter height: a heading's or a title's (by its style's name).
function odtHeight(tag: string, attributes: string): number {
  const style = /text:style-name="([^"]+)"/.exec(attributes)?.[1] ?? '';
  const isHeading = tag === 'text:h';
  return isHeading && styleHeight(style) === BODY_HEIGHT ? HEADING_HEIGHT : styleHeight(style);
}

// The element of `tagList` opening at `index`, if any, and where to look for the next one.
function readElementAt(
  xml: string,
  index: number,
  tagList: readonly string[],
): Readonly<{ element?: XmlElement; next: number }> {
  const tag = tagList.find((name) => isOpeningTag(xml, index, name));
  const openEnd = xml.indexOf('>', index);
  if (tag === undefined || openEnd === -1) {
    return { next: index + 1 };
  }
  const attributes = xml.slice(index + tag.length + 1, openEnd);
  const closeStart = attributes.endsWith('/') ? -1 : xml.indexOf(`</${tag}>`, openEnd);
  if (closeStart === -1) {
    return { element: { attributes, content: '', tag }, next: openEnd };
  }
  return {
    element: { attributes, content: xml.slice(openEnd + 1, closeStart), tag },
    next: closeStart + tag.length + 3,
  };
}

// The elements named in `tagList` (not nested in one another), in the document's order: their
// tag, the attributes of their opening tag and their content (XML). Self-closing ones are empty.
function readElements(xml: string, tagList: readonly string[]): XmlElement[] {
  const elementList: XmlElement[] = [];
  let index = xml.indexOf('<');
  while (index !== -1) {
    const { element, next } = readElementAt(xml, index, tagList);
    if (element) {
      elementList.push(element);
    }
    index = xml.indexOf('<', next);
  }
  return elementList;
}

// The XML file `name` of a zipped document, unzipped only when its stated size is reasonable.
function readZipEntry(bytes: Uint8Array, name: string): string {
  let isTooLarge = false;
  const entry = unzipSync(bytes, {
    filter: (file) => {
      isTooLarge ||= file.name === name && file.originalSize > MAX_XML_SIZE;
      return file.name === name && !isTooLarge;
    },
  })[name];
  if (isTooLarge) {
    throw new Error(`${name} is too large`);
  }
  if (!entry) {
    throw new Error(`No ${name} in the file`);
  }
  return strFromU8(entry);
}

// The text of some XML: its tags left out ("a<b>c</b>" -> "ac").
function stripTags(xml: string): string {
  const [first = '', ...partList] = xml.split('<');
  return first + partList.map((part) => part.slice(part.indexOf('>') + 1)).join('');
}

function styleHeight(style: string): number {
  if (/^title$/i.test(style)) {
    return TITLE_HEIGHT;
  }
  return /heading|titre/i.test(style) ? HEADING_HEIGHT : BODY_HEIGHT;
}

// One block per paragraph that has text. When they're all the same size (a text file, a document
// without styles), the first one is made larger: a document starts with its title.
function toBlocks(paragraphList: readonly Readonly<{ height: number; text: string }>[]) {
  const lineList = paragraphList
    .map((line) => ({ ...line, text: line.text.trim() }))
    .filter((line) => line.text !== '');
  const isFlat = lineList.every((line) => line.height === lineList[0]?.height);
  return lineList.map((line, index): ScannedBlock => ({
    lineList: [isFlat && index === 0 ? { ...line, height: line.height * TEXT_TITLE_RATIO } : line],
  }));
}

function withTopOffset(block: ScannedBlock, top: number): ScannedBlock {
  if (top === 0 || !block.frame) {
    return block;
  }
  const frame: ScannedFrame = {
    ...block.frame,
    bottom: block.frame.bottom + top,
    top: block.frame.top + top,
  };
  return { ...block, frame };
}
