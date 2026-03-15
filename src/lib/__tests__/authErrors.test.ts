import { describe, it, expect } from 'vitest';
import { toUserFriendlyAuthError } from '../authErrors';

describe('toUserFriendlyAuthError', () => {
  it('should return user-friendly message for known error: Invalid login credentials', () => {
    const result = toUserFriendlyAuthError('Invalid login credentials');
    expect(result).toBe('ログイン情報が正しくありません。');
  });

  it('should return user-friendly message for known error: Email not confirmed', () => {
    const result = toUserFriendlyAuthError('Email not confirmed');
    expect(result).toBe('メールアドレスの確認が完了していません。');
  });

  it('should return user-friendly message for known error: User already registered', () => {
    const result = toUserFriendlyAuthError('User already registered');
    expect(result).toBe('このメールアドレスは既に登録されています。');
  });

  it('should return user-friendly message for known error: Invalid Refresh Token', () => {
    const result = toUserFriendlyAuthError('Invalid Refresh Token');
    expect(result).toBe('セッションの有効期限が切れました。再度ログインしてください。');
  });

  it('should return user-friendly message for known error: Auth session missing', () => {
    const result = toUserFriendlyAuthError('Auth session missing');
    expect(result).toBe('セッションが見つかりません。再度ログインしてください。');
  });

  it('should return user-friendly message for known error: User not found', () => {
    const result = toUserFriendlyAuthError('User not found');
    expect(result).toBe('ユーザーが見つかりません。');
  });

  it('should return default message for unknown errors', () => {
    const result = toUserFriendlyAuthError('Some internal server error with stack trace');
    expect(result).toBe('認証に失敗しました。もう一度お試しください。');
  });

  it('should match partial error messages containing known keys', () => {
    const result = toUserFriendlyAuthError('Error: Invalid login credentials (code 401)');
    expect(result).toBe('ログイン情報が正しくありません。');
  });

  it('should not expose raw error messages for unknown errors', () => {
    const rawMessage = 'PostgreSQL connection failed at 10.0.0.5:5432';
    const result = toUserFriendlyAuthError(rawMessage);
    expect(result).not.toContain('PostgreSQL');
    expect(result).not.toContain('10.0.0.5');
  });
});
