import {
  localTimeToUtc,
  utcToLocalTime,
  roundToTenMinutes,
  generateTimeOptions,
  getBrowserTimezoneOffset,
} from '../reminderTime';

describe('localTimeToUtc', () => {
  it('converts JST 18:00 to UTC 09:00', () => {
    expect(localTimeToUtc('18:00', 540)).toBe('09:00');
  });

  it('handles day boundary crossing (JST 02:00 → UTC 17:00 previous day)', () => {
    expect(localTimeToUtc('02:00', 540)).toBe('17:00');
  });
});

describe('utcToLocalTime', () => {
  it('converts UTC 09:00 to JST 18:00', () => {
    expect(utcToLocalTime('09:00', 540)).toBe('18:00');
  });
});

describe('roundToTenMinutes', () => {
  it('rounds 09:03 down to 09:00', () => {
    expect(roundToTenMinutes('09:03')).toBe('09:00');
  });

  it('rounds 09:07 down to 09:00', () => {
    expect(roundToTenMinutes('09:07')).toBe('09:00');
  });

  it('keeps 09:10 as is', () => {
    expect(roundToTenMinutes('09:10')).toBe('09:10');
  });
});

describe('generateTimeOptions', () => {
  it('generates options from 06:00 to 23:50 in 10-minute intervals', () => {
    const options = generateTimeOptions();
    expect(options[0]).toBe('06:00');
    expect(options[options.length - 1]).toBe('23:50');
    expect(options.length).toBe(108);
  });

  it('all values are 10-minute intervals', () => {
    const options = generateTimeOptions();
    for (const opt of options) {
      const minutes = parseInt(opt.split(':')[1], 10);
      expect(minutes % 10).toBe(0);
    }
  });
});

describe('getBrowserTimezoneOffset', () => {
  it('returns a number', () => {
    expect(typeof getBrowserTimezoneOffset()).toBe('number');
  });
});
