const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const TOTAL_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const INTERVAL_MINUTES = 10;
const START_HOUR = 6;
const END_HOUR = 23;
const END_MINUTE = 50;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

function toTimeString(hours: number, minutes: number): string {
  const normalizedMinutes =
    ((hours * MINUTES_PER_HOUR + minutes) % TOTAL_MINUTES_PER_DAY + TOTAL_MINUTES_PER_DAY) %
    TOTAL_MINUTES_PER_DAY;
  return `${pad(Math.floor(normalizedMinutes / MINUTES_PER_HOUR))}:${pad(normalizedMinutes % MINUTES_PER_HOUR)}`;
}

export function localTimeToUtc(localTime: string, offsetMinutes: number): string {
  const { hours, minutes } = parseTime(localTime);
  return toTimeString(hours, minutes - offsetMinutes);
}

export function utcToLocalTime(utcTime: string, offsetMinutes: number): string {
  const { hours, minutes } = parseTime(utcTime);
  return toTimeString(hours, minutes + offsetMinutes);
}

export function roundToTenMinutes(time: string): string {
  const { hours, minutes } = parseTime(time);
  const rounded = Math.floor(minutes / INTERVAL_MINUTES) * INTERVAL_MINUTES;
  return toTimeString(hours, rounded);
}

export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const maxMinute = h === END_HOUR ? END_MINUTE : MINUTES_PER_HOUR - INTERVAL_MINUTES;
    for (let m = 0; m <= maxMinute; m += INTERVAL_MINUTES) {
      options.push(toTimeString(h, m));
    }
  }
  return options;
}

export function getBrowserTimezoneOffset(): number {
  return new Date().getTimezoneOffset() * -1;
}
