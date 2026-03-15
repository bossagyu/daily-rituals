/**
 * Tests for repositoryContext - useRepositories hook behavior.
 */

const mockUseContext = jest.fn();

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  createContext: jest.requireActual('react').createContext,
  useContext: (...args: unknown[]) => mockUseContext(...args),
}));

import { useRepositories } from '../repositoryHook';

describe('useRepositories', () => {
  afterEach(() => {
    mockUseContext.mockReset();
  });

  it('throws an error when used outside of RepositoryProvider', () => {
    mockUseContext.mockReturnValue(null);

    expect(() => useRepositories()).toThrow(
      'useRepositories must be used within a RepositoryProvider',
    );
  });

  it('returns the context value when used within a RepositoryProvider', () => {
    const mockRepos = {
      habitRepository: { findAll: jest.fn() },
      completionRepository: { findByDate: jest.fn() },
    };
    mockUseContext.mockReturnValue(mockRepos);

    const result = useRepositories();
    expect(result).toBe(mockRepos);
  });
});
