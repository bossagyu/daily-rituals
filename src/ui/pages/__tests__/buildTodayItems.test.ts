/**
 * buildTodayItems tests - Verifies sorting order:
 * 1. Incomplete habits (by reminder time)
 * 2. Incomplete tasks (due-date first, then no-date)
 * 3. Completed habits
 * 4. Completed tasks (by completed_at descending)
 */

import { buildTodayItems } from '../TodayPage';
import type { Habit } from '@/domain/models';
import type { Task } from '@/domain/models/task';

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  userId: 'u1',
  name: 'Habit',
  frequency: { type: 'daily' },
  color: '#4CAF50',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  reminderTime: null,
  lastNotifiedDate: null,
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  userId: 'u1',
  name: 'Task',
  dueDate: null,
  completedAt: null,
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  ...overrides,
});

const selectedDate = '2026-03-27';

describe('buildTodayItems', () => {
  it('puts incomplete habits first, sorted by reminder time', () => {
    const habitNoReminder = makeHabit({ id: 'h1', name: 'No reminder', reminderTime: null });
    const habitEarly = makeHabit({ id: 'h2', name: 'Early', reminderTime: '08:00:00' });
    const habitLate = makeHabit({ id: 'h3', name: 'Late', reminderTime: '20:00:00' });

    const isCompleted = () => false;

    const result = buildTodayItems(
      [habitNoReminder, habitEarly, habitLate],
      [],
      isCompleted,
      selectedDate,
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'habit', habit: habitEarly, isCompleted: false });
    expect(result[1]).toEqual({ type: 'habit', habit: habitLate, isCompleted: false });
    expect(result[2]).toEqual({ type: 'habit', habit: habitNoReminder, isCompleted: false });
  });

  it('puts incomplete tasks after incomplete habits, due-date first then no-date', () => {
    const habit = makeHabit({ id: 'h1' });
    const taskWithDue = makeTask({ id: 't1', name: 'Due task', dueDate: '2026-03-27' });
    const taskNoDue = makeTask({ id: 't2', name: 'No due', dueDate: null, createdAt: '2026-03-02T00:00:00Z' });

    const isCompleted = () => false;

    const result = buildTodayItems([habit], [taskWithDue, taskNoDue], isCompleted, selectedDate);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'habit', habit, isCompleted: false });
    expect(result[1]).toEqual({ type: 'task', task: taskWithDue });
    expect(result[2]).toEqual({ type: 'task', task: taskNoDue });
  });

  it('puts completed habits after incomplete tasks', () => {
    const incompleteHabit = makeHabit({ id: 'h1', name: 'Incomplete' });
    const completedHabit = makeHabit({ id: 'h2', name: 'Completed' });
    const incompleteTask = makeTask({ id: 't1' });

    const completedIds = new Set(['h2']);
    const isCompleted = (id: string) => completedIds.has(id);

    const result = buildTodayItems(
      [incompleteHabit, completedHabit],
      [incompleteTask],
      isCompleted,
      selectedDate,
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'habit', habit: incompleteHabit, isCompleted: false });
    expect(result[1]).toEqual({ type: 'task', task: incompleteTask });
    expect(result[2]).toEqual({ type: 'habit', habit: completedHabit, isCompleted: true });
  });

  it('puts completed tasks last, sorted by completed_at descending', () => {
    const completedTask1 = makeTask({
      id: 't1',
      name: 'Completed earlier',
      completedAt: '2026-03-27T08:00:00Z',
    });
    const completedTask2 = makeTask({
      id: 't2',
      name: 'Completed later',
      completedAt: '2026-03-27T15:00:00Z',
    });

    const isCompleted = () => false;

    const result = buildTodayItems([], [completedTask1, completedTask2], isCompleted, selectedDate);

    expect(result).toHaveLength(2);
    // Descending by completed_at: later first
    expect(result[0]).toEqual({ type: 'task', task: completedTask2 });
    expect(result[1]).toEqual({ type: 'task', task: completedTask1 });
  });

  it('returns full ordering: incomplete habits, incomplete tasks, completed habits, completed tasks', () => {
    const incompleteHabit = makeHabit({ id: 'h1', name: 'Incomplete habit' });
    const completedHabit = makeHabit({ id: 'h2', name: 'Completed habit' });
    const incompleteTask = makeTask({ id: 't1', name: 'Incomplete task' });
    const completedTask = makeTask({ id: 't2', name: 'Completed task', completedAt: '2026-03-27T10:00:00Z' });

    const completedIds = new Set(['h2']);
    const isCompleted = (id: string) => completedIds.has(id);

    const result = buildTodayItems(
      [incompleteHabit, completedHabit],
      [incompleteTask, completedTask],
      isCompleted,
      selectedDate,
    );

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('habit');
    expect(result[0]).toEqual({ type: 'habit', habit: incompleteHabit, isCompleted: false });
    expect(result[1].type).toBe('task');
    expect(result[1]).toEqual({ type: 'task', task: incompleteTask });
    expect(result[2].type).toBe('habit');
    expect(result[2]).toEqual({ type: 'habit', habit: completedHabit, isCompleted: true });
    expect(result[3].type).toBe('task');
    expect(result[3]).toEqual({ type: 'task', task: completedTask });
  });
});
