import type { Course, Season } from '@/db/schema';
import { IconLabel } from '@/components/icon-label';
import { COURSE_ICONS, COURSE_LABELS } from '../course';
import { describeSeason, SEASON_ICONS } from '../season';

// The course of a recipe, after its icon.
export function CourseLabel({ course }: Readonly<{ course: Course }>) {
  return <IconLabel iconList={[COURSE_ICONS[course]]} label={COURSE_LABELS[course]} />;
}

// The season of a recipe, after its icon (both icons for "winter & summer").
export function SeasonLabel({ season }: Readonly<{ season: Season }>) {
  const iconList =
    season === 'both' ? [SEASON_ICONS.winter, SEASON_ICONS.summer] : [SEASON_ICONS[season]];
  return <IconLabel iconList={iconList} label={describeSeason(season)} />;
}
