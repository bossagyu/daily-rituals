import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChange,
} from '../auth';

const createMockSupabaseClient = () => {
  const mockSignInWithOAuth = vi.fn();
  const mockSignOut = vi.fn();
  const mockGetUser = vi.fn();
  const mockOnAuthStateChange = vi.fn();

  const client = {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  } as unknown as SupabaseClient;

  return {
    client,
    mockSignInWithOAuth,
    mockSignOut,
    mockGetUser,
    mockOnAuthStateChange,
  };
};

const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-03-15T00:00:00Z',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Test User' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-15T00:00:00Z',
  ...overrides,
});

describe('signInWithGoogle', () => {
  it('should call signInWithOAuth with google provider', async () => {
    const { client, mockSignInWithOAuth } = createMockSupabaseClient();
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle(client);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
    });
  });

  it('should throw an error when OAuth sign-in fails', async () => {
    const { client, mockSignInWithOAuth } = createMockSupabaseClient();
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'OAuth error', status: 400, name: 'AuthError' },
    });

    await expect(signInWithGoogle(client)).rejects.toThrow('OAuth error');
  });
});

describe('signOut', () => {
  it('should call supabase signOut', async () => {
    const { client, mockSignOut } = createMockSupabaseClient();
    mockSignOut.mockResolvedValue({ error: null });

    await signOut(client);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should throw an error when sign-out fails', async () => {
    const { client, mockSignOut } = createMockSupabaseClient();
    mockSignOut.mockResolvedValue({
      error: { message: 'Sign out failed', status: 500, name: 'AuthError' },
    });

    await expect(signOut(client)).rejects.toThrow('Sign out failed');
  });
});

describe('getCurrentUser', () => {
  it('should return the current user when authenticated', async () => {
    const { client, mockGetUser } = createMockSupabaseClient();
    const mockUser = createMockUser();
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const user = await getCurrentUser(client);

    expect(user).toEqual(mockUser);
  });

  it('should return null when not authenticated', async () => {
    const { client, mockGetUser } = createMockSupabaseClient();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const user = await getCurrentUser(client);

    expect(user).toBeNull();
  });

  it('should throw an error when getUser fails', async () => {
    const { client, mockGetUser } = createMockSupabaseClient();
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Failed to get user', status: 401, name: 'AuthError' },
    });

    await expect(getCurrentUser(client)).rejects.toThrow(
      'Failed to get user'
    );
  });
});

describe('onAuthStateChange', () => {
  it('should subscribe to auth state changes and return unsubscribe function', () => {
    const { client, mockOnAuthStateChange } = createMockSupabaseClient();
    const mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const callback = vi.fn();
    const unsubscribe = onAuthStateChange(client, callback);

    expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should pass user to callback on SIGNED_IN event', () => {
    const { client, mockOnAuthStateChange } = createMockSupabaseClient();
    mockOnAuthStateChange.mockImplementation((cb: Function) => {
      const mockUser = createMockUser();
      cb('SIGNED_IN', { user: mockUser } as Session);
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });

    const callback = vi.fn();
    onAuthStateChange(client, callback);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-123' }));
  });

  it('should pass null to callback on SIGNED_OUT event', () => {
    const { client, mockOnAuthStateChange } = createMockSupabaseClient();
    mockOnAuthStateChange.mockImplementation((cb: Function) => {
      cb('SIGNED_OUT', null);
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });

    const callback = vi.fn();
    onAuthStateChange(client, callback);

    expect(callback).toHaveBeenCalledWith(null);
  });
});
