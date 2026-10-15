import type { Messages } from '@/i18n/en';
import type { Quantity, UnitSystem } from '@/lib/units';
import { formatAmount, toDisplay } from '@/lib/units';

// "500 g", "1.5 kg", "2 cups", "3" (pieces): a stored quantity in the reader's units (Settings ›
// Units, closest unit) and language.
export function formatQuantity(t: Messages, quantity: Quantity, system: UnitSystem): string {
  const shown = toDisplay(quantity, system);
  const amount = formatAmount(shown.amount, t.quantities.decimalSeparator);
  return shown.unit === undefined
    ? amount
    : [amount, t.quantities.unit(shown.unit, shown.amount)].join(' ');
}
