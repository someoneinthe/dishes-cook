import type { IconName } from '@/components/icon';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Season } from '@/db/schema';
import type { ColorToken } from '@/theme/themes';

export const SEASON_LABELS: Readonly<Record<Season, string>> = {
  both: 'Both',
  summer: 'Summer',
  winter: 'Winter',
};

// Winter and summer have an icon, in its own color; "both" shows both.
export const SEASON_ICONS = {
  summer: { icon: 'white-balance-sunny', iconColor: 'seasonSummer' },
  winter: { icon: 'snowflake', iconColor: 'seasonWinter' },
} as const satisfies Readonly<
  Record<Exclude<Season, 'both'>, Readonly<{ icon: IconName; iconColor: ColorToken }>>
>;

export const SEASON_OPTION_LIST: readonly SegmentedOption<Season>[] = [
  { ...SEASON_ICONS.winter, label: SEASON_LABELS.winter, value: 'winter' },
  { ...SEASON_ICONS.summer, label: SEASON_LABELS.summer, value: 'summer' },
  { label: SEASON_LABELS.both, value: 'both' },
];

// For lists: "Both" alone would be unclear.
export function describeSeason(season: Season): string {
  return season === 'both' ? 'Winter & summer' : SEASON_LABELS[season];
}
