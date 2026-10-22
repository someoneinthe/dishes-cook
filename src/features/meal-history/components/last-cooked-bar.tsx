import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { LastCooked } from './last-cooked';

type LastCookedBarProps = Readonly<{ recipeId: number }>;

// At the bottom of a dish's screen, always in view while the recipe scrolls: when it was last
// cooked, and "I cooked it" (the maintainer's choice, 2026-10-22).
export function LastCookedBar({ recipeId }: LastCookedBarProps) {
  // Above the phone's navigation bar or gesture area (the app draws behind them).
  const { bottom } = useSafeAreaInsets();
  // A prop-computed padding: the theme is read here.
  const { theme } = useUnistyles();
  return (
    <View style={[styles.bar, { paddingBottom: theme.gap(3) + bottom }]}>
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
    paddingTop: theme.gap(3),
  },
  content: {
    // Centered on wide screens, like the screen's content.
    alignSelf: 'center',
    maxWidth: theme.size.maxContent,
    width: '100%',
  },
}));
