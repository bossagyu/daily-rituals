/**
 * TasksManager - Core state management logic for task CRUD operations.
 *
 * Decoupled from React to enable unit testing without DOM/react-dom.
 * The useTasks hook wraps this manager to provide React state integration.
 */

import type { CreateTaskInput, UpdateTaskInput } from '../domain/models/task';
import type { TaskRepository } from '../data/repositories/taskRepository';

// --- State type ---

export type TasksState = {
  readonly tasks: readonly import('../domain/models/task').Task[];
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const INITIAL_STATE: TasksState = {
  tasks: [],
  isLoading: false,
  error: null,
};

// --- Constants ---

const LOAD_ERROR_MESSAGE = 'Failed to load tasks';
const CREATE_ERROR_MESSAGE = 'Failed to create task';
const UPDATE_ERROR_MESSAGE = 'Failed to update task';
const REMOVE_ERROR_MESSAGE = 'Failed to remove task';
const COMPLETE_ERROR_MESSAGE = 'Failed to complete task';
const UNCOMPLETE_ERROR_MESSAGE = 'Failed to uncomplete task';

// --- Utility ---

export type StateChangeCallback = (state: TasksState) => void;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

// --- TasksManager ---

/**
 * TasksManager encapsulates task CRUD state management logic.
 * Notifies the caller of state changes via the onStateChange callback.
 */
export class TasksManager {
  private state: TasksState;
  private readonly repository: TaskRepository;
  private readonly onStateChange: StateChangeCallback;
  private currentDate: string;

  constructor(repository: TaskRepository, onStateChange: StateChangeCallback) {
    this.state = INITIAL_STATE;
    this.repository = repository;
    this.onStateChange = onStateChange;
    this.currentDate = '';
  }

  getState(): TasksState {
    return this.state;
  }

  private setState(partial: Partial<TasksState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.onStateChange(this.state);
  }

  async loadTasks(date: string): Promise<void> {
    this.currentDate = date;
    this.setState({ isLoading: true, error: null });
    try {
      const tasks = await this.repository.findByDate(date);
      this.setState({ tasks, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, LOAD_ERROR_MESSAGE),
      });
    }
  }

  async createTask(input: CreateTaskInput): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.create(input);
      await this.reloadTasks();
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, CREATE_ERROR_MESSAGE),
      });
    }
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.update(id, input);
      await this.reloadTasks();
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, UPDATE_ERROR_MESSAGE),
      });
    }
  }

  async removeTask(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.remove(id);
      await this.reloadTasks();
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, REMOVE_ERROR_MESSAGE),
      });
    }
  }

  async completeTask(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.complete(id);
      await this.reloadTasks();
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, COMPLETE_ERROR_MESSAGE),
      });
    }
  }

  async uncompleteTask(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.uncomplete(id);
      await this.reloadTasks();
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, UNCOMPLETE_ERROR_MESSAGE),
      });
    }
  }

  private async reloadTasks(): Promise<void> {
    const tasks = await this.repository.findByDate(this.currentDate);
    this.setState({ tasks, isLoading: false });
  }
}
