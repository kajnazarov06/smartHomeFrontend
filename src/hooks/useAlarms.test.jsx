import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../api/endpoints';
import { createTestQueryClient, deferred, queryWrapper } from '../test/utils';
import { alarmsResponse, makeAlarm, makeDevice, unreachableError } from '../test/fixtures';
import { useAlarms, useCreateAlarm, useDeleteAlarm, useUpdateAlarm } from './useAlarms';

vi.mock('../api/endpoints');

const KEY = ['alarms', 'clk-1'];
const cached = (qc) => qc.getQueryData(KEY).data;

function setup(alarms = [makeAlarm()]) {
  const qc = createTestQueryClient();
  qc.setQueryData(KEY, alarmsResponse(alarms));
  qc.setQueryData(['devices'], [makeDevice()]);
  qc.setQueryData(['device', 'clk-1'], makeDevice());
  return qc;
}

describe('useAlarms', () => {
  it('sorts by time and exposes the stale flag', async () => {
    api.alarms.mockResolvedValue(
      alarmsResponse([makeAlarm({ id: 2, time: '08:00' }), makeAlarm({ id: 1, time: '06:30' })], { stale: true }),
    );
    const qc = createTestQueryClient();

    const { result } = renderHook(() => useAlarms('clk-1'), { wrapper: queryWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.alarms.map((a) => a.time)).toEqual(['06:30', '08:00']);
    expect(result.current.data.stale).toBe(true);
    expect(api.alarms).toHaveBeenCalledWith('clk-1');
  });

  it('does not fetch without a device id', () => {
    renderHook(() => useAlarms(undefined), { wrapper: queryWrapper(createTestQueryClient()) });
    expect(api.alarms).not.toHaveBeenCalled();
  });
});

describe('useCreateAlarm', () => {
  it('adds a pending placeholder, then swaps in the saved alarm', async () => {
    const qc = setup();
    const req = deferred();
    api.createAlarm.mockReturnValue(req.promise);

    const { result } = renderHook(() => useCreateAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate({ alarm: { time: '09:00', days: [] } }));

    await waitFor(() => expect(cached(qc)).toHaveLength(2));
    const temp = cached(qc)[1];
    expect(temp).toMatchObject({ time: '09:00', enabled: true, pending: true });
    expect(temp.id).toBeLessThan(0);
    expect(api.createAlarm).toHaveBeenCalledWith('clk-1', { time: '09:00', days: [] });

    await act(async () => req.resolve(makeAlarm({ id: 5, time: '09:00', days: [] })));
    await waitFor(() => expect(cached(qc).map((a) => a.id)).toEqual([1, 5]));
    expect(cached(qc).some((a) => a.pending)).toBe(false);
  });

  it('invalidates the device so next_alarm refreshes', async () => {
    const qc = setup();
    api.createAlarm.mockResolvedValue(makeAlarm({ id: 5 }));

    const { result } = renderHook(() => useCreateAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    await act(() => result.current.mutateAsync({ alarm: { time: '09:00', days: [] } }));

    expect(qc.getQueryState(['devices']).isInvalidated).toBe(true);
    expect(qc.getQueryState(['device', 'clk-1']).isInvalidated).toBe(true);
  });

  it('removes the placeholder on error', async () => {
    const qc = setup();
    api.createAlarm.mockRejectedValue(unreachableError());

    const { result } = renderHook(() => useCreateAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate({ alarm: { time: '09:00', days: [] } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(qc).map((a) => a.id)).toEqual([1]);
  });
});

describe('useUpdateAlarm', () => {
  it('applies the patch optimistically and merges the saved alarm', async () => {
    const qc = setup();
    const req = deferred();
    api.updateAlarm.mockReturnValue(req.promise);

    const { result } = renderHook(() => useUpdateAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate({ id: 1, patch: { enabled: false } }));

    await waitFor(() => expect(cached(qc)[0].enabled).toBe(false));
    expect(api.updateAlarm).toHaveBeenCalledWith('clk-1', 1, { enabled: false });

    await act(async () => req.resolve(makeAlarm({ enabled: false, sync_status: 'pending' })));
    await waitFor(() => expect(cached(qc)[0].sync_status).toBe('pending'));
  });

  it('rolls back on error', async () => {
    const qc = setup();
    api.updateAlarm.mockRejectedValue(unreachableError());

    const { result } = renderHook(() => useUpdateAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate({ id: 1, patch: { enabled: false } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cached(qc)[0].enabled).toBe(true);
  });
});

describe('useDeleteAlarm', () => {
  it('removes optimistically and restores on error', async () => {
    const qc = setup([makeAlarm(), makeAlarm({ id: 2, time: '08:00' })]);
    const req = deferred();
    api.deleteAlarm.mockReturnValue(req.promise);

    const { result } = renderHook(() => useDeleteAlarm('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate({ id: 1 }));

    await waitFor(() => expect(cached(qc).map((a) => a.id)).toEqual([2]));
    expect(api.deleteAlarm).toHaveBeenCalledWith('clk-1', 1);

    await act(async () => req.reject(unreachableError()));
    await waitFor(() => expect(cached(qc).map((a) => a.id)).toEqual([1, 2]));
  });
});
