import type { RecipeKind } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import { formatMonths } from './months';

// Preparation and cooking times, in whole minutes.

// A week: more is a typing mistake.
export const MAX_MINUTES = 7 * 24 * 60;

// "1 h 30 min", "45 min", in the reader's language.
export function formatMinutes(t: Messages, minutes: number): string {
  return t.recipes.duration(Math.floor(minutes / 60), minutes % 60);
}

// "Preparation 15 min · Cooking 30 min · 45 min in all", "Preparation 15 min · Maturation 2 months"
// for a drink; undefined when the recipe gives none.
export function formatTimes(
  t: Messages,
  times: Readonly<{
    cookMinutes?: number;
    kind?: RecipeKind;
    maturationMonths?: number;
    prepMinutes?: number;
  }>,
): string | undefined {
  // A drink has a preparation time and a maturation time; a dish, preparation and cooking.
  const isDrink = times.kind === 'drink';
  const cookMinutes = isDrink ? undefined : times.cookMinutes;
  const maturationMonths = isDrink ? times.maturationMonths : undefined;
  const { prepMinutes } = times;
  if (cookMinutes === undefined && prepMinutes === undefined && maturationMonths === undefined) {
    return undefined;
  }
  const format = (minutes: number | undefined) =>
    minutes === undefined ? undefined : formatMinutes(t, minutes);
  return t.recipes.times({
    cook: format(cookMinutes),
    // Apart from the total: the waiting isn't time spent on the drink.
    maturation: maturationMonths === undefined ? undefined : formatMonths(t, maturationMonths),
    prep: format(prepMinutes),
    total:
      cookMinutes === undefined || prepMinutes === undefined
        ? undefined
        : formatMinutes(t, cookMinutes + prepMinutes),
  });
}

// A typed time: "20" -> 20; "" -> null (no time); undefined when it isn't a number of minutes.
export function parseMinutes(typed: string): null | number | undefined {
  const trimmed = typed.trim();
  if (!trimmed) {
    return null;
  }
  return /^\d+$/.test(trimmed) ? toMinutes(Number(trimmed)) : undefined;
}

// A stored or pulled time: a whole number of minutes from 1 to MAX_MINUTES, or undefined (none, or
// unusable).
export function toMinutes(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_MINUTES
    ? value
    : undefined;
}
