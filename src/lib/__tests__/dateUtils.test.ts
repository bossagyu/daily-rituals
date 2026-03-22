import {
  parseDateParam,
  addDays,
  isToday,
  isFutureDate,
  getTodayString,
  formatDisplayDate,
} from '../dateUtils';

describe('parseDateParam', () => {
  it('returns the date string for a valid date', () => {
    expect(parseDateParam('2026-03-20')).toBe('2026-03-20');
  });

  it('returns today for null', () => {
    expect(parseDateParam(null)).toBe(getTodayString());
  });

  it('returns today for empty string', () => {
    expect(parseDateParam('')).toBe(getTodayString());
  });

  it('returns today for invalid format', () => {
    expect(parseDateParam('2026/03/20')).toBe(getTodayString());
    expect(parseDateParam('not-a-date')).toBe(getTodayString());
    expect(parseDateParam('20260320')).toBe(getTodayString());
  });

  it('returns today for non-existent date (2026-02-30)', () => {
    expect(parseDateParam('2026-02-30')).toBe(getTodayString());
  });

  it('returns today for another non-existent date (2026-04-31)', () => {
    expect(parseDateParam('2026-04-31')).toBe(getTodayString());
  });
});

describe('addDays', () => {
  it('adds 1 day', () => {
    expect(addDays('2026-03-20', 1)).toBe('2026-03-21');
  });

  it('subtracts 1 day', () => {
    expect(addDays('2026-03-20', -1)).toBe('2026-03-19');
  });

  it('handles month boundary', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
  });

  it('handles month boundary backwards', () => {
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('handles year boundary (Dec 31 + 1)', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles year boundary (Jan 1 - 1)', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('isToday', () => {
  it('returns true for today', () => {
    expect(isToday(getTodayString())).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = addDays(getTodayString(), -1);
    expect(isToday(yesterday)).toBe(false);
  });
});

describe('isFutureDate', () => {
  it('returns true for tomorrow', () => {
    const tomorrow = addDays(getTodayString(), 1);
    expect(isFutureDate(tomorrow)).toBe(true);
  });

  it('returns false for today', () => {
    expect(isFutureDate(getTodayString())).toBe(false);
  });

  it('returns false for yesterday', () => {
    const yesterday = addDays(getTodayString(), -1);
    expect(isFutureDate(yesterday)).toBe(false);
  });
});

describe('formatDisplayDate', () => {
  it('formats a date in Japanese format with day of week', () => {
    // 2026-03-20 is a Friday
    expect(formatDisplayDate('2026-03-20')).toBe('2026年3月20日 (金)');
  });

  it('formats a Sunday correctly', () => {
    // 2026-03-22 is a Sunday
    expect(formatDisplayDate('2026-03-22')).toBe('2026年3月22日 (日)');
  });
});
