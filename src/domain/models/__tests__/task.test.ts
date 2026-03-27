import { type Task, taskSchema, TASK_NAME_MAX_LENGTH } from '../task';

describe('Task type', () => {
  it('should represent a pending task without due date', () => {
    const task: Task = {
      id: 'task-1',
      userId: 'user-abc-123',
      name: 'Buy groceries',
      dueDate: null,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    expect(task.id).toBe('task-1');
    expect(task.completedAt).toBeNull();
    expect(task.dueDate).toBeNull();
  });

  it('should represent a completed task with due date', () => {
    const task: Task = {
      id: 'task-2',
      userId: 'user-abc-123',
      name: 'Submit report',
      dueDate: '2026-03-25',
      completedAt: '2026-03-24T15:30:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-03-24T15:30:00Z',
    };

    expect(task.dueDate).toBe('2026-03-25');
    expect(task.completedAt).toBe('2026-03-24T15:30:00Z');
  });
});

describe('taskSchema', () => {
  const validTask = {
    id: 'task-1',
    userId: 'user-abc-123',
    name: 'Buy groceries',
    dueDate: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('should validate a complete valid task', () => {
    const result = taskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('should validate a task with due date', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      dueDate: '2026-03-25',
    });
    expect(result.success).toBe(true);
  });

  it('should validate a task with completedAt', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      completedAt: '2026-03-24T15:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject a task with empty name', () => {
    const result = taskSchema.safeParse({ ...validTask, name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a task with whitespace-only name', () => {
    const result = taskSchema.safeParse({ ...validTask, name: '   ' });
    expect(result.success).toBe(false);
  });

  it('should reject a task with name exceeding max length', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      name: 'a'.repeat(TASK_NAME_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('should accept a task with name at max length', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      name: 'a'.repeat(TASK_NAME_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it('should reject a task with invalid date format', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      dueDate: '2026/03/25',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a task with invalid date value', () => {
    const result = taskSchema.safeParse({
      ...validTask,
      dueDate: '2026-13-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a task with empty id', () => {
    const result = taskSchema.safeParse({ ...validTask, id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a task with empty userId', () => {
    const result = taskSchema.safeParse({ ...validTask, userId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a task with empty createdAt', () => {
    const result = taskSchema.safeParse({ ...validTask, createdAt: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a task with empty updatedAt', () => {
    const result = taskSchema.safeParse({ ...validTask, updatedAt: '' });
    expect(result.success).toBe(false);
  });
});
