import type { IconName } from '@/components/icon';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Season } from '@/db/schema';

export const SEASON_LABELS: Readonly<Record<Season, string>> = {
  both: 'Both',
  summer: 'Summer',
  winter: 'Winter',
};

// Winter and summer have an icon; "both" doesn't (no clear one).
export const SEASON_ICONS = {
  summer: 'white-balance-sunny',
  winter: 'snowflake',
} as const satisfies Readonly<Record<Exclude<Season, 'both'>, IconName>>;

export const SEASON_OPTION_LIST: readonly SegmentedOption<Season>[] = [
  { icon: SEASON_ICONS.winter, label: SEASON_LABELS.winter, value: 'winter' },
  { icon: SEASON_ICONS.summer, label: SEASON_LABELS.summer, value: 'summer' },
  { label: SEASON_LABELS.both, value: 'both' },
];

// For lists: "Both" alone would be unclear.
export function describeSeason(season: Season): string {
  return season === 'both' ? 'Winter & summer' : SEASON_LABELS[season];
}
