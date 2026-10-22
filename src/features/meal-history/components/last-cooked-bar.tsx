import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { LastCooked } from './last-cooked';

type LastCookedBarProps = Readonly<{ recipeId: number }>;

// At the bottom of a dish's screen, always in view while the recipe scrolls: when it was last
// cooked, and "I cooked it" (the maintainer's choice, 2026-10-22). The root layout keeps it above
// Android's navigation buttons.
export function LastCookedBar({ recipeId }: LastCookedBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.content}>
        <LastCooked isEditable recipeId={recipeId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderTopWidth: theme.borderWidth,
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(3),
  },
  content: {
    // Centered on wide screens, like the screen's content.
    alignSelf: 'center',
    maxWidth: theme.size.maxContent,
    width: '100%',
  },
}));
