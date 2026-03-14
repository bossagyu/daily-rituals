import { add } from '../sample';

describe('sample', () => {
  describe('add', () => {
    it('should return the sum of two positive numbers', () => {
      expect(add(1, 2)).toBe(3);
    });

    it('should handle zero', () => {
      expect(add(0, 5)).toBe(5);
      expect(add(5, 0)).toBe(5);
    });

    it('should handle negative numbers', () => {
      expect(add(-1, -2)).toBe(-3);
      expect(add(-1, 3)).toBe(2);
    });
  });
});
