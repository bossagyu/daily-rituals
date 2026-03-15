import type { CompletionRepository } from '../../data/repositories';
import type { Completion } from '../../domain/models';
import {
  buildIsCompleted,
  performToggle,
  loadCompletionsByDate,
  extractErrorMessage,
} from '../completionOperations';

// --- Helpers ---

const makeCompletion = (
  habitId: string,
  completedDate: string,
): Completion => ({
  id: `comp-${habitId}-${completedDate}`,
  habitId,
  completedDate,
  createdAt: `${completedDate}T12:00:00Z`,
});

const createMockRepository = (
  overrides: Partial<CompletionRepository> = {},
): CompletionRepository => ({
  findByHabitId: jest.fn().mockResolvedValue([]),
  findByDate: jest.fn().mockResolvedValue([]),
  findByHabitIdAndDateRange: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue(makeCompletion('h1', '2025-03-10')),
  delete: jest.fn().mockResolvedValue(undefined),
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
      create: jest.fn().mockResolvedValue(newCompletion),
    });
    const currentCompletions: readonly Completion[] = [];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(repo.create).toHaveBeenCalledWith('h1', TODAY);
    expect(result).toContainEqual(newCompletion);
  });

  it('deletes a completion when habit is already completed', async () => {
    const existing = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      delete: jest.fn().mockResolvedValue(undefined),
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
      create: jest.fn().mockResolvedValue(newCompletion),
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
      delete: jest.fn().mockResolvedValue(undefined),
    });
    const currentCompletions: readonly Completion[] = [existing, other];

    const result = await performToggle(repo, currentCompletions, 'h1', TODAY);

    expect(result).not.toContainEqual(existing);
    expect(result).toContainEqual(other);
  });

  it('throws error when repository create fails', async () => {
    const repo = createMockRepository({
      create: jest.fn().mockRejectedValue(new Error('Write error')),
    });

    await expect(
      performToggle(repo, [], 'h1', TODAY),
    ).rejects.toThrow('Write error');
  });

  it('throws error when repository delete fails', async () => {
    const existing = makeCompletion('h1', TODAY);
    const repo = createMockRepository({
      delete: jest.fn().mockRejectedValue(new Error('Delete error')),
    });

    await expect(
      performToggle(repo, [existing], 'h1', TODAY),
    ).rejects.toThrow('Delete error');
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
      findByDate: jest.fn().mockResolvedValue(completions),
    });

    const result = await loadCompletionsByDate(repo, TODAY);

    expect(result).toEqual(completions);
    expect(repo.findByDate).toHaveBeenCalledWith(TODAY);
  });

  it('returns empty array when no completions exist', async () => {
    const repo = createMockRepository({
      findByDate: jest.fn().mockResolvedValue([]),
    });

    const result = await loadCompletionsByDate(repo, TODAY);

    expect(result).toEqual([]);
  });

  it('propagates repository errors', async () => {
    const repo = createMockRepository({
      findByDate: jest.fn().mockRejectedValue(new Error('Connection lost')),
    });

    await expect(loadCompletionsByDate(repo, TODAY)).rejects.toThrow(
      'Connection lost',
    );
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
