/**
 * ProfileRepository - ユーザープロフィールの読み書き。
 */

export type Profile = {
  readonly id: string;
  readonly displayName: string | null;
  readonly timezone: string;
};

export interface ProfileRepository {
  /** 認証済みユーザー自身のプロフィールを返す。存在しなければ null。 */
  findMine(): Promise<Profile | null>;
  /** 自分の timezone を更新する。 */
  updateTimezone(timezone: string): Promise<void>;
}
