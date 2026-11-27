import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { storeDevice } from './useDevices';
import { qk } from './keys';

/** How long a LAN scan may take before the UI stops showing "scanning". */
export const SCAN_TIMEOUT = 12_000;

/**
 * Discovery: `start()` kicks off a LAN scan. The result normally arrives as `.discovery.finished`
 * (useRealtime writes it into the cache); without the socket it is polled a few times.
 * `finished` is true once a result newer than the current scan is in.
 */
export function useScan() {
  const qc = useQueryClient();
  const [startedAt, setStartedAt] = useState(null);
  const { data } = useQuery({ queryKey: qk.discovery, queryFn: api.discovery, staleTime: 0 });
  const { mutateAsync: start } = useMutation({
    mutationFn: () => api.scan(),
    onMutate: () => setStartedAt(Date.now()),
  });

  useEffect(() => {
    if (!startedAt) return undefined;
    const timers = [5000, 9000, SCAN_TIMEOUT].map((ms) =>
      setTimeout(() => qc.invalidateQueries({ queryKey: qk.discovery }), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [startedAt, qc]);

  return {
    start,
    startedAt,
    finished: (data?.finishedAt ?? 0) > (startedAt ?? 0),
    found: data?.data ?? [],
  };
}

/** Ask a host what it is: `{host, name, id, type, supported, paired_here}`. */
export function useProbe() {
  return useMutation({ mutationFn: (host) => api.probe(host) });
}

/** Ask the clock to show a pairing code: `{expires_in}`. */
export function usePairStart() {
  return useMutation({ mutationFn: (host) => api.pairStart(host) });
}

/** Confirm the code; the backend creates the device and returns it. */
export function usePairConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ host, code }) => api.pairConfirm(host, code),
    onSuccess: (device) => {
      storeDevice(qc, device);
      qc.invalidateQueries({ queryKey: qk.devices });
      qc.invalidateQueries({ queryKey: qk.discovery });
    },
  });
}
