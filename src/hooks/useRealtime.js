import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getEcho } from '../lib/echo';
import { connection } from '../lib/connection';
import { patchDeviceCache } from './useDevices';

/**
 * Subscribes to `private-users.{id}` and writes pushed values straight into the
 * TanStack Query cache, so cards and detail update without refetching.
 */
export function useRealtime(userId, { onAlarmRinging } = {}) {
  const qc = useQueryClient();
  const ringRef = useRef(onAlarmRinging);
  ringRef.current = onAlarmRinging;

  useEffect(() => {
    if (!userId) return undefined;
    const echo = getEcho();
    if (!echo) {
      connection.reportSocket('unavailable');
      return undefined;
    }
    const name = `users.${userId}`;
    const channel = echo.private(name);

    channel
      .listen('.device.state', ({ device_id, state }) => {
        patchDeviceCache(qc, device_id, (d) => ({
          ...d,
          state: { ...(d.state ?? {}), ...state },
          next_alarm: state?.next_alarm ?? d.next_alarm,
          online: true,
          last_seen_at: new Date().toISOString(),
        }));
      })
      .listen('.device.status', ({ device_id, online, last_seen_at }) => {
        patchDeviceCache(qc, device_id, (d) => ({ ...d, online, last_seen_at: last_seen_at ?? d.last_seen_at }));
        // Alarms come back from cache (stale) while offline; refresh when the clock returns.
        if (online) qc.invalidateQueries({ queryKey: ['alarms', device_id] });
      })
      .listen('.discovery.finished', ({ devices }) => {
        qc.setQueryData(['discovery'], (prev) => ({
          ...(prev ?? {}),
          data: devices ?? [],
          scanned_at: new Date().toISOString(),
          finishedAt: Date.now(),
        }));
      })
      .listen('.alarm.ringing', (payload) => ringRef.current?.(payload));

    return () => echo.leave(name);
  }, [userId, qc]);
}
