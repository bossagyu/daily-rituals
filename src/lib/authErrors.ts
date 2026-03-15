/**
 * Maps Supabase auth error messages to user-friendly Japanese messages.
 * Prevents internal server information from being exposed to users.
 */

const AUTH_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['Invalid login credentials', 'ログイン情報が正しくありません。'],
  ['Email not confirmed', 'メールアドレスの確認が完了していません。'],
  ['User already registered', 'このメールアドレスは既に登録されています。'],
  ['Invalid Refresh Token', 'セッションの有効期限が切れました。再度ログインしてください。'],
  ['Auth session missing', 'セッションが見つかりません。再度ログインしてください。'],
  ['User not found', 'ユーザーが見つかりません。'],
]);

const DEFAULT_AUTH_ERROR = '認証に失敗しました。もう一度お試しください。';

/**
 * Converts a raw error message from Supabase into a user-friendly message.
 *
 * @param rawMessage - The original error message from Supabase
 * @returns A user-friendly error message in Japanese
 */
export function toUserFriendlyAuthError(rawMessage: string): string {
  for (const [key, value] of AUTH_ERROR_MESSAGES) {
    if (rawMessage.includes(key)) {
      return value;
    }
  }
  return DEFAULT_AUTH_ERROR;
}
