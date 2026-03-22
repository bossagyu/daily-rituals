const DAYS_IN_WEEK = 7;
const WEEKS_IN_GRID = 6;
const GRID_SIZE = DAYS_IN_WEEK * WEEKS_IN_GRID;

export type CalendarDay = {
  readonly date: string;
  readonly dayOfMonth: number;
  readonly isCurrentMonth: boolean;
};

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${padTwo(month)}-${padTwo(day)}`;
}

export function generateCalendarGrid(
  year: number,
  month: number,
): readonly CalendarDay[] {
  const firstDay = new Date(year, month - 1, 1);
  const startDayOfWeek = firstDay.getDay(); // 0=Sunday

  const daysInMonth = new Date(year, month, 0).getDate();

  const grid: CalendarDay[] = [];

  // Previous month padding
  const prevMonthDate = new Date(year, month - 1, 0);
  const prevMonthDays = prevMonthDate.getDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    grid.push({
      date: formatDate(prevYear, prevMonth, day),
      dayOfMonth: day,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    grid.push({
      date: formatDate(year, month, day),
      dayOfMonth: day,
      isCurrentMonth: true,
    });
  }

  // Next month padding
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (grid.length < GRID_SIZE) {
    grid.push({
      date: formatDate(nextYear, nextMonth, nextDay),
      dayOfMonth: nextDay,
      isCurrentMonth: false,
    });
    nextDay++;
  }

  return grid;
}
