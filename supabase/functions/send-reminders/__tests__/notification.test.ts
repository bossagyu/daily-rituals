import { describe, it, expect } from 'vitest';
import { buildNotificationBody } from '../notification';

describe('buildNotificationBody', () => {
  it('shows single habit name', () => {
    expect(buildNotificationBody(['読書'])).toBe('「読書」がまだ完了していません');
  });

  it('shows two habit names', () => {
    expect(buildNotificationBody(['読書', '運動'])).toBe(
      '「読書」「運動」がまだ完了していません',
    );
  });

  it('shows three habit names', () => {
    expect(buildNotificationBody(['読書', '運動', '瞑想'])).toBe(
      '「読書」「運動」「瞑想」がまだ完了していません',
    );
  });

  it('truncates to 3 and shows remainder count', () => {
    expect(buildNotificationBody(['読書', '運動', '瞑想', '筋トレ', 'ランニング'])).toBe(
      '「読書」「運動」「瞑想」他2件がまだ完了していません',
    );
  });

  it('returns empty string for empty array', () => {
    expect(buildNotificationBody([])).toBe('');
  });
});
