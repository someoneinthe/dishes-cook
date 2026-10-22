import { strToU8, zipSync } from 'fflate';
import { joinPages, readDocx, readOdt, readPlainText, toDocumentKind } from './recipe-documents';
import { readRecipeText } from './recipe-from-text';

// A Word document: its paragraphs' XML in word/document.xml.
function docx(paragraphXml: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(
      `<?xml version="1.0"?><w:document><w:body>${paragraphXml}</w:body></w:document>`,
    ),
  });
}

function odt(bodyXml: string): Uint8Array {
  return zipSync({
    'content.xml': strToU8(
      `<office:document-content><office:automatic-styles><text:p>Not text</text:p></office:automatic-styles><office:body><office:text>${bodyXml}</office:text></office:body></office:document-content>`,
    ),
    mimetype: strToU8('application/vnd.oasis.opendocument.text'),
  });
}

const paragraph = (text: string, properties = '') =>
  `<w:p><w:pPr>${properties}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

describe('recipe documents', () => {
  it('tells a file’s kind by its type, else its name', () => {
    expect(toDocumentKind({ mimeType: 'image/jpeg', name: 'IMG_1.jpg' })).toBe('image');
    expect(toDocumentKind({ mimeType: 'application/pdf', name: 'tarte.pdf' })).toBe('pdf');
    expect(toDocumentKind({ name: 'Tarte.DOCX' })).toBe('docx');
    expect(toDocumentKind({ mimeType: 'application/octet-stream', name: 'tarte.odt' })).toBe('odt');
    expect(toDocumentKind({ name: 'old.doc' })).toBeUndefined();
  });

  it('reads a Word recipe: the title by its style, the ingredients and the steps', () => {
    const paragraphXml = [
      paragraph('Tarte aux pommes', '<w:pStyle w:val="Title"/>'),
      paragraph('Ingrédients', '<w:pStyle w:val="Heading1"/>'),
      paragraph('3 pommes'),
      paragraph('200 g de farine'),
      paragraph('Préparation', '<w:pStyle w:val="Heading1"/>'),
      paragraph('Cuire 30 min &amp; servir.'),
    ].join('');
    const recipe = readRecipeText(readDocx(docx(paragraphXml)));

    expect(recipe.title).toBe('Tarte aux pommes');
    expect(recipe.ingredientList).toStrictEqual([
      { name: 'pommes', quantity: { amount: 3 } },
      { name: 'farine', quantity: { amount: 200, unit: 'g' } },
    ]);
    expect(recipe.instructions).toBe('Cuire 30 min & servir.');
  });

  it('reads a Word paragraph’s font size, and joins its runs', () => {
    const [title, line] = readDocx(
      docx(
        `<w:p><w:r><w:rPr><w:sz w:val="48"/></w:rPr><w:t>Big</w:t></w:r><w:r><w:t> title</w:t></w:r></w:p>${paragraph('Body')}`,
      ),
    );

    expect(title?.lineList).toStrictEqual([{ height: 24, text: 'Big title' }]);
    expect(line?.lineList).toStrictEqual([{ height: 11, text: 'Body' }]);
  });

  it('reads an OpenDocument recipe: headings, paragraphs and their spans', () => {
    const bodyXml = [
      '<text:p text:style-name="Title">Soupe <text:span>de</text:span> poireaux</text:p>',
      '<text:h text:outline-level="1">Ingrédients</text:h>',
      '<text:list><text:list-item><text:p>2 poireaux</text:p></text:list-item></text:list>',
      '<text:h text:outline-level="1">Préparation</text:h>',
      '<text:p>Couper<text:s/>et cuire.</text:p>',
    ].join('');
    const recipe = readRecipeText(readOdt(odt(bodyXml)));

    expect(recipe.title).toBe('Soupe de poireaux');
    expect(recipe.ingredientList).toStrictEqual([{ name: 'poireaux', quantity: { amount: 2 } }]);
    expect(recipe.instructions).toBe('Couper et cuire.');
  });

  it('reads a text file: its first line is the title', () => {
    const recipe = readRecipeText(
      readPlainText('Mojito\r\n\r\nIngredients\n10 cl rum\nMethod\nStir.\n'),
    );

    expect(recipe.title).toBe('Mojito');
    expect(recipe.ingredientList).toStrictEqual([
      { name: 'rum', quantity: { amount: 10, unit: 'cl' } },
    ]);
  });

  it('keeps a character code beyond Unicode as written, rather than failing', () => {
    const [block] = readDocx(docx(paragraph('Sel &#x110000; &#233;pices')));

    expect(block?.lineList[0]?.text).toBe('Sel &#x110000; épices');
  });

  it('refuses a document whose XML would unzip to more than 20 MB', () => {
    const bomb = zipSync({ 'word/document.xml': new Uint8Array(21 * 1024 * 1024) });

    expect(() => readDocx(bomb)).toThrow('too large');
  });

  it('fails on a zip that isn’t a document', () => {
    expect(() => readDocx(zipSync({ 'other.xml': strToU8('<x/>') }))).toThrow('word/document.xml');
  });

  it('puts a PDF’s pages one below the other', () => {
    const frame = { bottom: 100, left: 0, right: 50, top: 80 };
    const blockList = joinPages([
      [{ frame, lineList: [{ height: 10, text: 'Page 1' }] }],
      [{ frame, lineList: [{ height: 10, text: 'Page 2' }] }, { lineList: [] }],
    ]);

    expect(blockList.map((block) => block.frame?.top)).toStrictEqual([80, 185, undefined]);
  });
});
