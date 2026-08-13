/**
 * useUserTimeZone - ユーザーの profiles.timezone を解決する。
 *
 * 解決できるまで、取得に失敗した場合、および値が不正な IANA タイムゾーン名
 * だった場合はブラウザのタイムゾーンにフォールバックする。profiles.timezone
 * は制約なしの TEXT のため不正値が入り得る。ここで検証しないまま
 * isActiveOnDate → getLocalDate（内部で Intl.DateTimeFormat を構築）へ渡すと
 * render フェーズで RangeError が投げられ、呼び出し元に ErrorBoundary が
 * 無いため画面全体が白画面になる。isActiveOnDate など timeZone を要求する
 * 純粋関数へ渡す値の解決をこのフックに閉じ込める。useTimezoneSync
 * （書き込み専用・ベストエフォート）の読み取り版に相当する。
 */

import { useEffect, useState } from 'react';
import type { ProfileRepository } from '../data/repositories/profileRepository';
import { getBrowserTimeZone, isValidTimeZone } from '../domain/services/timeService';

export function useUserTimeZone(repository: ProfileRepository | null): string {
  const [timeZone, setTimeZone] = useState(getBrowserTimeZone);

  useEffect(() => {
    if (!repository) return;

    let cancelled = false;

    async function resolve(): Promise<void> {
      try {
        const profile = await repository!.findMine();
        if (!cancelled && profile) {
          setTimeZone(
            isValidTimeZone(profile.timezone) ? profile.timezone : getBrowserTimeZone(),
          );
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
