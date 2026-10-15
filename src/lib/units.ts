import type { Unit } from '@/db/schema';
import { UNIT_LIST } from '@/db/schema';

export type { Unit } from '@/db/schema';

// Quantities of a recipe's ingredients: an amount and a unit, in European (metric) or US units.
// Settings › Units picks the system: amounts written in the other one are converted for display,
// weight to weight and volume to volume. Spoons and counted units (pinch, clove…) exist in both
// systems and are never converted.

export const UNIT_SYSTEM_LIST = ['metric', 'us'] as const;
// An amount of an ingredient; without a unit, it's a number of pieces ("3 leeks").
export type Quantity = Readonly<{ amount: number; unit?: Unit }>;

export type UnitSystem = (typeof UNIT_SYSTEM_LIST)[number];

type UnitInfo = Readonly<{
  // Grams (mass) or millilitres (volume) in one unit; undefined for counted units.
  base?: number;
  kind: 'count' | 'mass' | 'volume';
  // 'both' = used in both systems, never converted.
  system: 'both' | UnitSystem;
}>;

// US customary units (not imperial: a US cup and fluid ounce).
const UNIT_INFO: Readonly<Record<Unit, UnitInfo>> = {
  bunch: { kind: 'count', system: 'both' },
  can: { kind: 'count', system: 'both' },
  cl: { base: 10, kind: 'volume', system: 'metric' },
  clove: { kind: 'count', system: 'both' },
  cup: { base: 236.5882365, kind: 'volume', system: 'us' },
  fl_oz: { base: 29.5735295625, kind: 'volume', system: 'us' },
  g: { base: 1, kind: 'mass', system: 'metric' },
  kg: { base: 1000, kind: 'mass', system: 'metric' },
  l: { base: 1000, kind: 'volume', system: 'metric' },
  lb: { base: 453.59237, kind: 'mass', system: 'us' },
  ml: { base: 1, kind: 'volume', system: 'metric' },
  oz: { base: 28.349523125, kind: 'mass', system: 'us' },
  pinch: { kind: 'count', system: 'both' },
  tbsp: { base: 15, kind: 'volume', system: 'both' },
  tsp: { base: 5, kind: 'volume', system: 'both' },
};

// The units offered in the recipe form, in this order (pieces = no unit, offered first).
const SYSTEM_UNIT_LIST: Readonly<Record<UnitSystem, readonly Unit[]>> = {
  metric: ['g', 'kg', 'ml', 'cl', 'l'],
  us: ['oz', 'lb', 'fl_oz', 'cup'],
};
const SHARED_UNIT_LIST: readonly Unit[] = ['tsp', 'tbsp', 'pinch', 'clove', 'bunch', 'can'];

// Largest amount accepted: more is a typo.
export const MAX_AMOUNT = 100_000;
// Smallest amount accepted: the form shows amounts to 0.01.
const MIN_AMOUNT = 0.01;

const CUP_IN_ML = UNIT_INFO.cup.base ?? 0;
const POUND_IN_GRAMS = UNIT_INFO.lb.base ?? 0;

// An amount as typed back into the form: "1.5" (or "1,5"), without trailing zeros.
export function formatAmount(amount: number, decimalSeparator: string): string {
  const rounded = Math.round(amount * 100) / 100;
  return String(rounded).split('.').join(decimalSeparator);
}

export function isUnit(value: unknown): value is Unit {
  return UNIT_LIST.includes(value as Unit);
}

export function isUnitSystem(value: unknown): value is UnitSystem {
  return UNIT_SYSTEM_LIST.includes(value as UnitSystem);
}

// "1,5" / "1.5" / "1/2" / "1 1/2" -> 1.5…; undefined when it isn't an amount between 0.01
// and MAX_AMOUNT.
export function parseAmount(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  const fraction = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  let amount: number;
  if (fraction) {
    const [, whole = '0', numerator = '0', denominator = '0'] = fraction;
    amount = Number(whole) + Number(numerator) / Number(denominator);
  } else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    amount = Number(trimmed);
  } else {
    return undefined;
  }
  return Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT
    ? amount
    : undefined;
}

// A quantity read from storage or the sync server; undefined when it isn't a usable one.
export function toQuantity(amount: unknown, unit: unknown): Quantity | undefined {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  if (amount > MAX_AMOUNT) {
    return undefined;
  }
  return isUnit(unit) ? { amount, unit } : { amount };
}

// The quantity in the reader's system: units of the other system become the closest unit of this
// one (grams below a kilo, ounces below a pound…), rounded for the kitchen.
export function toSystem(quantity: Quantity, system: UnitSystem): Quantity {
  const { unit } = quantity;
  if (unit === undefined) {
    return quantity;
  }
  const info = UNIT_INFO[unit];
  if (info.system === 'both' || info.system === system || info.base === undefined) {
    return quantity;
  }
  const base = quantity.amount * info.base;
  const target = closestUnit(info.kind, base, system);
  return { amount: roundForKitchen(base / (UNIT_INFO[target].base ?? 1), target), unit: target };
}

// The units the form offers for this system, and the quantity's own unit when it's another
// system's (a recipe written on a phone set to the other units keeps its unit when edited).
export function unitOptionList(system: UnitSystem, current?: Unit): readonly Unit[] {
  const unitList = [...SYSTEM_UNIT_LIST[system], ...SHARED_UNIT_LIST];
  return current === undefined || unitList.includes(current) ? unitList : [current, ...unitList];
}

function closestUnit(kind: UnitInfo['kind'], base: number, system: UnitSystem): Unit {
  if (system === 'metric') {
    if (kind === 'mass') {
      return base >= 1000 ? 'kg' : 'g';
    }
    return base >= 1000 ? 'l' : 'ml';
  }
  if (kind === 'mass') {
    return base >= POUND_IN_GRAMS ? 'lb' : 'oz';
  }
  // A quarter of a cup and more in cups, less in fluid ounces.
  return base >= CUP_IN_ML / 4 ? 'cup' : 'fl_oz';
}

// Grams and millilitres to the unit, kilos and litres to 0.01, ounces to 0.1, pounds and cups to
// a quarter.
function roundForKitchen(amount: number, unit: Unit): number {
  switch (unit) {
    case 'cup':
    case 'lb': {
      return Math.max(Math.round(amount * 4) / 4, 0.25);
    }
    case 'fl_oz':
    case 'oz': {
      return Math.max(Math.round(amount * 10) / 10, 0.1);
    }
    case 'g':
    case 'ml': {
      return Math.max(Math.round(amount), 1);
    }
    default: {
      return Math.round(amount * 100) / 100;
    }
  }
}
