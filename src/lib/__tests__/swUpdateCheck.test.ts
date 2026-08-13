import { shouldRunUpdateCheck } from '../swUpdateCheck';

describe('shouldRunUpdateCheck', () => {
  it('returns false when the gap has not been reached', () => {
    expect(shouldRunUpdateCheck(1_000, 500, 600)).toBe(false);
  });

  it('returns true when the elapsed time exactly equals the gap', () => {
    expect(shouldRunUpdateCheck(1_100, 500, 600)).toBe(true);
  });

  it('returns true when the elapsed time exceeds the gap', () => {
    expect(shouldRunUpdateCheck(2_000, 500, 600)).toBe(true);
  });

  it('returns true immediately when lastCheckAt is in the far past', () => {
    expect(shouldRunUpdateCheck(Date.now(), 0, 60_000)).toBe(true);
  });

  it('returns false when now equals lastCheckAt and the gap is positive', () => {
    expect(shouldRunUpdateCheck(1_000, 1_000, 60_000)).toBe(false);
  });
});
