import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { useConnection } from '../lib/connection';

export const deviceKeys = {
  all: ['devices'],
  one: (id) => ['device', id],
};

/** Apply `fn(device) → device` to a device in both the list and its detail cache. */
export function patchDeviceCache(qc, id, fn) {
  qc.setQueryData(deviceKeys.all, (list) => (Array.isArray(list) ? list.map((d) => (d.id === id ? fn(d) : d)) : list));
  qc.setQueryData(deviceKeys.one(id), (d) => (d ? fn(d) : d));
}

function storeDevice(qc, device) {
  if (!device) return;
  qc.setQueryData(deviceKeys.one(device.id), device);
  qc.setQueryData(deviceKeys.all, (list) => {
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
  return useQuery({ queryKey: deviceKeys.all, queryFn: api.devices, refetchInterval });
}

export function useDevice(id) {
  const qc = useQueryClient();
  const refetchInterval = usePollInterval(15_000);
  return useQuery({
    queryKey: deviceKeys.one(id),
    queryFn: () => api.device(id),
    enabled: !!id,
    refetchInterval,
    initialData: () => qc.getQueryData(deviceKeys.all)?.find((d) => d.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(deviceKeys.all)?.dataUpdatedAt,
  });
}

export function useRenameDevice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name) => api.renameDevice(id, name),
    onMutate: async (name) => {
      const prev = qc.getQueryData(deviceKeys.one(id));
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
      qc.setQueryData(deviceKeys.all, (list) => (Array.isArray(list) ? list.filter((d) => d.id !== id) : list));
      qc.removeQueries({ queryKey: deviceKeys.one(id) });
      qc.removeQueries({ queryKey: ['alarms', id] });
      qc.removeQueries({ queryKey: ['readings', id] });
    },
  });
}

export { storeDevice };
