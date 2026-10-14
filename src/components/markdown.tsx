import type { MarkedToken, Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import { lexer } from 'marked';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';

type MarkdownProps = Readonly<{ text: string }>;

// Renders Markdown written by the user with native components only (no WebView, no HTML):
// - raw HTML is shown as typed, never interpreted;
// - images are never loaded (no network request), their description is shown instead;
// - links don't open (for now): only their text is shown.
// Line breaks are kept as typed, like the plain text recipes were shown before.
export function Markdown({ text }: MarkdownProps) {
  return <View style={styles.container}>{renderBlockList(lexer(text))}</View>;
}

// Checkboxes are drawn by their list item, link definitions by their links.
const HIDDEN_BLOCK_TYPE_SET = new Set(['checkbox', 'def', 'space']);

function Block({ token }: Readonly<{ token: Token }>) {
  if (HIDDEN_BLOCK_TYPE_SET.has(token.type)) {
    return null;
  }
  // `Token` also allows extension tokens of any type: shown as typed (`default`).
  const markedToken = token as MarkedToken;
  switch (markedToken.type) {
    case 'blockquote': {
      return <View style={styles.quote}>{renderBlockList(markedToken.tokens)}</View>;
    }
    case 'code': {
      return (
        <Text selectable style={styles.codeBlock}>
          {markedToken.text}
        </Text>
      );
    }
    case 'heading': {
      return (
        <Text accessibilityRole="header" selectable style={styles.heading}>
          {renderInlineList(markedToken.tokens)}
        </Text>
      );
    }
    case 'hr': {
      return <View style={styles.rule} />;
    }
    case 'list': {
      return <List list={markedToken} />;
    }
    case 'paragraph':
    case 'text': {
      return (
        <Text selectable style={styles.text}>
          {markedToken.tokens ? renderInlineList(markedToken.tokens) : markedToken.text}
        </Text>
      );
    }
    case 'table': {
      return <Table table={markedToken} />;
    }
    default: {
      // Raw HTML and anything else: the text as typed.
      return (
        <Text selectable style={styles.text}>
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
function Inline({ token }: Readonly<{ token: Token }>) {
  const markedToken = token as MarkedToken;
  switch (markedToken.type) {
    case 'br': {
      return <>{'\n'}</>;
    }
    case 'codespan': {
      return <Text style={styles.code}>{markedToken.text}</Text>;
    }
    case 'del': {
      return <Text style={styles.deleted}>{renderInlineList(markedToken.tokens)}</Text>;
    }
    case 'em': {
      return <Text style={styles.emphasis}>{renderInlineList(markedToken.tokens)}</Text>;
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
      return <>{renderInlineList(markedToken.tokens)}</>;
    }
    case 'strong': {
      return <Text style={styles.strong}>{renderInlineList(markedToken.tokens)}</Text>;
    }
    case 'text': {
      return <>{markedToken.tokens ? renderInlineList(markedToken.tokens) : markedToken.text}</>;
    }
    default: {
      // Inline HTML (`<b>`) and anything else: the text as typed.
      return <>{token.raw}</>;
    }
  }
}

function List({ list }: Readonly<{ list: Tokens.List }>) {
  const start = typeof list.start === 'number' ? list.start : 1;
  return (
    <View accessibilityRole="list" style={styles.list}>
      {withKeys(list.items, (item) => item.raw).map(([key, item], index) => (
        <View key={key} style={styles.listItem}>
          <Text style={styles.text}>{listMarker(list, item, start + index)}</Text>
          <View style={styles.listItemContent}>{renderBlockList(item.tokens)}</View>
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

function renderBlockList(tokenList: readonly Token[]): ReactNode[] {
  return withKeys(tokenList, (token) => token.raw).map(([key, token]) => (
    <Block key={key} token={token} />
  ));
}

function renderInlineList(tokenList: readonly Token[]): ReactNode[] {
  return withKeys(tokenList, (token) => token.raw).map(([key, token]) => (
    <Inline key={key} token={token} />
  ));
}

function Table({ table }: Readonly<{ table: Tokens.Table }>) {
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
                selectable
                style={[styles.text, styles.tableCell, cell.header && styles.strong]}
              >
                {renderInlineList(cell.tokens)}
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
