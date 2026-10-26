import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Lists never load more than this many rows per query (see CONTRIBUTING › Lists).
export const PAGE_SIZE = 50;
// Pages kept in memory while scrolling: scrolling back reloads the ones dropped.
export const MAX_PAGES = 2;

// Position of a row in a list sorted by (sort_key, id): pages start right after/before it.
type Cursor = Readonly<{ id: number; sortKey: string }>;

export type Page<T> = Readonly<{
  itemList: T[];
  nextCursor?: Cursor;
  previousCursor?: Cursor;
}>;

// `null`: first page.
export type PageRequest = null | Readonly<{ after: Cursor } | { before: Cursor }>;

type KeysetColumns = Readonly<{ id: SQLiteColumn; sortKey: SQLiteColumn }>;

// True when rows must be read backwards (a page before a cursor).
export function isBackward(pageParameter: PageRequest): boolean {
  return pageParameter !== null && 'before' in pageParameter;
}

// Keyset ("seek") pagination: `WHERE (sort_key, id) > cursor ORDER BY sort_key, id LIMIT n` reads
// the (sort_key, id) index from the cursor on, so every page costs the same, unlike OFFSET. Written
// as a row value: SQLite can't seek with `sort_key > ? OR (sort_key = ? AND id > ?)`, which
// walks the index from its start on every page.
export function keysetWhere(columns: KeysetColumns, pageParameter: PageRequest): SQL | undefined {
  if (!pageParameter) {
    return undefined;
  }
  const isAfter = 'after' in pageParameter;
  const cursor = isAfter ? pageParameter.after : pageParameter.before;
  const operator = sql.raw(isAfter ? '>' : '<');
  return sql`(${columns.sortKey}, ${columns.id}) ${operator} (${cursor.sortKey}, ${cursor.id})`;
}

// Builds the page from rows fetched with LIMIT PAGE_SIZE + 1 (the extra row tells whether there's
// more) in the direction of `pageParam`.
export function toPage<T extends Cursor>(rowList: T[], pageParameter: PageRequest): Page<T> {
  const hasMore = rowList.length > PAGE_SIZE;
  const itemList = rowList.slice(0, PAGE_SIZE);
  if (isBackward(pageParameter)) {
    itemList.reverse();
    return {
      itemList,
      nextCursor: toCursor(itemList.at(-1)),
      previousCursor: hasMore ? toCursor(itemList[0]) : undefined,
    };
  }
  return {
    itemList,
    nextCursor: hasMore ? toCursor(itemList.at(-1)) : undefined,
    previousCursor: pageParameter ? toCursor(itemList[0]) : undefined,
  };
}

function toCursor(row: Cursor | undefined): Cursor | undefined {
  return row && { id: row.id, sortKey: row.sortKey };
}
