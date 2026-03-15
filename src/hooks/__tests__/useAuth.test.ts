import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager, INITIAL_AUTH_STATE, type AuthState } from '../useAuth';
import type { User, SupabaseClient } from '@supabase/supabase-js';

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

const createMockSupabaseClient = () => {
  const mockSignInWithOAuth = vi.fn();
  const mockSignOut = vi.fn();
  const mockGetUser = vi.fn();
  const mockUnsubscribe = vi.fn();
  let authCallback: Function | null = null;

  const mockOnAuthStateChange = vi.fn().mockImplementation((cb: Function) => {
    authCallback = cb;
    return {
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    };
  });

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
    mockUnsubscribe,
    triggerAuthChange: (event: string, session: unknown) => {
      if (authCallback) {
        authCallback(event, session);
      }
    },
  };
};

describe('INITIAL_AUTH_STATE', () => {
  it('should have correct initial values', () => {
    expect(INITIAL_AUTH_STATE).toEqual({
      user: null,
      isLoading: true,
      error: null,
    });
  });
});

describe('AuthManager', () => {
  let stateCallback: (state: AuthState) => void;
  let latestState: AuthState;

  beforeEach(() => {
    latestState = INITIAL_AUTH_STATE;
    stateCallback = (state: AuthState) => {
      latestState = state;
    };
  });

  describe('initialize', () => {
    it('should set user and stop loading when user is authenticated', async () => {
      const { client, mockGetUser } = createMockSupabaseClient();
      const mockUser = createMockUser();
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      expect(latestState.user).toEqual(mockUser);
      expect(latestState.isLoading).toBe(false);
      expect(latestState.error).toBeNull();
    });

    it('should set user to null when not authenticated', async () => {
      const { client, mockGetUser } = createMockSupabaseClient();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      expect(latestState.user).toBeNull();
      expect(latestState.isLoading).toBe(false);
    });

    it('should set user-friendly error when initialization fails', async () => {
      const { client, mockGetUser } = createMockSupabaseClient();
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Network error', status: 500, name: 'AuthError' },
      });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      expect(latestState.error).toBe(
        '認証に失敗しました。もう一度お試しください。'
      );
      expect(latestState.isLoading).toBe(false);
      expect(latestState.user).toBeNull();
    });

    it('should register auth state listener before awaiting getCurrentUser', async () => {
      const { client, mockGetUser, mockOnAuthStateChange } =
        createMockSupabaseClient();
      const callOrder: string[] = [];

      mockOnAuthStateChange.mockImplementation((cb: Function) => {
        callOrder.push('onAuthStateChange');
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      mockGetUser.mockImplementation(async () => {
        callOrder.push('getUser');
        return { data: { user: null }, error: null };
      });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      expect(callOrder).toEqual(['onAuthStateChange', 'getUser']);
    });
  });

  describe('signIn', () => {
    it('should call signInWithOAuth with google provider', async () => {
      const { client, mockSignInWithOAuth, mockGetUser } =
        createMockSupabaseClient();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();
      await manager.signIn();

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
      });
    });

    it('should set user-friendly error when sign-in fails', async () => {
      const { client, mockSignInWithOAuth, mockGetUser } =
        createMockSupabaseClient();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockSignInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: 'OAuth failed', status: 400, name: 'AuthError' },
      });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();
      await manager.signIn();

      expect(latestState.error).toBe(
        '認証に失敗しました。もう一度お試しください。'
      );
    });
  });

  describe('signOut', () => {
    it('should clear user on successful sign-out', async () => {
      const { client, mockGetUser, mockSignOut } = createMockSupabaseClient();
      const mockUser = createMockUser();
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();
      await manager.signOut();

      expect(latestState.user).toBeNull();
    });

    it('should set user-friendly error when sign-out fails', async () => {
      const { client, mockGetUser, mockSignOut } = createMockSupabaseClient();
      const mockUser = createMockUser();
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSignOut.mockResolvedValue({
        error: {
          message: 'Sign out failed',
          status: 500,
          name: 'AuthError',
        },
      });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();
      await manager.signOut();

      expect(latestState.error).toBe(
        '認証に失敗しました。もう一度お試しください。'
      );
    });
  });

  describe('auth state change listener', () => {
    it('should update user when auth state changes to SIGNED_IN', async () => {
      const { client, mockGetUser, triggerAuthChange } =
        createMockSupabaseClient();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      const mockUser = createMockUser();
      triggerAuthChange('SIGNED_IN', { user: mockUser });

      expect(latestState.user).toEqual(mockUser);
    });

    it('should clear user when auth state changes to SIGNED_OUT', async () => {
      const { client, mockGetUser, triggerAuthChange } =
        createMockSupabaseClient();
      const mockUser = createMockUser();
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();

      triggerAuthChange('SIGNED_OUT', null);

      expect(latestState.user).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should unsubscribe from auth state changes', async () => {
      const { client, mockGetUser, mockUnsubscribe } =
        createMockSupabaseClient();
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const manager = new AuthManager(client, stateCallback);
      await manager.initialize();
      manager.dispose();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
