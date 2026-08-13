/**
 * タイムゾーン同期の純粋なビジネスロジック。
 */

import type { ProfileRepository } from '../data/repositories/profileRepository';
import { isValidTimeZone } from '../domain/services/timeService';

/**
 * ブラウザのタイムゾーンが DB の値と異なれば更新する。
 *
 * 旅行や引っ越しでタイムゾーンが変わったとき、リマインダーの判定基準を
 * 自動的に追従させるために呼ぶ。
 */
export async function syncTimezone(
  repository: ProfileRepository,
  browserTimeZone: string,
): Promise<void> {
  if (!isValidTimeZone(browserTimeZone)) {
    return;
  }

  const profile = await repository.findMine();
  if (!profile) {
    return;
  }

  if (profile.timezone === browserTimeZone) {
    return;
  }

  await repository.updateTimezone(browserTimeZone);
}
