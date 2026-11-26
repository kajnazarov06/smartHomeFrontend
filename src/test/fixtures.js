import { ApiError } from '../api/client';

export function makeDevice(overrides = {}) {
  return {
    id: 'clk-1',
    name: 'Bedroom',
    type: 'clock',
    type_label: 'Bedroom clock',
    capabilities: ['clock', 'alarm', 'temperature', 'humidity'],
    online: true,
    last_seen_at: new Date().toISOString(),
    last_ip: '192.168.1.57',
    fw_version: '1.2.0',
    next_alarm: '07:00',
    state: { tz: 'Europe/Berlin', temperature_c: 21.46, humidity_pct: 44.6, wifi_rssi: -60 },
    settings: { tz: 'Europe/Berlin', brightness: 70, snooze_min: 10 },
    ...overrides,
  };
}

export function makeAlarm(overrides = {}) {
  return { id: 1, time: '07:00', days: [1, 2, 3, 4, 5], label: null, enabled: true, snooze_min: 10, ...overrides };
}

/** Shape of GET /api/devices/{id}/alarms. */
export const alarmsResponse = (alarms, meta = {}) => ({ data: alarms, meta });

export const unreachableError = () =>
  new ApiError({ message: 'Device unreachable', status: 503, code: 'device_unreachable' });

export const validationError = (errors, data = {}) =>
  new ApiError({ message: 'The given data was invalid.', status: 422, errors, data: { errors, ...data } });
