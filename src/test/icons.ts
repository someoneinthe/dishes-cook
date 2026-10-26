import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

type IconStyle = Readonly<{ color?: string; fontFamily?: string }> | undefined;

type JsonNode = NonNullable<ReturnType<typeof screen.toJSON>> | string;

// Color of the icon inside an element (a button), or undefined without one.
export function iconColorIn(element: Parameters<typeof within>[0]): string | undefined {
  const icon = within(element)
    .queryAllByText(/./)
    .find(
      (text) => (StyleSheet.flatten(text.props.style) as IconStyle)?.fontFamily === 'app-icons',
    );
  return icon ? (StyleSheet.flatten(icon.props.style) as IconStyle)?.color : undefined;
}

// Colors of the icons rendered on screen, in order, wherever they are in the tree (icons are text
// in the icon font).
export function renderedIconColorList(): string[] {
  const colorList: string[] = [];
  const visit = (nodeList: readonly JsonNode[]) => {
    for (const node of nodeList) {
      if (typeof node === 'string') {
        continue;
      }
      if (Array.isArray(node)) {
        visit(node);
        continue;
      }
      const style = StyleSheet.flatten(node.props.style) as
        Readonly<{ color?: string; fontFamily?: string }> | undefined;
      if (style?.fontFamily === 'app-icons' && style.color) {
        colorList.push(style.color);
      }
      visit(node.children ?? []);
    }
  };
  const tree = screen.toJSON();
  visit(tree === null ? [] : [tree]);
  return colorList;
}
