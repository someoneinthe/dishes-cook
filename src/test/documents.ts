import { strToU8, zipSync } from 'fflate';

// Small documents for the tests of a recipe read from a file: their zipped XML, as the apps write it.

// An OpenDocument text (.odt): a heading, then its paragraphs.
export function openDocument(titleText: string, paragraphList: readonly string[]): Uint8Array {
  const body = [
    `<text:h text:outline-level="1">${titleText}</text:h>`,
    ...paragraphList.map((text) => `<text:p>${text}</text:p>`),
  ].join('');
  return zipSync({
    'content.xml': strToU8(
      `<office:document-content><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
    ),
  });
}

// A Word document (.docx): its paragraphs, the first one in the Title style.
export function wordDocument(titleText: string, paragraphList: readonly string[]): Uint8Array {
  const paragraph = (text: string, style = '') =>
    `<w:p><w:pPr>${style}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const body = [
    paragraph(titleText, '<w:pStyle w:val="Title"/>'),
    ...paragraphList.map((text) => paragraph(text)),
  ].join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(`<w:document><w:body>${body}</w:body></w:document>`),
  });
}
