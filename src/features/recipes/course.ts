import type { IconName } from '@/components/icon';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Course } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import type { ColorToken } from '@/theme/themes';

// Each course has an icon, in its own color.
export const COURSE_ICONS = {
  dessert: { icon: 'cupcake', iconColor: 'courseDessert' },
  main: { icon: 'silverware-fork-knife', iconColor: 'courseMain' },
  starter: { icon: 'bowl-mix', iconColor: 'courseStarter' },
} as const satisfies Readonly<Record<Course, Readonly<{ icon: IconName; iconColor: ColorToken }>>>;

// In the meal order, for choosing one.
export function courseOptionList(t: Messages): readonly SegmentedOption<Course>[] {
  return [
    { ...COURSE_ICONS.starter, label: t.courses.starter, value: 'starter' },
    { ...COURSE_ICONS.main, label: t.courses.main, value: 'main' },
    { ...COURSE_ICONS.dessert, label: t.courses.dessert, value: 'dessert' },
  ];
}
