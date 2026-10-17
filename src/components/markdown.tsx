import type { MarkedToken, Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import { lexer } from 'marked';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';

type MarkdownProps = Readonly<{ text: string }>;

// Renders Markdown written by the user with native components only (no WebView, no HTML):
// - raw HTML is shown as typed, never interpreted;
// - images are never loaded (no network request), their description is shown instead;
// - links don't open (for now): only their text is shown.
// Line breaks are kept as typed, like the plain text recipes were shown before.
// Text from anywhere (pasted, or synced from another phone) can't freeze or crash the screen: only
// its start is formatted (the time to parse grows faster than the text), and so many blocks or
// list items that drawing them would take long, or formatting nested too deep (quotes in
// quotes…), are shown as typed.
export function Markdown({ text }: MarkdownProps) {
  const cut = formattedLength(text);
  // The line break the cut is on is dropped; the rest keeps its indentation.
  const rest = text.slice(cut).replace(/^\r?\n/, '');
  const tokenList = parse(text.slice(0, cut)) ?? [];
  const drawnCount = drawnTokenCount(tokenList);
  const undrawn = tokenList
    .slice(drawnCount)
    .map((token) => token.raw)
    .join('');
  // Not formatted at all when the text can't be parsed.
  const asTyped = tokenList.length === 0 ? text : [undrawn, rest].filter(Boolean).join('\n');
  return (
    <View style={styles.container}>
      {renderBlockList(tokenList.slice(0, drawnCount), 0)}
      {asTyped.trim() ? <PlainText text={asTyped} /> : null}
    </View>
  );
}

// Characters formatted at most: a long recipe is a few thousand. What follows is shown as typed.
const MAX_FORMATTED_LENGTH = 10_000;
// Blocks, list items and table cells drawn at most (each is native views; inline formatting is
// drawn inside its block's text): a dense list within MAX_FORMATTED_LENGTH would make
// thousands. What follows is shown as typed.
const MAX_DRAWN_PIECES = 1000;

// How many of the top-level tokens are drawn: while their pieces fit in MAX_DRAWN_PIECES.
function drawnTokenCount(tokenList: readonly Token[]): number {
  let pieceCount = 0;
  for (const [index, token] of tokenList.entries()) {
    pieceCount += pieceCountOf(token);
    if (pieceCount > MAX_DRAWN_PIECES) {
      return index;
    }
  }
  return tokenList.length;
}

// A token and the blocks drawn inside it: list items and their blocks, quoted blocks, table cells.
function pieceCountOf(token: Token): number {
  const markedToken = token as MarkedToken;
  switch (markedToken.type) {
    case 'blockquote':
    case 'list_item': {
      return markedToken.tokens.reduce((count, child) => count + pieceCountOf(child), 1);
    }
    case 'list': {
      return markedToken.items.reduce((count, item) => count + pieceCountOf(item), 1);
    }
    case 'table': {
      return 1 + markedToken.header.length * (markedToken.rows.length + 1);
    }
    default: {
      return 1;
    }
  }
}
// Levels of nested formatting drawn: deeper, the text is shown as typed.
const MAX_DEPTH = 8;

// Up to the last line break before the limit, so a paragraph isn't cut in the middle.
function formattedLength(text: string): number {
  if (text.length <= MAX_FORMATTED_LENGTH) {
    return text.length;
  }
  const lineBreak = text.lastIndexOf('\n', MAX_FORMATTED_LENGTH);
  return lineBreak > 0 ? lineBreak : MAX_FORMATTED_LENGTH;
}

// undefined when the text can't be parsed (nested so deep that the parser runs out of stack).
function parse(text: string): Token[] | undefined {
  try {
    return lexer(text);
  } catch {
    return undefined;
  }
}

function PlainText({ text }: Readonly<{ text: string }>) {
  return (
    <Text selectable={isSelectable} style={styles.text}>
      {text.trimEnd()}
    </Text>
  );
}

// Text can be selected to copy it, except on a TV: there, selectable text takes the remote's focus
// and its arrows move a cursor in the text instead of scrolling the recipe.
const isSelectable = !isTv;

// Checkboxes are drawn by their list item, link definitions by their links.
const HIDDEN_BLOCK_TYPE_SET = new Set(['checkbox', 'def', 'space']);

function Block({ depth, token }: Readonly<{ depth: number; token: Token }>) {
  if (HIDDEN_BLOCK_TYPE_SET.has(token.type)) {
    return null;
  }
  if (depth > MAX_DEPTH) {
    return <PlainText text={token.raw} />;
  }
  // `Token` also allows extension tokens of any type: shown as typed (`default`).
  const markedToken = token as MarkedToken;
  switch (markedToken.type) {
    case 'blockquote': {
      return <View style={styles.quote}>{renderBlockList(markedToken.tokens, depth + 1)}</View>;
    }
    case 'code': {
      return (
        <Text selectable={isSelectable} style={styles.codeBlock}>
          {markedToken.text}
        </Text>
      );
    }
    case 'heading': {
      return (
        <Text accessibilityRole="header" selectable={isSelectable} style={styles.heading}>
          {renderInlineList(markedToken.tokens, depth)}
        </Text>
      );
    }
    case 'hr': {
      return <View style={styles.rule} />;
    }
    case 'list': {
      return <List depth={depth} list={markedToken} />;
    }
    case 'paragraph':
    case 'text': {
      return (
        <Text selectable={isSelectable} style={styles.text}>
          {markedToken.tokens ? renderInlineList(markedToken.tokens, depth) : markedToken.text}
        </Text>
      );
    }
    case 'table': {
      return <Table depth={depth} table={markedToken} />;
    }
    default: {
      // Raw HTML and anything else: the text as typed.
      return (
        <Text selectable={isSelectable} style={styles.text}>
          {token.raw.trimEnd()}
        </Text>
      );
    }
  }
}

function ImageDescription({ description }: Readonly<{ description: string }>) {
  const t = useMessages();
  return <Text style={styles.muted}>{t.markdown.image(description)}</Text>;
}

// Every case returns an element (fragments for plain text) so it nests in its parent `Text`.
function Inline({ depth, token }: Readonly<{ depth: number; token: Token }>) {
  if (depth > MAX_DEPTH) {
    return <>{token.raw}</>;
  }
  const markedToken = token as MarkedToken;
  const inner = depth + 1;
  switch (markedToken.type) {
    case 'br': {
      return <>{'\n'}</>;
    }
    case 'codespan': {
      return <Text style={styles.code}>{markedToken.text}</Text>;
    }
    case 'del': {
      return <Text style={styles.deleted}>{renderInlineList(markedToken.tokens, inner)}</Text>;
    }
    case 'em': {
      return <Text style={styles.emphasis}>{renderInlineList(markedToken.tokens, inner)}</Text>;
    }
    case 'escape': {
      return <>{markedToken.text}</>;
    }
    case 'image': {
      // Never loaded: a remote image would tell its server when the recipe is read.
      return <ImageDescription description={markedToken.text} />;
    }
    case 'link': {
      // Links don't open for now: their text only.
      return <>{renderInlineList(markedToken.tokens, inner)}</>;
    }
    case 'strong': {
      return <Text style={styles.strong}>{renderInlineList(markedToken.tokens, inner)}</Text>;
    }
    case 'text': {
      return (
        <>{markedToken.tokens ? renderInlineList(markedToken.tokens, inner) : markedToken.text}</>
      );
    }
    default: {
      // Inline HTML (`<b>`) and anything else: the text as typed.
      return <>{token.raw}</>;
    }
  }
}

function List({ depth, list }: Readonly<{ depth: number; list: Tokens.List }>) {
  const start = typeof list.start === 'number' ? list.start : 1;
  return (
    <View accessibilityRole="list" style={styles.list}>
      {withKeys(list.items, (item) => item.raw).map(([key, item], index) => (
        <View
          // A task is read as a checkbox, ticked or not, instead of its box drawn in text.
          accessibilityRole={item.task ? 'checkbox' : undefined}
          // Read-only: the recipe shows the box as written, it can't be ticked here.
          accessibilityState={
            item.task ? { checked: item.checked === true, disabled: true } : undefined
          }
          accessible={item.task}
          key={key}
          style={styles.listItem}
        >
          {/* Screen readers read a number, but not a bullet nor a box (the list and the
              checkbox already say it). */}
          <Text
            accessibilityElementsHidden={!list.ordered || item.task}
            importantForAccessibility={list.ordered && !item.task ? 'auto' : 'no'}
            style={styles.text}
          >
            {listMarker(list, item, start + index)}
          </Text>
          <View style={styles.listItemContent}>{renderBlockList(item.tokens, depth + 1)}</View>
        </View>
      ))}
    </View>
  );
}

function listMarker(list: Tokens.List, item: Tokens.ListItem, number: number): string {
  if (item.task) {
    return item.checked ? '☑' : '☐';
  }
  return list.ordered ? `${number}.` : '•';
}

function renderBlockList(tokenList: readonly Token[], depth: number): ReactNode[] {
  return withKeys(tokenList, (token) => token.raw).map(([key, token]) => (
    <Block depth={depth} key={key} token={token} />
  ));
}

function renderInlineList(tokenList: readonly Token[], depth: number): ReactNode[] {
  return withKeys(tokenList, (token) => token.raw).map(([key, token]) => (
    <Inline depth={depth} key={key} token={token} />
  ));
}

function Table({ depth, table }: Readonly<{ depth: number; table: Tokens.Table }>) {
  return (
    // Wide tables scroll sideways: cells keep a readable width at any font size.
    <ScrollView horizontal>
      <View style={styles.table}>
        {withKeys([table.header, ...table.rows], (row) =>
          row.map((cell) => cell.text).join('|'),
        ).map(([rowKey, row], rowIndex) => (
          <View key={rowKey} style={[styles.tableRow, rowIndex > 0 && styles.tableRowDivider]}>
            {withKeys(row, (cell) => cell.text).map(([cellKey, cell]) => (
              <Text
                key={cellKey}
                selectable={isSelectable}
                style={[styles.text, styles.tableCell, cell.header && styles.strong]}
              >
                {renderInlineList(cell.tokens, depth)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  code: {
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fontFamily.mono,
  },
  codeBlock: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    padding: theme.gap(3),
  },
  container: {
    gap: theme.gap(3),
  },
  deleted: {
    textDecorationLine: 'line-through',
  },
  emphasis: {
    fontStyle: 'italic',
  },
  // Every level looks the same, one step under the screen's own section headings.
  heading: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
  },
  list: {
    gap: theme.gap(1),
  },
  listItem: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  listItemContent: {
    flex: 1,
    gap: theme.gap(1),
  },
  muted: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  quote: {
    borderLeftColor: theme.colors.border,
    borderLeftWidth: theme.borderWidthThick,
    gap: theme.gap(2),
    paddingLeft: theme.gap(3),
  },
  rule: {
    backgroundColor: theme.colors.border,
    height: theme.borderWidth,
  },
  strong: {
    fontWeight: '700',
  },
  table: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
  },
  tableCell: {
    padding: theme.gap(2),
    width: theme.size.tableCell,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableRowDivider: {
    borderColor: theme.colors.border,
    borderTopWidth: theme.borderWidth,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));

// React keys for parsed content, which has no ids: an item's source text, numbered when the same
// text comes back among its siblings (two identical rows), so keys are unique and stable.
function withKeys<T>(itemList: readonly T[], toText: (item: T) => string): [string, T][] {
  const countByText = new Map<string, number>();
  return itemList.map((item) => {
    const text = toText(item);
    const count = countByText.get(text) ?? 0;
    countByText.set(text, count + 1);
    return [`${count}:${text}`, item];
  });
}
