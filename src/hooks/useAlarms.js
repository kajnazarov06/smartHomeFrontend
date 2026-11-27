import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { qk } from './keys';

/** A clock stores at most this many alarms. */
export const MAX_ALARMS = 10;

const sortAlarms = (list) => [...list].sort((a, b) => String(a.time).localeCompare(String(b.time)));

/** `{ alarms, stale }` — stale means the device was unreachable and this is the last known list. */
export function useAlarms(deviceId) {
  return useQuery({
    queryKey: qk.alarms(deviceId),
    queryFn: () => api.alarms(deviceId),
    enabled: !!deviceId,
    select: (res) => ({ alarms: sortAlarms(res?.data ?? []), stale: !!res?.meta?.stale }),
  });
}

/**
 * Alarm writes are optimistic: the list changes immediately and rolls back if the
 * clock rejects the change (the caller shows the error toast).
 */
function useOptimistic(deviceId, mutationFn, apply, settle) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.alarms(deviceId) });
      const prev = qc.getQueryData(qk.alarms(deviceId));
      qc.setQueryData(qk.alarms(deviceId), (res) => res && { ...res, data: apply(res.data ?? [], vars) });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.alarms(deviceId), ctx.prev);
    },
    onSuccess: (result, vars) => {
      if (settle) qc.setQueryData(qk.alarms(deviceId), (res) => res && { ...res, data: settle(res.data ?? [], result, vars) });
      // next_alarm on the device card changes with the alarm list.
      qc.invalidateQueries({ queryKey: qk.device(deviceId) });
      qc.invalidateQueries({ queryKey: qk.devices });
    },
  });
}

let tempId = -1;

export function useCreateAlarm(deviceId) {
  return useOptimistic(
    deviceId,
    ({ alarm }) => api.createAlarm(deviceId, alarm),
    (list, vars) => {
      vars.tempId = tempId--;
      return [...list, { enabled: true, ...vars.alarm, id: vars.tempId, pending: true }];
    },
    (list, saved, vars) => list.map((a) => (a.id === vars.tempId ? saved : a)),
  );
}

export function useUpdateAlarm(deviceId) {
  return useOptimistic(
    deviceId,
    ({ id, patch }) => api.updateAlarm(deviceId, id, patch),
    (list, { id, patch }) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    (list, saved, { id }) => list.map((a) => (a.id === id ? { ...a, ...saved } : a)),
  );
}

export function useDeleteAlarm(deviceId) {
  return useOptimistic(
    deviceId,
    ({ id }) => api.deleteAlarm(deviceId, id),
    (list, { id }) => list.filter((a) => a.id !== id),
  );
}
