import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ColorToken } from '@/theme/themes';
import type { IconName } from './icon';
import { Icon } from './icon';
import { useIconSize } from './use-icon-size';

export type LabelIcon = Readonly<{
  icon: IconName;
  // Muted like the text by default.
  iconColor?: ColorToken;
}>;

type IconLabelProps = Readonly<{ iconList: readonly LabelIcon[]; label: string }>;

// A short muted detail (season, course…) after its icons.
export function IconLabel({ iconList, label }: IconLabelProps) {
  // Icon colors are props, not styles.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('sm');

  return (
    <View style={styles.row}>
      {/* Decoration: screen readers read the text only. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.row}
      >
        {iconList.map(({ icon, iconColor = 'textMuted' }) => (
          <Icon color={theme.colors[iconColor]} key={icon} name={icon} size={iconSize} />
        ))}
      </View>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: theme.gap(1),
  },
  text: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
