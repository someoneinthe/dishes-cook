import type { Course, Season } from '@/db/schema';
import { IconLabel } from '@/components/icon-label';
import { useMessages } from '@/i18n/i18n-provider';
import { COURSE_ICONS } from '../course';
import { describeSeason, SEASON_ICONS } from '../season';

// The course of a recipe, after its icon.
export function CourseLabel({ course }: Readonly<{ course: Course }>) {
  const t = useMessages();
  return <IconLabel iconList={[COURSE_ICONS[course]]} label={t.courses[course]} />;
}

// The season of a recipe, after its icon (both icons for "winter & summer").
export function SeasonLabel({ season }: Readonly<{ season: Season }>) {
  const t = useMessages();
  const iconList =
    season === 'both' ? [SEASON_ICONS.winter, SEASON_ICONS.summer] : [SEASON_ICONS[season]];
  return <IconLabel iconList={iconList} label={describeSeason(season, t)} />;
}
