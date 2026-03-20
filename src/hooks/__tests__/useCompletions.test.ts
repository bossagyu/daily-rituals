import type { CompletionRepository } from '../../data/repositories';
import type { Completion } from '../../domain/models';
import {
  buildIsCompleted,
  performToggle,
  performToggleWithRetry,
  loadCompletionsByDate,
  extractErrorMessage,
  computeOptimisticCompletions,
} from '../completionOperations';

// --- Helpers ---

const makeCompletion = (
  habitId: string,
  completedDate: string,
): Completion => ({
  id: `comp-${habitId}-${completedDate}`,
  userId: 'user-abc-123',
  habitId,
  completedDate,
  createdAt: `${completedDate}T12:00:00Z`,
});

const createMockRepository = (
  overrides: Partial<CompletionRepository> = {},
): CompletionRepository => ({
  findByHabitId: vi.fn().mockResolvedValue([]),
  findByDate: vi.fn().mockResolvedValue([]),
  findByHabitIdAndDateRange: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue(makeCompletion('h1', '2025-03-10')),
  delete: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// --- Tests ---

describe('buildIsCompleted', () => {
  const TODAY = '2025-03-10';

  it('returns true when habit is completed on the given date', () => {
    const completions = [
      makeCompletion('h1', TODAY),
      makeCompletion('h2', TODAY),
    ];
    const isCompleted = buildIsCompleted(completions);

    expect(isCompleted('h1', TODAY)).toBe(true);
    expect(isCompleted('h2', TODAY)).toBe(true);
  });

  it('returns false when habit is not in completions', () => {
    const completions = [makeCompletion('h1', TODAY)];
    const isCompleted = buildIsCompleted(completions);

    expect(isCompleted('h999', TODAY)).toBe(false);
  });

  it('returns false when habit is completed on a different date', () => {
    const completions = [makeCompletion('h1', '2025-03-09')];
    const isCompleted = buildIsCompleted(completions);

    expect(isCompleted('h1', TODAY)).toBe(false);
  });

  it('returns false when completions are empty', () => {
    const isCompleted = buildIsCompleted([]);

    expect(isCompleted('h1', TODAY)).toBe(false);
  });
});

describe('performToggle', () => {
  const TODAY = '2025-03-10';

  it('creates a completion when habit is not yet completed', async () => {
    const newCompletion = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      create: vi.fn().mockResolvedValue(newCompletion),
    });
    const currentCompletions: readonly Completion[] = [];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(repo.create).toHaveBeenCalledWith('h1', TODAY);
    expect(result).toContainEqual(newCompletion);
  });

  it('deletes a completion when habit is already completed', async () => {
    const existing = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const currentCompletions: readonly Completion[] = [existing];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(repo.delete).toHaveBeenCalledWith('h1', TODAY);
    expect(result).not.toContainEqual(existing);
  });

  it('preserves other completions when creating', async () => {
    const other = makeCompletion('h2', TODAY);
    const newCompletion = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      create: vi.fn().mockResolvedValue(newCompletion),
    });
    const currentCompletions: readonly Completion[] = [other];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(result).toContainEqual(other);
    expect(result).toContainEqual(newCompletion);
  });

  it('removes only the matching completion when deleting', async () => {
    const existing = makeCompletion('h1', TODAY);
    const other = makeCompletion('h2', TODAY);
    const repo = createMockRepository({
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const currentCompletions: readonly Completion[] = [existing, other];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(result).not.toContainEqual(existing);
    expect(result).toContainEqual(other);
  });

  it('throws error when repository create fails', async () => {
    const repo = createMockRepository({
      create: vi.fn().mockRejectedValue(new Error('Write error')),
    });

    await expect(
      performToggle(repo, [], 'h1', TODAY),
    ).rejects.toThrow('Write error');
  });

  it('throws error when repository delete fails', async () => {
    const existing = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      delete: vi.fn().mockRejectedValue(new Error('Delete error')),
    });

    await expect(
      performToggle(repo, [existing], 'h1', TODAY),
    ).rejects.toThrow('Delete error');
  });
});

