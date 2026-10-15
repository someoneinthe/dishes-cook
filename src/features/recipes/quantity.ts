import type { Messages } from '@/i18n/en';
import type { Quantity, UnitSystem } from '@/lib/units';
import { formatAmount, toSystem } from '@/lib/units';

// "500 g", "2 cups", "3" (pieces), in the reader's units (Settings › Units) and language.
export function formatQuantity(t: Messages, quantity: Quantity, system: UnitSystem): string {
  const shown = toSystem(quantity, system);
  const amount = formatAmount(shown.amount, t.quantities.decimalSeparator);
  return shown.unit === undefined
    ? amount
    : [amount, t.quantities.unit(shown.unit, shown.amount)].join(' ');
}
