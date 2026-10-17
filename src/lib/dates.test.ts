import { calendarDaysAgo, startOfLastDays } from './dates';

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();

describe('dates', () => {
  describe('calendarDaysAgo', () => {
    it('counts calendar days, whatever the hour', () => {
      expect(calendarDaysAgo(at(17, 0, 1), at(17, 23, 59))).toBe(0);
      expect(calendarDaysAgo(at(16, 23, 59), at(17, 0, 1))).toBe(1);
      expect(calendarDaysAgo(at(10, 12), at(17, 9))).toBe(7);
    });

    it('counts across a month end', () => {
      expect(calendarDaysAgo(new Date(2026, 8, 30, 20).getTime(), at(1, 8))).toBe(1);
    });
  });

  describe('startOfLastDays', () => {
    it('starts at midnight, the given number of days back with today included', () => {
      expect(startOfLastDays(1, at(17, 15))).toBe(at(17, 0));
      expect(startOfLastDays(7, at(17, 15))).toBe(at(11, 0));
      expect(startOfLastDays(14, at(17, 15))).toBe(new Date(2026, 9, 4).getTime());
    });

    it('agrees with calendarDaysAgo', () => {
      const now = at(17, 15);
      const start = startOfLastDays(7, now);

      expect(calendarDaysAgo(start, now)).toBe(6);
      expect(calendarDaysAgo(start - 1, now)).toBe(7);
    });
  });
});
