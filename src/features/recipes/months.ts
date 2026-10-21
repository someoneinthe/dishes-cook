import type { Messages } from '@/i18n/en';
import { formatAmount } from '@/lib/units';

// A drink's maturation time, in months as typed: 0.5, 2, 1.25.

// Two years: more is a typing mistake.
export const MAX_MONTHS = 24;

// A typed number of months, with a dot or a comma ("1.5", "1,5"), up to 2 decimals.
const MONTHS_PATTERN = /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/;

// "2 months", "0.5 months", in the reader's language ("0,5 mois").
export function formatMonths(t: Messages, months: number): string {
  return t.recipes.months(formatAmount(months, t.quantities.decimalSeparator), months);
}

// The months as typed back into the form: "1.5" ("1,5" in French).
export function formatTypedMonths(t: Messages, months: number | undefined): string {
  return months === undefined ? '' : formatAmount(months, t.quantities.decimalSeparator);
}

// A typed maturation time: "1,5" -> 1.5; "" -> null (none); undefined when it isn't a number of
// months from 0.01 to MAX_MONTHS.
export function parseMonths(typed: string): null | number | undefined {
  const trimmed = typed.trim();
  if (!trimmed) {
    return null;
  }
  return MONTHS_PATTERN.test(trimmed) ? toMonths(Number(trimmed.replace(',', '.'))) : undefined;
}

// A stored or pulled maturation time: a number of months above 0 and up to MAX_MONTHS, to 2
// decimals, or undefined (none, or unusable).
export function toMonths(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const months = Math.round(value * 100) / 100;
  return months > 0 && months <= MAX_MONTHS ? months : undefined;
}
