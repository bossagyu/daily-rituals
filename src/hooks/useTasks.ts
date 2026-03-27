/**
 * useTasks - Custom React hook for task CRUD operations.
 *
 * Thin React wrapper around TasksManager.
 * Provides task list, loading/error state, and mutation functions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CreateTaskInput, UpdateTaskInput } from '../domain/models/task';
import type { TaskRepository } from '../data/repositories/taskRepository';
import { TasksManager, INITIAL_STATE, type TasksState } from './tasksManager';

// Re-export for convenience
export { TasksManager, type TasksState } from './tasksManager';

export type UseTasksReturn = {
  readonly tasks: TasksState['tasks'];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly createTask: (input: CreateTaskInput) => Promise<void>;
  readonly updateTask: (id: string, input: UpdateTaskInput) => Promise<void>;
  readonly removeTask: (id: string) => Promise<void>;
  readonly completeTask: (id: string) => Promise<void>;
  readonly uncompleteTask: (id: string) => Promise<void>;
};

/**
 * React hook providing task CRUD operations and state.
 *
 * @param repository - TaskRepository instance (injected for testability)
 * @param selectedDate - The date to load tasks for (YYYY-MM-DD)
 * @returns Task state and mutation functions
 */
export function useTasks(repository: TaskRepository, selectedDate: string): UseTasksReturn {
  const [state, setState] = useState<TasksState>(INITIAL_STATE);
  const managerRef = useRef<TasksManager | null>(null);

  if (managerRef.current === null) {
    managerRef.current = new TasksManager(repository, (newState) => {
      setState(newState);
    });
  }

  const manager = managerRef.current;

  useEffect(() => {
    void manager.loadTasks(selectedDate);
  }, [manager, selectedDate]);

  const createTask = useCallback(
    (input: CreateTaskInput) => manager.createTask(input),
    [manager]
  );

  const updateTask = useCallback(
    (id: string, input: UpdateTaskInput) => manager.updateTask(id, input),
    [manager]
  );

  const removeTask = useCallback(
    (id: string) => manager.removeTask(id),
    [manager]
  );

  const completeTask = useCallback(
    (id: string) => manager.completeTask(id),
    [manager]
  );

  const uncompleteTask = useCallback(
    (id: string) => manager.uncompleteTask(id),
    [manager]
  );

  return {
    tasks: state.tasks,
    isLoading: state.isLoading,
    error: state.error,
    createTask,
    updateTask,
    removeTask,
    completeTask,
    uncompleteTask,
  };
}
