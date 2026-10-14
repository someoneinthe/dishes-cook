import type { IconName } from '@/components/icon';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Season } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import type { ColorToken } from '@/theme/themes';

// Winter and summer have an icon, in its own color; "both" shows both.
export const SEASON_ICONS = {
  summer: { icon: 'white-balance-sunny', iconColor: 'seasonSummer' },
  winter: { icon: 'snowflake', iconColor: 'seasonWinter' },
} as const satisfies Readonly<
  Record<Exclude<Season, 'both'>, Readonly<{ icon: IconName; iconColor: ColorToken }>>
>;

// For lists: "Both" alone would be unclear.
export function describeSeason(season: Season, t: Messages): string {
  return season === 'both' ? t.seasons.winterAndSummer : t.seasons[season];
}

export function seasonOptionList(t: Messages): readonly SegmentedOption<Season>[] {
  return [
    { ...SEASON_ICONS.winter, label: t.seasons.winter, value: 'winter' },
    { ...SEASON_ICONS.summer, label: t.seasons.summer, value: 'summer' },
    { label: t.seasons.both, value: 'both' },
  ];
}