describe('performToggleWithRetry', () => {
  const TODAY = '2025-03-10';

  it('calls performToggle directly when no RLS error occurs', async () => {
    const newCompletion = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      create: vi.fn().mockResolvedValue(newCompletion),
    });
    const refreshSession = vi.fn();

    const result = await performToggleWithRetry(
      repo,
      [],
      'h1',
      TODAY,
      refreshSession,
    );

    expect(result).toContainEqual(newCompletion);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('retries after session refresh when RLS error (42501) occurs', async () => {
    const newCompletion = makeCompletion('h1', TODAY);
    const rlsError = new Error('new row violates row-level security policy');
    (rlsError as unknown as Record<string, unknown>).code = '42501';

    const repo = createMockRepository({
      create: vi
        .fn()
        .mockRejectedValueOnce(rlsError)
        .mockResolvedValueOnce(newCompletion),
    });
    const refreshSession = vi.fn().mockResolvedValue(true);

    const result = await performToggleWithRetry(
      repo,
      [],
      'h1',
      TODAY,
      refreshSession,
    );

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(2);
    expect(result).toContainEqual(newCompletion);
  });

  it('throws SessionExpiredError when session refresh fails after RLS error', async () => {
    const rlsError = new Error('new row violates row-level security policy');
    (rlsError as unknown as Record<string, unknown>).code = '42501';

    const repo = createMockRepository({
      create: vi.fn().mockRejectedValue(rlsError),
    });
    const refreshSession = vi.fn().mockResolvedValue(false);

    await expect(
      performToggleWithRetry(repo, [], 'h1', TODAY, refreshSession),
    ).rejects.toThrow('SESSION_EXPIRED');

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('throws original error for non-RLS errors without retry', async () => {
    const repo = createMockRepository({
      create: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const refreshSession = vi.fn();

    await expect(
      performToggleWithRetry(repo, [], 'h1', TODAY, refreshSession),
    ).rejects.toThrow('Network error');

    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe('loadCompletionsByDate', () => {
  const TODAY = '2025-03-10';

  it('fetches completions by date from repository', async () => {
    const completions = [
      makeCompletion('h1', TODAY),
      makeCompletion('h2', TODAY),
    ];
    const repo = createMockRepository({
      findByDate: vi.fn().mockResolvedValue(completions),
    });

    const result = await loadCompletionsByDate(repo, TODAY);

    expect(result).toEqual(completions);
    expect(repo.findByDate).toHaveBeenCalledWith(TODAY);
  });

  it('returns empty array when no completions exist', async () => {
    const repo = createMockRepository({
      findByDate: vi.fn().mockResolvedValue([]),
    });

    const result = await loadCompletionsByDate(repo, TODAY);

    expect(result).toEqual([]);
  });

  it('propagates repository errors', async () => {
    const repo = createMockRepository({
      findByDate: vi.fn().mockRejectedValue(new Error('Connection lost')),
    });

    await expect(loadCompletionsByDate(repo, TODAY)).rejects.toThrow(
      'Connection lost',
    );
  });
});

describe('computeOptimisticCompletions', () => {
  const TODAY = '2025-03-10';

  it('adds a placeholder completion when habit is not yet completed', () => {
    const currentCompletions: readonly Completion[] = [];
    const result = computeOptimisticCompletions(currentCompletions, 'h1', TODAY);

    expect(result).toHaveLength(1);
    expect(result[0].habitId).toBe('h1');
    expect(result[0].completedDate).toBe(TODAY);
    expect(result[0].id).toMatch(/^optimistic-/);
  });

  it('removes the completion when habit is already completed', () => {
    const existing = makeCompletion('h1', TODAY);
    const currentCompletions: readonly Completion[] = [existing];

    const result = computeOptimisticCompletions(currentCompletions, 'h1', TODAY);

    expect(result).toHaveLength(0);
  });

  it('preserves other completions when adding', () => {
    const other = makeCompletion('h2', TODAY);
    const currentCompletions: readonly Completion[] = [other];

    const result = computeOptimisticCompletions(currentCompletions, 'h1', TODAY);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(other);
    expect(result.find((c) => c.habitId === 'h1')).toBeDefined();
  });

  it('preserves other completions when removing', () => {
    const existing = makeCompletion('h1', TODAY);
    const other = makeCompletion('h2', TODAY);
    const currentCompletions: readonly Completion[] = [existing, other];

    const result = computeOptimisticCompletions(currentCompletions, 'h1', TODAY);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual(other);
  });

  it('does not mutate the original array', () => {
    const original: readonly Completion[] = [makeCompletion('h1', TODAY)];
    const originalCopy = [...original];

    computeOptimisticCompletions(original, 'h1', TODAY);

    expect(original).toEqual(originalCopy);
  });
});

describe('extractErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(extractErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('converts non-Error values to string', () => {
    expect(extractErrorMessage('string error')).toBe('string error');
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(null)).toBe('null');
  });
});
