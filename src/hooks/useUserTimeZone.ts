/**
 * useUserTimeZone - ユーザーの profiles.timezone を解決する。
 *
 * 解決できるまで、および取得に失敗した場合はブラウザのタイムゾーンに
 * フォールバックする。isActiveOnDate など timeZone を要求する純粋関数へ
 * 渡す値の解決をこのフックに閉じ込める。useTimezoneSync（書き込み専用・
 * ベストエフォート）の読み取り版に相当する。
 */

import { useEffect, useState } from 'react';
import type { ProfileRepository } from '../data/repositories/profileRepository';
import { getBrowserTimeZone } from '../domain/services/timeService';

export function useUserTimeZone(repository: ProfileRepository | null): string {
  const [timeZone, setTimeZone] = useState(getBrowserTimeZone);

  useEffect(() => {
    if (!repository) return;

    let cancelled = false;

    async function resolve(): Promise<void> {
      try {
        const profile = await repository!.findMine();
        if (!cancelled && profile) {
          setTimeZone(profile.timezone);
        }
      } catch {
        // ベストエフォート。取得に失敗した場合はブラウザのタイムゾーンを使い続ける。
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [repository]);

  return timeZone;
}
