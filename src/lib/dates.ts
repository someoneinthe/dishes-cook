// Calendar days in the phone's time zone (daylight saving changes included): "yesterday" is the
// day before, whatever the hour.

// How many calendar days `time` is before `now`: 0 = the same day, 1 = the day before.
export function calendarDaysAgo(time: number, now: number = Date.now()): number {
  // Midnights 23 or 25 hours apart around a daylight saving change: rounded to whole days.
  return Math.round((startOfDay(now) - startOfDay(time)) / (24 * 60 * 60 * 1000));
}

// The start of the day `dayCount - 1` days before `now`'s: the last `dayCount` calendar days,
// today included, start there (7 = today and the 6 days before).
export function startOfLastDays(dayCount: number, now: number = Date.now()): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (dayCount - 1)).getTime();
}

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
