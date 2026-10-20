import type { Unit } from '@/db/schema';
import { UNIT_LIST } from '@/db/schema';

export type { Unit } from '@/db/schema';

// Quantities of a recipe's ingredients. Weights are stored in grams and volumes in millilitres,
// whatever unit they were typed in (`toStored`); each reader sees them in the closest unit of their
// system, Settings › Units: 1000 g shows as 1 kg, or 2.25 lb in US units (`toDisplay`). Spoons and
// counted units (pinch, clove…) exist in both systems and stay as written.

export const UNIT_SYSTEM_LIST = ['metric', 'us'] as const;
// An amount of an ingredient; without a unit, it's a number of pieces ("3 leeks").
export type Quantity = Readonly<{ amount: number; unit?: Unit }>;

export type UnitSystem = (typeof UNIT_SYSTEM_LIST)[number];

type UnitInfo = Readonly<{
  // Grams (mass) or millilitres (volume) in one unit; undefined for counted units.
  base?: number;
  kind: 'count' | 'mass' | 'volume';
  // 'both' = used in both systems, stored and shown as written.
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
  leaf: { kind: 'count', system: 'both' },
  ml: { base: 1, kind: 'volume', system: 'metric' },
  oz: { base: 28.349523125, kind: 'mass', system: 'us' },
  pinch: { kind: 'count', system: 'both' },
  sprig: { kind: 'count', system: 'both' },
  tbsp: { base: 15, kind: 'volume', system: 'both' },
  tsp: { base: 5, kind: 'volume', system: 'both' },
};

// The units offered in the recipe form, in this order (pieces = no unit, offered first).
const SYSTEM_UNIT_LIST: Readonly<Record<UnitSystem, readonly Unit[]>> = {
  metric: ['g', 'kg', 'ml', 'cl', 'l'],
  us: ['oz', 'lb', 'fl_oz', 'cup'],
};
const SHARED_UNIT_LIST: readonly Unit[] = [
  'tsp',
  'tbsp',
  'pinch',
  'clove',
  'bunch',
  'sprig',
  'leaf',
  'can',
];

// Largest amount typed in the form: more is a typo.
export const MAX_AMOUNT = 100_000;
// Largest stored amount (grams, millilitres…): MAX_AMOUNT of the largest unit, with some margin.
const MAX_STORED_AMOUNT = 100_000_000;
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

// The quantity as shown to a reader: weights and volumes in the closest unit of their system
// (grams below a kilo, ounces below a pound…), rounded for the kitchen; the rest as written.
export function toDisplay(quantity: Quantity, system: UnitSystem): Quantity {
  const base = toBase(quantity);
  if (base === undefined) {
    return quantity;
  }
  const target = closestUnit(base.kind, base.amount, system);
  return {
    amount: roundForKitchen(base.amount / (UNIT_INFO[target].base ?? 1), target),
    unit: target,
  };
}

// A quantity read from storage or the sync server; undefined when it isn't a usable one.
export function toQuantity(amount: unknown, unit: unknown): Quantity | undefined {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_STORED_AMOUNT
  ) {
    return undefined;
  }
  return isUnit(unit) ? { amount, unit } : { amount };
}

// The quantity as stored: weights in grams, volumes in millilitres ("1.5 kg" -> 1500 g, "8 oz" ->
// 226.8 g); spoons, counted units and pieces as written.
export function toStored(quantity: Quantity): Quantity {
  const base = toBase(quantity);
  if (base === undefined) {
    return quantity;
  }
  return { amount: base.amount, unit: base.kind === 'mass' ? 'g' : 'ml' };
}

// The units the form offers for this system.
export function unitOptionList(system: UnitSystem): readonly Unit[] {
  return [...SYSTEM_UNIT_LIST[system], ...SHARED_UNIT_LIST];
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

// Grams and millilitres to the unit (to 0.1 below 10), kilos and litres to 0.01, ounces to 0.1,
// pounds and cups to a quarter.
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
      return amount < 10 ? Math.max(Math.round(amount * 10) / 10, 0.1) : Math.round(amount);
    }
    default: {
      return Math.round(amount * 100) / 100;
    }
  }
}

// A weight in grams or a volume in millilitres; undefined for spoons, counted units and pieces.
function toBase(
  quantity: Quantity,
): Readonly<{ amount: number; kind: 'mass' | 'volume' }> | undefined {
  const info = quantity.unit === undefined ? undefined : UNIT_INFO[quantity.unit];
  return info?.base === undefined || info.system === 'both' || info.kind === 'count'
    ? undefined
    : { amount: quantity.amount * info.base, kind: info.kind };
}
