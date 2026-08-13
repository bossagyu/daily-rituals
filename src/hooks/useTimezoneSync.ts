/**
 * useTimezoneSync - 起動時にブラウザのタイムゾーンを profiles へ同期する。
 *
 * ベストエフォート。失敗しても既存のタイムゾーンで動作を継続し、
 * ユーザーには通知しない。
 */

import { useEffect } from 'react';
import type { ProfileRepository } from '../data/repositories/profileRepository';
import { getBrowserTimeZone } from '../domain/services/timeService';
import { syncTimezone } from './timezoneSyncOperations';

export function useTimezoneSync(repository: ProfileRepository | null): void {
  useEffect(() => {
    if (!repository) return;

    async function sync(): Promise<void> {
      try {
        await syncTimezone(repository!, getBrowserTimeZone());
      } catch {
        // ベストエフォート。同期の失敗はアプリの動作を妨げない。
      }
    }

    void sync();
  }, [repository]);
}
