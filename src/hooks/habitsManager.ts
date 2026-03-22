/**
 * HabitsManager - Core state management logic for habit CRUD operations.
 *
 * Decoupled from React to enable unit testing without DOM/react-dom.
 * The useHabits hook wraps this manager to provide React state integration.
 */

import type { Habit, CreateHabitInput } from '../domain/models';
import type { HabitRepository, UpdateHabitInput } from '../data/repositories';

// --- State type ---

export type HabitsState = {
  readonly habits: readonly Habit[];
  readonly isLoading: boolean;
  readonly error: string | null;
};

export const INITIAL_STATE: HabitsState = {
  habits: [],
  isLoading: false,
  error: null,
};

// --- Constants ---

const DEFAULT_ERROR_MESSAGE = 'Failed to load habits';
const CREATE_ERROR_MESSAGE = 'Failed to create habit';
const UPDATE_ERROR_MESSAGE = 'Failed to update habit';
const ARCHIVE_ERROR_MESSAGE = 'Failed to archive habit';
const DELETE_ERROR_MESSAGE = 'Failed to delete habit';

// --- Utility ---

export type StateChangeCallback = (state: HabitsState) => void;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

// --- HabitsManager ---

/**
 * HabitsManager encapsulates habit CRUD state management logic.
 * Notifies the caller of state changes via the onStateChange callback.
 */
export class HabitsManager {
  private state: HabitsState;
  private readonly repository: HabitRepository;
  private readonly onStateChange: StateChangeCallback;

  constructor(repository: HabitRepository, onStateChange: StateChangeCallback) {
    this.state = INITIAL_STATE;
    this.repository = repository;
    this.onStateChange = onStateChange;
  }

  getState(): HabitsState {
    return this.state;
  }

  private setState(partial: Partial<HabitsState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.onStateChange(this.state);
  }

  async loadHabits(): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      const habits = await this.repository.findAll();
      this.setState({ habits, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, DEFAULT_ERROR_MESSAGE),
      });
    }
  }

  async createHabit(input: CreateHabitInput): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.create(input);
      const habits = await this.repository.findAll();
      this.setState({ habits, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, CREATE_ERROR_MESSAGE),
      });
    }
  }

  async updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.update(id, input);
      const habits = await this.repository.findAll();
      this.setState({ habits, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, UPDATE_ERROR_MESSAGE),
      });
    }
  }

  async archiveHabit(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.archive(id);
      const habits = await this.repository.findAll();
      this.setState({ habits, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, ARCHIVE_ERROR_MESSAGE),
      });
    }
  }

  async deleteHabit(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null });
    try {
      await this.repository.remove(id);
      const habits = await this.repository.findAll();
      this.setState({ habits, isLoading: false });
    } catch (error: unknown) {
      this.setState({
        isLoading: false,
        error: extractErrorMessage(error, DELETE_ERROR_MESSAGE),
      });
    }
  }

  async refresh(): Promise<void> {
    return this.loadHabits();
  }
}
