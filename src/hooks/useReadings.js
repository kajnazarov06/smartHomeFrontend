import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { qk } from './keys';

/** Bucketed history: 24h → 5 min buckets, 7d → 30 min buckets. */
export function useReadings(deviceId, range = '24h') {
  return useQuery({
    queryKey: qk.readings(deviceId, range),
    queryFn: () => api.readings(deviceId, range),
    enabled: !!deviceId,
    refetchInterval: range === '24h' ? 5 * 60_000 : 30 * 60_000,
    placeholderData: keepPreviousData,
    select: (res) =>
      (res?.points ?? []).map((p) => ({
        t: new Date(p.ts).getTime(),
        temperature: p.temperature_c == null ? null : Number(p.temperature_c),
        humidity: p.humidity_pct == null ? null : Number(p.humidity_pct),
      })),
  });
}
