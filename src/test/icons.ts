import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

type JsonNode = NonNullable<ReturnType<typeof screen.toJSON>> | string;

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
      if (style?.fontFamily === 'material-community' && style.color) {
        colorList.push(style.color);
      }
      visit(node.children ?? []);
    }
  };
  const tree = screen.toJSON();
  visit(tree === null ? [] : [tree]);
  return colorList;
}
