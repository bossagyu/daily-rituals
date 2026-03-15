import {
  formatFrequency,
  formatFrequencyShort,
} from '../frequencyDisplayService';
import type { Frequency } from '../../models';

describe('frequencyDisplayService', () => {
  describe('formatFrequency', () => {
    it('returns "毎日" for daily frequency', () => {
      const frequency: Frequency = { type: 'daily' };
      expect(formatFrequency(frequency)).toBe('毎日');
    });

    it('returns day names for weekly_days frequency', () => {
      const frequency: Frequency = { type: 'weekly_days', days: [1, 3, 5] };
      expect(formatFrequency(frequency)).toBe('月・水・金');
    });

    it('returns single day name for weekly_days with one day', () => {
      const frequency: Frequency = { type: 'weekly_days', days: [0] };
      expect(formatFrequency(frequency)).toBe('日');
    });

    it('returns all day names for weekly_days with all days', () => {
      const frequency: Frequency = {
        type: 'weekly_days',
        days: [0, 1, 2, 3, 4, 5, 6],
      };
      expect(formatFrequency(frequency)).toBe('日・月・火・水・木・金・土');
    });

    it('sorts days in weekly order (Sun-Sat)', () => {
      const frequency: Frequency = { type: 'weekly_days', days: [5, 1, 3] };
      expect(formatFrequency(frequency)).toBe('月・水・金');
    });

    it('returns "週N回" for weekly_count frequency', () => {
      const frequency: Frequency = { type: 'weekly_count', count: 3 };
      expect(formatFrequency(frequency)).toBe('週3回');
    });

    it('returns "週1回" for weekly_count with count 1', () => {
      const frequency: Frequency = { type: 'weekly_count', count: 1 };
      expect(formatFrequency(frequency)).toBe('週1回');
    });

    it('returns "週7回" for weekly_count with count 7', () => {
      const frequency: Frequency = { type: 'weekly_count', count: 7 };
      expect(formatFrequency(frequency)).toBe('週7回');
    });
  });

  describe('formatFrequencyShort', () => {
    it('returns "毎日" for daily frequency', () => {
      const frequency: Frequency = { type: 'daily' };
      expect(formatFrequencyShort(frequency)).toBe('毎日');
    });

    it('returns abbreviated day names for weekly_days', () => {
      const frequency: Frequency = { type: 'weekly_days', days: [1, 3, 5] };
      expect(formatFrequencyShort(frequency)).toBe('月水金');
    });

    it('returns "週N回" for weekly_count', () => {
      const frequency: Frequency = { type: 'weekly_count', count: 3 };
      expect(formatFrequencyShort(frequency)).toBe('週3回');
    });
  });
});
