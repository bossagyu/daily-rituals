/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import {
  useLevelUpDetection,
  LEVEL_STORAGE_KEY,
} from '../useLevelUpDetection';

describe('useLevelUpDetection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null event on first run and persists current level', () => {
    const { result } = renderHook(() => useLevelUpDetection(5));
    expect(result.current.event).toBeNull();
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('5');
  });

  it('returns null event when level is unchanged', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '5');
    const { result } = renderHook(() => useLevelUpDetection(5));
    expect(result.current.event).toBeNull();
  });

  it('returns null event when level is null (data not loaded yet)', () => {
    const { result } = renderHook(() => useLevelUpDetection(null));
    expect(result.current.event).toBeNull();
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBeNull();
  });

  it('returns level-up event when current level is greater than stored', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '3');
    const { result } = renderHook(() => useLevelUpDetection(4));
    expect(result.current.event).not.toBeNull();
    expect(result.current.event?.previousLevel).toBe(3);
    expect(result.current.event?.newLevel).toBe(4);
  });

  it('handles multi-level jumps (3 → 5)', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '3');
    const { result } = renderHook(() => useLevelUpDetection(5));
    expect(result.current.event?.previousLevel).toBe(3);
    expect(result.current.event?.newLevel).toBe(5);
  });

  it('does not return event when level decreased (defensive)', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '5');
    const { result } = renderHook(() => useLevelUpDetection(3));
    expect(result.current.event).toBeNull();
    // Stored level is updated to current to prevent stale state
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('3');
  });

  it('updates localStorage when dismiss is called', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '3');
    const { result } = renderHook(() => useLevelUpDetection(4));
    expect(result.current.event).not.toBeNull();

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.event).toBeNull();
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('4');
  });

  it('handles invalid stored value (NaN) as first run', () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, 'not-a-number');
    const { result } = renderHook(() => useLevelUpDetection(5));
    expect(result.current.event).toBeNull();
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('5');
  });
});
