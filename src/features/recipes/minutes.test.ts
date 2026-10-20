import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { formatMinutes, formatTimes, MAX_MINUTES, parseMinutes, toMinutes } from './minutes';

describe('minutes', () => {
  it('reads a typed time: a whole number of minutes, or nothing', () => {
    expect(parseMinutes(' 20 ')).toBe(20);
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('1.5')).toBeUndefined();
  });

  it('refuses a typed time that isn’t a usable number of minutes', () => {
    expect(parseMinutes('ten')).toBeUndefined();
    expect(parseMinutes('0')).toBeUndefined();
    expect(parseMinutes(String(MAX_MINUTES + 1))).toBeUndefined();
  });

  it('keeps only usable stored or pulled times', () => {
    expect(toMinutes(45)).toBe(45);
    expect(toMinutes(0)).toBeUndefined();
    expect(toMinutes(2.5)).toBeUndefined();
    expect(toMinutes('45')).toBeUndefined();
    expect(toMinutes(null)).toBeUndefined();
  });

  it('writes a duration in hours and minutes', () => {
    expect(formatMinutes(en, 45)).toBe('45 min');
    expect(formatMinutes(en, 60)).toBe('1 h');
    expect(formatMinutes(en, 90)).toBe('1 h 30 min');
    expect(formatMinutes(fr, 90)).toBe('1\u{A0}h\u{A0}30');
  });

  it('writes the times a recipe gives, with their total when both are given', () => {
    expect(formatTimes(en, { cookMinutes: 30, prepMinutes: 15 })).toBe(
      'Preparation 15 min · Cooking 30 min · 45 min in all',
    );
    expect(formatTimes(en, { cookMinutes: 30 })).toBe('Cooking 30 min');
    expect(formatTimes(en, {})).toBeUndefined();
    expect(formatTimes(fr, { prepMinutes: 15 })).toBe('Préparation 15\u{A0}min');
  });

  it('shows a drink’s preparation time only: a drink isn’t cooked', () => {
    expect(formatTimes(en, { cookMinutes: 30, kind: 'drink', prepMinutes: 5 })).toBe(
      'Preparation 5 min',
    );
    expect(formatTimes(en, { cookMinutes: 30, kind: 'drink' })).toBeUndefined();
  });
});
