import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getEcho } from '../lib/echo';
import { connection } from '../lib/connection';
import { createTestQueryClient, queryWrapper } from '../test/utils';
import { makeDevice } from '../test/fixtures';
import { useRealtime } from './useRealtime';

vi.mock('../lib/echo');

function fakeEcho() {
  const handlers = {};
  const channel = {
    listen: vi.fn((event, fn) => {
      handlers[event] = fn;
      return channel;
    }),
  };
  const echo = { private: vi.fn(() => channel), leave: vi.fn() };
  getEcho.mockReturnValue(echo);
  return { echo, handlers };
}

function setup(options) {
  const qc = createTestQueryClient();
  qc.setQueryData(['devices'], [makeDevice()]);
  qc.setQueryData(['device', 'clk-1'], makeDevice());
  qc.setQueryData(['alarms', 'clk-1'], { data: [] });
  const fake = fakeEcho();
  const hook = renderHook(() => useRealtime(7, options), { wrapper: queryWrapper(qc) });
  return { qc, ...fake, ...hook };
}

describe('useRealtime', () => {
  it('subscribes to the user channel and leaves it on unmount', () => {
    const { echo, unmount } = setup();
    expect(echo.private).toHaveBeenCalledWith('users.7');
    unmount();
    expect(echo.leave).toHaveBeenCalledWith('users.7');
  });

  it('does nothing without a user', () => {
    const { echo } = fakeEcho();
    renderHook(() => useRealtime(null), { wrapper: queryWrapper(createTestQueryClient()) });
    expect(echo.private).not.toHaveBeenCalled();
  });

  it('reports the socket unavailable when Echo cannot start', () => {
    getEcho.mockReturnValue(null);
    renderHook(() => useRealtime(7), { wrapper: queryWrapper(createTestQueryClient()) });
    expect(connection.get().socket).toBe('unavailable');
  });

  it('.device.state merges state into list and detail and marks the device online', () => {
    const { qc, handlers } = setup();
    qc.setQueryData(['device', 'clk-1'], makeDevice({ online: false }));

    act(() => handlers['.device.state']({ device_id: 'clk-1', state: { temperature_c: 23, next_alarm: '06:00' } }));

    const detail = qc.getQueryData(['device', 'clk-1']);
    expect(detail.state.temperature_c).toBe(23);
    expect(detail.state.humidity_pct).toBe(44.6);
    expect(detail.next_alarm).toBe('06:00');
    expect(detail.online).toBe(true);
    expect(qc.getQueryData(['devices'])[0].state.temperature_c).toBe(23);
  });

  it('.device.status updates online and refreshes alarms when the clock is back', () => {
    const { qc, handlers } = setup();

    act(() => handlers['.device.status']({ device_id: 'clk-1', online: false, last_seen_at: '2026-01-01T00:00:00Z' }));
    expect(qc.getQueryData(['device', 'clk-1'])).toMatchObject({ online: false, last_seen_at: '2026-01-01T00:00:00Z' });
    expect(qc.getQueryState(['alarms', 'clk-1']).isInvalidated).toBe(false);

    act(() => handlers['.device.status']({ device_id: 'clk-1', online: true }));
    expect(qc.getQueryData(['devices'])[0].online).toBe(true);
    expect(qc.getQueryData(['devices'])[0].last_seen_at).toBe('2026-01-01T00:00:00Z');
    expect(qc.getQueryState(['alarms', 'clk-1']).isInvalidated).toBe(true);
  });

  it('.discovery.finished stores the scan result', () => {
    const { qc, handlers } = setup();
    act(() => handlers['.discovery.finished']({ devices: [{ id: 'a1', host: '10.0.0.2' }] }));
    const discovery = qc.getQueryData(['discovery']);
    expect(discovery.data).toEqual([{ id: 'a1', host: '10.0.0.2' }]);
    expect(discovery.finishedAt).toEqual(expect.any(Number));
  });

  it('.alarm.ringing calls the latest callback', () => {
    const onAlarmRinging = vi.fn();
    const { handlers } = setup({ onAlarmRinging });
    handlers['.alarm.ringing']({ device_id: 'clk-1' });
    expect(onAlarmRinging).toHaveBeenCalledWith({ device_id: 'clk-1' });
  });
});
