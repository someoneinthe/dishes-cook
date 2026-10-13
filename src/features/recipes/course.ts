import type { IconName } from '@/components/icon';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Course } from '@/db/schema';

export const COURSE_LABELS: Readonly<Record<Course, string>> = {
  dessert: 'Dessert',
  main: 'Main course',
  starter: 'Starter',
};

export const COURSE_ICONS = {
  dessert: { icon: 'cupcake' },
  main: { icon: 'silverware-fork-knife' },
  starter: { icon: 'bowl-mix' },
} as const satisfies Readonly<Record<Course, Readonly<{ icon: IconName }>>>;

// In the meal order, for choosing one.
export const COURSE_OPTION_LIST: readonly SegmentedOption<Course>[] = [
  { ...COURSE_ICONS.starter, label: COURSE_LABELS.starter, value: 'starter' },
  { ...COURSE_ICONS.main, label: COURSE_LABELS.main, value: 'main' },
  { ...COURSE_ICONS.dessert, label: COURSE_LABELS.dessert, value: 'dessert' },
];
