import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { Season } from '@/db/schema';
import { Icon } from '@/components/icon';
import { useIconSize } from '@/components/use-icon-size';
import { describeSeason, SEASON_ICONS } from '../season';

type SeasonLabelProps = Readonly<{ season: Season }>;

// The season of a recipe, after its icon (both icons for "winter & summer").
export function SeasonLabel({ season }: SeasonLabelProps) {
  // Icon colors are props, not styles.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('sm');
  const iconList =
    season === 'both' ? [SEASON_ICONS.winter, SEASON_ICONS.summer] : [SEASON_ICONS[season]];
  const label = describeSeason(season);

  return (
    <View style={styles.row}>
      {/* Decoration: screen readers read the text only. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.row}
      >
        {iconList.map(({ icon, iconColor }) => (
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
