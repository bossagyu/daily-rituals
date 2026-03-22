/**
 * @vitest-environment jsdom
 */

/**
 * TodayPage tests - Verifies habit list rendering, completion toggling,
 * loading/error/empty states using mock repositories.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { TodayPage } from '../TodayPage';
import type { Habit } from '@/domain/models';
import type { Completion } from '@/domain/models';
import type { HabitRepository } from '@/data/repositories/habitRepository';
import type { CompletionRepository } from '@/data/repositories/completionRepository';

// --- Mock Data ---

const TEST_USER_ID = 'user-test-123';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: TEST_USER_ID,
    name: '朝のジョギング',
    frequency: { type: 'daily' },
    color: 'blue',
    createdAt: '2025-01-01T00:00:00Z',
    archivedAt: null,
    reminderTime: null,
    lastNotifiedDate: null,
    ...overrides,
  };
}

function makeCompletion(
  habitId: string,
  completedDate: string,
): Completion {
  return {
    id: `comp-${habitId}-${completedDate}`,
    userId: TEST_USER_ID,
    habitId,
    completedDate,
    createdAt: `${completedDate}T12:00:00Z`,
  };
}

// --- Mock Repositories ---

function createMockHabitRepository(
  overrides: Partial<HabitRepository> = {},
): HabitRepository {
  return {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeHabit()),
    update: vi.fn().mockResolvedValue(null),
    archive: vi.fn().mockResolvedValue(undefined),
    unarchive: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    findArchived: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createMockCompletionRepository(
  overrides: Partial<CompletionRepository> = {},
): CompletionRepository {
  return {
    findByHabitId: vi.fn().mockResolvedValue([]),
    findByDate: vi.fn().mockResolvedValue([]),
    findByHabitIdAndDateRange: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((habitId: string, date: string) =>
      Promise.resolve(makeCompletion(habitId, date)),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// --- Mock useAuthContext ---

vi.mock('@/hooks/useAuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'user-test-123' },
    isLoading: false,
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn().mockResolvedValue(true),
  }),
}));

// --- Mock useRepositories ---

let mockHabitRepository: HabitRepository;
let mockCompletionRepository: CompletionRepository;

vi.mock('@/hooks/useRepositories', () => ({
  useRepositories: () => ({
    habitRepository: mockHabitRepository,
    completionRepository: mockCompletionRepository,
  }),
}));

// --- Helpers ---

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderWithRouter(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TodayPage />
    </MemoryRouter>,
  );
}

// --- Tests ---

describe('TodayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHabitRepository = createMockHabitRepository();
    mockCompletionRepository = createMockCompletionRepository();
  });

  it('displays loading state initially', () => {
    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    renderWithRouter();
    expect(screen.getByRole('status', { name: '読み込み中' })).toBeInTheDocument();
  });

  it('displays today heading and date', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });

  it('displays empty state when no habits are due today', async () => {
    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue([]),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByText('今日やるべき習慣はありません'),
      ).toBeInTheDocument();
    });
  });

  it('displays habits that are due today', async () => {
    const habits = [
      makeHabit({ id: 'h1', name: '朝のジョギング' }),
      makeHabit({ id: 'h2', name: '読書' }),
    ];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('朝のジョギング')).toBeInTheDocument();
      expect(screen.getByText('読書')).toBeInTheDocument();
    });
  });

  it('filters habits not due today (weekly_days)', async () => {
    const today = new Date();
    const todayDay = today.getDay();
    // Create a habit for a day that is NOT today
    const notTodayDay = (todayDay + 1) % 7;

    const habits = [
      makeHabit({
        id: 'h1',
        name: '今日の習慣',
        frequency: { type: 'daily' },
      }),
      makeHabit({
        id: 'h2',
        name: '今日じゃない習慣',
        frequency: { type: 'weekly_days', days: [notTodayDay] },
      }),
    ];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('今日の習慣')).toBeInTheDocument();
      expect(screen.queryByText('今日じゃない習慣')).not.toBeInTheDocument();
    });
  });

  it('shows completed habits with checkmarks', async () => {
    const todayStr = getTodayStr();
    const habits = [makeHabit({ id: 'h1', name: '完了した習慣' })];
    const completions = [makeCompletion('h1', todayStr)];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });
    mockCompletionRepository = createMockCompletionRepository({
      findByDate: vi.fn().mockResolvedValue(completions),
    });

    renderWithRouter();

    await waitFor(() => {
      const nameEl = screen.getByText('完了した習慣');
      expect(nameEl).toHaveClass('line-through');
    });
  });

  it('displays progress summary', async () => {
    const todayStr = getTodayStr();
    const habits = [
      makeHabit({ id: 'h1', name: '習慣1' }),
      makeHabit({ id: 'h2', name: '習慣2' }),
    ];
    const completions = [makeCompletion('h1', todayStr)];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });
    mockCompletionRepository = createMockCompletionRepository({
      findByDate: vi.fn().mockResolvedValue(completions),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });
  });

  it('displays error state when habit loading fails', async () => {
    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockRejectedValue(new Error('ネットワークエラー')),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByText(/エラーが発生しました: ネットワークエラー/),
      ).toBeInTheDocument();
    });
  });

  it('shows retry button on error that calls refresh', async () => {
    const findAllMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('一時的なエラー'))
      .mockResolvedValueOnce([makeHabit({ id: 'h1', name: 'リトライ後の習慣' })]);

    mockHabitRepository = createMockHabitRepository({
      findAll: findAllMock,
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('再試行')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('再試行'));

    await waitFor(() => {
      expect(findAllMock).toHaveBeenCalledTimes(2);
    });
  });

  it('toggles completion when checkbox is clicked', async () => {
    const habits = [makeHabit({ id: 'h1', name: 'トグル習慣' })];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });
    mockCompletionRepository = createMockCompletionRepository({
      findByDate: vi.fn().mockResolvedValue([]),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('トグル習慣')).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'トグル習慣を完了にする',
    });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockCompletionRepository.create).toHaveBeenCalledWith(
        'h1',
        getTodayStr(),
      );
    });
  });

  it('handleRetry clears completionsError and reloads completions', async () => {
    const todayStr = getTodayStr();
    const findAllMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('habits error'))
      .mockResolvedValueOnce([makeHabit({ id: 'h1', name: 'リトライ後の習慣' })]);

    const findByDateMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('completions error'))
      .mockResolvedValueOnce([makeCompletion('h1', todayStr)]);

    mockHabitRepository = createMockHabitRepository({
      findAll: findAllMock,
    });
    mockCompletionRepository = createMockCompletionRepository({
      findByDate: findByDateMock,
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('再試行')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('再試行'));

    await waitFor(() => {
      expect(findAllMock).toHaveBeenCalledTimes(2);
      expect(findByDateMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('リトライ後の習慣')).toBeInTheDocument();
      const nameEl = screen.getByText('リトライ後の習慣');
      expect(nameEl).toHaveClass('line-through');
    });
  });

  it('shows weekly progress for weekly_count habits', async () => {
    const habits = [
      makeHabit({
        id: 'h1',
        name: '週3回の習慣',
        frequency: { type: 'weekly_count', count: 3 },
      }),
    ];

    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue(habits),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('週3回の習慣')).toBeInTheDocument();
      expect(screen.getByText(/今週.*0.*\/.*3/)).toBeInTheDocument();
    });
  });

  it('shows date navigation header', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '前の日' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '次の日' })).toBeInTheDocument();
    });
  });

  it('does not show "今日に戻る" button when viewing today', async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    expect(screen.queryByText('今日に戻る')).not.toBeInTheDocument();
  });

  it('shows "今日に戻る" button and past empty state when viewing past date', async () => {
    mockHabitRepository = createMockHabitRepository({
      findAll: vi.fn().mockResolvedValue([]),
    });

    renderWithRouter(['/?date=2020-01-01']);

    await waitFor(() => {
      expect(screen.getByText('今日に戻る')).toBeInTheDocument();
      expect(
        screen.getByText('この日にやるべき習慣はありませんでした'),
      ).toBeInTheDocument();
    });
  });

  it('shows date title instead of "Today" for non-today dates', async () => {
    renderWithRouter(['/?date=2020-03-15']);

    await waitFor(() => {
      expect(screen.getByText('2020年3月15日')).toBeInTheDocument();
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });
});
