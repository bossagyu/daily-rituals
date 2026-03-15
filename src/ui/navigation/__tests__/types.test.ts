import type { RootTabParamList, HabitsStackParamList } from '../types';

describe('Navigation types', () => {
  it('RootTabParamList has Today and Habits tabs', () => {
    // Type-level test: ensure the type has the expected keys
    const tabNames: ReadonlyArray<keyof RootTabParamList> = ['Today', 'Habits'];
    expect(tabNames).toHaveLength(2);
    expect(tabNames).toContain('Today');
    expect(tabNames).toContain('Habits');
  });

  it('HabitsStackParamList has HabitList and HabitForm screens', () => {
    const screenNames: ReadonlyArray<keyof HabitsStackParamList> = ['HabitList', 'HabitForm'];
    expect(screenNames).toHaveLength(2);
    expect(screenNames).toContain('HabitList');
    expect(screenNames).toContain('HabitForm');
  });

  it('HabitForm accepts optional habitId parameter', () => {
    // Type-level test: ensure HabitForm params are correct
    const params: HabitsStackParamList['HabitForm'] = { habitId: 'test-id' };
    expect(params).toEqual({ habitId: 'test-id' });
  });

  it('HabitForm accepts undefined params for new habit', () => {
    const params: HabitsStackParamList['HabitForm'] = undefined;
    expect(params).toBeUndefined();
  });

  it('HabitList does not accept params', () => {
    const params: HabitsStackParamList['HabitList'] = undefined;
    expect(params).toBeUndefined();
  });
});
