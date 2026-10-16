import type { ScannedBlock } from './recipe-from-text';
import { toReadingOrder } from './page-layout';

// A one-line block at (left, top), 20 high and 10 wide per letter.
function block(text: string, left: number, top: number): ScannedBlock {
  return {
    frame: { bottom: top + 20, left, right: left + text.length * 10, top },
    lineList: [{ height: 20, text }],
  };
}

// The text of the blocks in reading order, lines joined with " / ".
function readingOrder(blockList: readonly ScannedBlock[]): string[] {
  return toReadingOrder(blockList).map(({ lineList }) =>
    lineList.map(({ text }) => text).join(' / '),
  );
}

describe('page-layout', () => {
  it('puts the blocks in rows from top to bottom, each row from left to right', () => {
    const blockList = [
      block('Step one', 0, 300),
      block('pepper', 400, 102),
      block('Ingredients', 0, 0),
      block('salt', 0, 100),
      block('Method', 0, 200),
    ];

    expect(readingOrder(blockList)).toStrictEqual([
      'Ingredients',
      'salt',
      'pepper',
      'Method',
      'Step one',
    ]);
  });

  it('numbers the rows', () => {
    const blockList = [block('salt', 0, 100), block('Ingredients', 0, 0), block('pepper', 400, 98)];

    expect(toReadingOrder(blockList).map(({ row }) => row)).toStrictEqual([0, 1, 1]);
  });

  it('joins one-line blocks that touch on a row', () => {
    const blockList = [block('garni', 80, 0), block('bouquet', 0, 2), block('salt', 400, 0)];

    expect(readingOrder(blockList)).toStrictEqual(['bouquet garni', 'salt']);
  });

  it('keeps the given order without positions', () => {
    const lineList = [{ height: 20, text: 'salt' }];
    const heading = block('Ingredients', 0, 0);

    expect(toReadingOrder([{ lineList }, heading])).toStrictEqual([
      { lineList, row: 0 },
      { ...heading, row: 1 },
    ]);
  });
});
