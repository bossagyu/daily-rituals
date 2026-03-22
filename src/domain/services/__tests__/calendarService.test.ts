import { describe, it, expect } from 'vitest';
import { generateCalendarGrid } from '../calendarService';

describe('generateCalendarGrid', () => {
  it('generates 42 cells (6 weeks) for any month', () => {
    const grid = generateCalendarGrid(2026, 3); // March 2026
    expect(grid).toHaveLength(42);
  });

  it('marks current month days correctly', () => {
    const grid = generateCalendarGrid(2026, 3);
    const marchDays = grid.filter((d) => d.isCurrentMonth);
    expect(marchDays).toHaveLength(31);
  });

  it('starts with correct day offset (March 2026 starts on Sunday)', () => {
    const grid = generateCalendarGrid(2026, 3);
    expect(grid[0].date).toBe('2026-03-01');
    expect(grid[0].isCurrentMonth).toBe(true);
  });

  it('handles February in leap year', () => {
    const grid = generateCalendarGrid(2028, 2); // Feb 2028 is leap year
    const febDays = grid.filter((d) => d.isCurrentMonth);
    expect(febDays).toHaveLength(29);
  });

  it('handles February in non-leap year', () => {
    const grid = generateCalendarGrid(2026, 2);
    const febDays = grid.filter((d) => d.isCurrentMonth);
    expect(febDays).toHaveLength(28);
  });

  it('includes previous month days as padding', () => {
    // April 2026 starts on Wednesday (day index 3)
    const grid = generateCalendarGrid(2026, 4);
    const prePadding = grid.filter(
      (d) => !d.isCurrentMonth && d.date < '2026-04-01',
    );
    expect(prePadding.length).toBeGreaterThan(0);
  });

  it('includes next month days as padding', () => {
    const grid = generateCalendarGrid(2026, 3);
    const postPadding = grid.filter(
      (d) => !d.isCurrentMonth && d.date > '2026-03-31',
    );
    expect(postPadding.length).toBeGreaterThan(0);
  });

  it('all dates are in YYYY-MM-DD format', () => {
    const grid = generateCalendarGrid(2026, 3);
    for (const day of grid) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
