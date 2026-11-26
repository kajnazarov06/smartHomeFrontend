import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../api/endpoints';
import { createTestQueryClient, deferred, queryWrapper } from '../test/utils';
import { makeDevice, unreachableError } from '../test/fixtures';
import { patchDeviceCache, storeDevice, useDevice, useRemoveDevice, useRenameDevice, useUpdateSettings } from './useDevices';

vi.mock('../api/endpoints');

function seed(qc, devices) {
  qc.setQueryData(['devices'], devices);
  devices.forEach((d) => qc.setQueryData(['device', d.id], d));
}

describe('patchDeviceCache', () => {
  it('updates the device in both the list and its detail', () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice(), makeDevice({ id: 'clk-2', name: 'Kitchen' })]);

    patchDeviceCache(qc, 'clk-1', (d) => ({ ...d, online: false }));

    expect(qc.getQueryData(['device', 'clk-1']).online).toBe(false);
    expect(qc.getQueryData(['devices']).map((d) => d.online)).toEqual([false, true]);
  });

  it('leaves caches that are not loaded alone', () => {
    const qc = createTestQueryClient();
    patchDeviceCache(qc, 'clk-1', (d) => ({ ...d, online: false }));
    expect(qc.getQueryData(['devices'])).toBeUndefined();
    expect(qc.getQueryData(['device', 'clk-1'])).toBeUndefined();
  });
});

describe('storeDevice', () => {
  it('replaces an existing device in place', () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice(), makeDevice({ id: 'clk-2', name: 'Kitchen' })]);

    storeDevice(qc, makeDevice({ name: 'Renamed' }));

    expect(qc.getQueryData(['devices']).map((d) => d.name)).toEqual(['Renamed', 'Kitchen']);
    expect(qc.getQueryData(['device', 'clk-1']).name).toBe('Renamed');
  });

  it('adds a new device sorted by name', () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice({ name: 'Bedroom' }), makeDevice({ id: 'clk-2', name: 'Office' })]);

    storeDevice(qc, makeDevice({ id: 'clk-3', name: 'Kitchen' }));

    expect(qc.getQueryData(['devices']).map((d) => d.name)).toEqual(['Bedroom', 'Kitchen', 'Office']);
  });

  it('ignores an empty device', () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice()]);
    storeDevice(qc, null);
    expect(qc.getQueryData(['devices'])).toHaveLength(1);
  });
});

describe('useDevice', () => {
  it('starts from the list entry while the detail loads', () => {
    const qc = createTestQueryClient();
    qc.setQueryData(['devices'], [makeDevice()]);
    api.device.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDevice('clk-1'), { wrapper: queryWrapper(qc) });

    expect(result.current.data.name).toBe('Bedroom');
  });
});

describe('useRenameDevice', () => {
  it('renames optimistically, then stores the server copy', async () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice()]);
    const req = deferred();
    api.renameDevice.mockReturnValue(req.promise);

    const { result } = renderHook(() => useRenameDevice('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate('Office'));

    await waitFor(() => expect(qc.getQueryData(['devices'])[0].name).toBe('Office'));
    expect(api.renameDevice).toHaveBeenCalledWith('clk-1', 'Office');

    await act(async () => req.resolve(makeDevice({ name: 'Office', fw_version: '1.3.0' })));
    await waitFor(() => expect(qc.getQueryData(['device', 'clk-1']).fw_version).toBe('1.3.0'));
  });

  it('rolls back on error', async () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice()]);
    api.renameDevice.mockRejectedValue(unreachableError());

    const { result } = renderHook(() => useRenameDevice('clk-1'), { wrapper: queryWrapper(qc) });
    act(() => result.current.mutate('Office'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(['devices'])[0].name).toBe('Bedroom');
    expect(qc.getQueryData(['device', 'clk-1']).name).toBe('Bedroom');
  });
});

describe('useUpdateSettings', () => {
  it('stores the device the server returns', async () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice()]);
    api.updateSettings.mockResolvedValue(makeDevice({ settings: { tz: 'UTC', brightness: 30, snooze_min: 5 } }));

    const { result } = renderHook(() => useUpdateSettings('clk-1'), { wrapper: queryWrapper(qc) });
    await act(() => result.current.mutateAsync({ brightness: 30 }));

    expect(api.updateSettings).toHaveBeenCalledWith('clk-1', { brightness: 30 });
    expect(qc.getQueryData(['devices'])[0].settings.brightness).toBe(30);
  });
});

describe('useRemoveDevice', () => {
  it('drops the device and everything cached for it', async () => {
    const qc = createTestQueryClient();
    seed(qc, [makeDevice(), makeDevice({ id: 'clk-2', name: 'Kitchen' })]);
    qc.setQueryData(['alarms', 'clk-1'], { data: [] });
    qc.setQueryData(['readings', 'clk-1', '24h'], { points: [] });
    api.removeDevice.mockResolvedValue({});

    const { result } = renderHook(() => useRemoveDevice('clk-1'), { wrapper: queryWrapper(qc) });
    await act(() => result.current.mutateAsync({ force: true }));

    expect(api.removeDevice).toHaveBeenCalledWith('clk-1', { force: true });
    expect(qc.getQueryData(['devices']).map((d) => d.id)).toEqual(['clk-2']);
    expect(qc.getQueryData(['device', 'clk-1'])).toBeUndefined();
    expect(qc.getQueryData(['alarms', 'clk-1'])).toBeUndefined();
    expect(qc.getQueryData(['readings', 'clk-1', '24h'])).toBeUndefined();
  });
});
