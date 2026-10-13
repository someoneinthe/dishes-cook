import type { SegmentedOption } from '@/components/segmented-control';
import type { Season } from '@/db/schema';

export const SEASON_LABELS: Readonly<Record<Season, string>> = {
  both: 'Both',
  summer: 'Summer',
  winter: 'Winter',
};

export const SEASON_OPTION_LIST: readonly SegmentedOption<Season>[] = [
  { label: SEASON_LABELS.winter, value: 'winter' },
  { label: SEASON_LABELS.summer, value: 'summer' },
  { label: SEASON_LABELS.both, value: 'both' },
];

// For lists: "Both" alone would be unclear.
export function describeSeason(season: Season): string {
  return season === 'both' ? 'Winter & summer' : SEASON_LABELS[season];
}
