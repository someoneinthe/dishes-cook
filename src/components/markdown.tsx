import type { MarkedToken, Token, Tokens } from 'marked';
import type { ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { lexer } from 'marked';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { isSafeLink } from '@/lib/links';

type MarkdownProps = Readonly<{ text: string }>;

// Renders Markdown written by the user with native components only (no WebView, no HTML):
// - raw HTML is shown as typed, never interpreted;
// - images are never loaded (no network request), their description is shown instead;
// - only web and e-mail links open (see isSafeLink), after the user confirms the full address.
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

// The full address is shown: the link's text can say anything.
function confirmOpenLink(href: string) {
  Alert.alert('Open this link?', href, [
    { style: 'cancel', text: 'Cancel' },
    {
      onPress: () => {
        void openLink(href);
      },
      text: 'Open',
    },
  ]);
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
      return (
        <Text style={styles.muted}>
          {markedToken.text ? `Image: ${markedToken.text}` : 'Image'}
        </Text>
      );
    }
    case 'link': {
      return <Link link={markedToken} />;
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

function Link({ link }: Readonly<{ link: Tokens.Link }>) {
  const contentList = renderInlineList(link.tokens);
  if (!isSafeLink(link.href)) {
    return <>{contentList}</>;
  }
  return (
    <Text
      accessibilityHint="Opens outside the app"
      accessibilityRole="link"
      onPress={() => {
        confirmOpenLink(link.href);
      }}
      style={styles.link}
    >
      {contentList}
    </Text>
  );
}

function List({ list }: Readonly<{ list: Tokens.List }>) {
  const start = typeof list.start === 'number' ? list.start : 1;
  return (
    <View accessibilityRole="list" style={styles.list}>
      {list.items.map((item, index) => (
        <View key={index} style={styles.listItem}>
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

async function openLink(href: string) {
  try {
    await Linking.openURL(href);
  } catch {
    Alert.alert('Can’t open this link', 'No app on this phone can open it.');
  }
}

function renderBlockList(tokenList: readonly Token[]): ReactNode[] {
  // Tokens have no id; their position is stable for a given text.

  return tokenList.map((token, index) => <Block key={index} token={token} />);
}

function renderInlineList(tokenList: readonly Token[]): ReactNode[] {
  return tokenList.map((token, index) => <Inline key={index} token={token} />);
}

function Table({ table }: Readonly<{ table: Tokens.Table }>) {
  return (
    <View style={styles.table}>
      {[table.header, ...table.rows].map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.tableRow, rowIndex > 0 && styles.tableRowDivider]}>
          {row.map((cell, cellIndex) => (
            <Text
              key={cellIndex}
              selectable
              style={[styles.text, styles.tableCell, cell.header && styles.strong]}
            >
              {renderInlineList(cell.tokens)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  code: {
    backgroundColor: theme.colors.surface,
    fontFamily: 'monospace',
  },
  codeBlock: {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    color: theme.colors.text,
    fontFamily: 'monospace',
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
  link: {
    color: theme.colors.link,
    textDecorationLine: 'underline',
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
    borderLeftWidth: theme.gap(1),
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
    flex: 1,
    padding: theme.gap(2),
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
