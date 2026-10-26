import type { ScannedBlock, ScannedFrame } from './scanned-recipe';

// Text recognition doesn't give its blocks in reading order (on a recipe website, a step may come
// before the menu). This puts them back in reading order from where they are on the page: rows
// from top to bottom, each row from left to right. A row gathers the blocks whose middle is beside
// the row's first block: side-by-side columns and grid cards ("100 g / de beurre", "poivre"…).

// A block in reading order, and its row (blocks side by side share one).
type OrderedBlock = Readonly<{ row: number }> & ScannedBlock;

type Framed = Readonly<{ block: ScannedBlock; frame: ScannedFrame }>;

// Two one-line blocks on a row closer than this many letter heights are one line ("bouquet" and
// "garni" read apart).
const SAME_LINE_GAP = 1;
// A block starting beside a row's first block, up to this many times its height, is in the row: a
// card's two lines beside a one-line card. A taller one (a column of text) only when its middle is.
const SAME_ROW_HEIGHT_RATIO = 3;

export function toReadingOrder(blockList: readonly ScannedBlock[]): OrderedBlock[] {
  const framedList: Framed[] = [];
  for (const block of blockList) {
    if (block.frame) {
      framedList.push({ block, frame: block.frame });
    }
  }
  // Without positions (tests, older readings), the given order is the best there is.
  if (framedList.length < blockList.length) {
    return blockList.map((block, row) => ({ ...block, row }));
  }
  const byTopList = [...framedList].sort((first, second) => first.frame.top - second.frame.top);
  const rowList: Framed[][] = [];
  for (const framed of byTopList) {
    const lastRowList = rowList.at(-1);
    const anchor = lastRowList?.[0]?.frame;
    if (lastRowList && anchor && isInRow(framed.frame, anchor)) {
      lastRowList.push(framed);
    } else {
      rowList.push([framed]);
    }
  }
  return rowList.flatMap((rowBlockList, row) =>
    joinSameLine(
      [...rowBlockList].sort((first, second) => first.frame.left - second.frame.left),
    ).map((block) => ({ ...block, row })),
  );
}

// Whether a block (below the row's first block or level with it) is beside that first block.
function isInRow(frame: ScannedFrame, anchor: ScannedFrame): boolean {
  const height = frame.bottom - frame.top;
  const isCardSize = height < SAME_ROW_HEIGHT_RATIO * (anchor.bottom - anchor.top);
  return (
    (frame.top + frame.bottom) / 2 <= anchor.bottom || (isCardSize && frame.top < anchor.bottom)
  );
}

// The two blocks as one line, when both are one line close to each other.
function joinIfSameLine(left: Framed, right: Framed): Framed | undefined {
  const [leftLine, ...leftRestList] = left.block.lineList;
  const [rightLine, ...rightRestList] = right.block.lineList;
  if (!leftLine || !rightLine || leftRestList.length > 0 || rightRestList.length > 0) {
    return undefined;
  }
  const height = Math.max(leftLine.height, rightLine.height);
  if (right.frame.left - left.frame.right >= SAME_LINE_GAP * height) {
    return undefined;
  }
  const frame = { ...left.frame, right: right.frame.right };
  return {
    block: { frame, lineList: [{ height, text: `${leftLine.text} ${rightLine.text}` }] },
    frame,
  };
}

// The blocks of a row, from left to right, with one-line neighbours that touch joined in one.
function joinSameLine(rowBlockList: readonly Framed[]): ScannedBlock[] {
  const joinedList: Framed[] = [];
  for (const framed of rowBlockList) {
    const previous = joinedList.at(-1);
    const joined = previous && joinIfSameLine(previous, framed);
    if (joined) {
      joinedList[joinedList.length - 1] = joined;
    } else {
      joinedList.push(framed);
    }
  }
  return joinedList.map(({ block }) => block);
}
