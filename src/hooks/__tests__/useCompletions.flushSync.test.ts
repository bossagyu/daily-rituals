/**
 * Tests that the useCompletions hook wraps the optimistic update setState
 * with flushSync to ensure immediate DOM updates on iOS Safari.
 *
 * We verify this by mocking react-dom's flushSync and checking it is
 * called exactly once during toggleCompletion's optimistic update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-dom before importing the module under test
const flushSyncMock = vi.fn((fn: () => void) => fn());

vi.mock('react-dom', () => ({
  flushSync: flushSyncMock,
}));

// Mock react to capture setState calls
const setStateMock = vi.fn();
const useStateMock = vi.fn(() => [
  { completions: [], loading: false, error: null },
  setStateMock,
]);
const useRefMock = vi.fn(() => ({ current: [] }));
const useCallbackMock = vi.fn((fn: unknown) => fn);
const useEffectMock = vi.fn();

vi.mock('react', () => ({
  useState: () => useStateMock(),
  useRef: () => useRefMock(),
  useCallback: (fn: unknown) => useCallbackMock(fn),
  useEffect: () => useEffectMock(),
}));

// Mock react-router-dom
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

// Mock completionOperations
vi.mock('../completionOperations', () => ({
  buildIsCompleted: vi.fn(() => () => false),
  computeOptimisticCompletions: vi.fn(() => []),
  loadCompletionsByDate: vi.fn(),
  performToggleWithRetry: vi.fn().mockResolvedValue([]),
  extractErrorMessage: vi.fn((e: unknown) => String(e)),
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor() {
      super('SESSION_EXPIRED');
    }
  },
}));

describe('useCompletions flushSync integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useCallback to pass-through
    useCallbackMock.mockImplementation((fn: unknown) => fn);
    useStateMock.mockReturnValue([
      { completions: [], loading: false, error: null },
      setStateMock,
    ]);
  });

  it('wraps optimistic setState with flushSync during toggleCompletion', async () => {
    // Dynamic import after mocks are set up
    const { useCompletions } = await import('../useCompletions');

    const mockRepo = {
      findByHabitId: vi.fn(),
      findByDate: vi.fn(),
      findByHabitIdAndDateRange: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };

    // Call the hook to get the toggleCompletion function
    const result = useCompletions(mockRepo, '2025-03-10');

    // Clear any setup calls
    flushSyncMock.mockClear();
    setStateMock.mockClear();

    // Call toggleCompletion
    await result.toggleCompletion('h1', '2025-03-10');

    // Verify flushSync was called exactly once (for optimistic update only)
    expect(flushSyncMock).toHaveBeenCalledTimes(1);

    // Verify the callback passed to flushSync calls setState
    expect(setStateMock).toHaveBeenCalled();
  });

  it('does not use flushSync for server confirmation setState', async () => {
    const { useCompletions } = await import('../useCompletions');

    const mockRepo = {
      findByHabitId: vi.fn(),
      findByDate: vi.fn(),
      findByHabitIdAndDateRange: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };

    const result = useCompletions(mockRepo, '2025-03-10');

    flushSyncMock.mockClear();

    await result.toggleCompletion('h1', '2025-03-10');

    // flushSync should be called exactly once (optimistic update only),
    // not for the server confirmation setState
    expect(flushSyncMock).toHaveBeenCalledTimes(1);
  });
});
