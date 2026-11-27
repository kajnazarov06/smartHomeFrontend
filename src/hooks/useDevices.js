import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { useConnection } from '../lib/connection';
import { qk } from './keys';

/** Apply `fn(device) → device` to a device in both the list and its detail cache. */
export function patchDeviceCache(qc, id, fn) {
  qc.setQueryData(qk.devices, (list) => (Array.isArray(list) ? list.map((d) => (d.id === id ? fn(d) : d)) : list));
  qc.setQueryData(qk.device(id), (d) => (d ? fn(d) : d));
}

/** Write a device the server returned into the detail cache and the list (inserted by name if new). */
export function storeDevice(qc, device) {
  if (!device) return;
  qc.setQueryData(qk.device(device.id), device);
  qc.setQueryData(qk.devices, (list) => {
    if (!Array.isArray(list)) return list;
    return list.some((d) => d.id === device.id)
      ? list.map((d) => (d.id === device.id ? device : d))
      : [...list, device].sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Live socket down → poll as a fallback (live updates normally arrive through Echo). */
function usePollInterval(ms) {
  const { socket } = useConnection();
  return socket === 'connected' ? false : ms;
}

export function useDevices() {
  const refetchInterval = usePollInterval(15_000);
  return useQuery({ queryKey: qk.devices, queryFn: api.devices, refetchInterval });
}

export function useDevice(id) {
  const qc = useQueryClient();
  const refetchInterval = usePollInterval(15_000);
  return useQuery({
    queryKey: qk.device(id),
    queryFn: () => api.device(id),
    enabled: !!id,
    refetchInterval,
    initialData: () => qc.getQueryData(qk.devices)?.find((d) => d.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.devices)?.dataUpdatedAt,
  });
}

export function useRenameDevice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name) => api.renameDevice(id, name),
    onMutate: async (name) => {
      const prev = qc.getQueryData(qk.device(id));
      patchDeviceCache(qc, id, (d) => ({ ...d, name }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && storeDevice(qc, ctx.prev),
    onSuccess: (device) => storeDevice(qc, device),
  });
}

export function useUpdateSettings(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings) => api.updateSettings(id, settings),
    onSuccess: (device) => storeDevice(qc, device),
  });
}

export function useRemoveDevice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ force } = {}) => api.removeDevice(id, { force }),
    onSuccess: () => {
      qc.setQueryData(qk.devices, (list) => (Array.isArray(list) ? list.filter((d) => d.id !== id) : list));
      qc.removeQueries({ queryKey: qk.device(id) });
      qc.removeQueries({ queryKey: qk.alarms(id) });
      qc.removeQueries({ queryKey: qk.readings(id) });
    },
  });
}
