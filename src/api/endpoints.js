import { http, csrfCookie } from './client';

const data = (res) => res.data;
const unwrap = (res) => res.data?.data;

export const api = {
  // Auth
  authStatus: () => http.get('/api/auth/status').then(data),
  me: () => http.get('/api/user', { skipAuthRedirect: true }).then(unwrap),
  login: async (body) => {
    await csrfCookie();
    return http.post('/api/auth/login', body, { skipAuthRedirect: true }).then(unwrap);
  },
  register: async (body) => {
    await csrfCookie();
    return http.post('/api/auth/register', body, { skipAuthRedirect: true }).then(unwrap);
  },
  logout: () => http.post('/api/auth/logout'),

  // Devices
  devices: () => http.get('/api/devices').then(unwrap),
  device: (id) => http.get(`/api/devices/${encodeURIComponent(id)}`).then(unwrap),
  renameDevice: (id, name) => http.patch(`/api/devices/${encodeURIComponent(id)}`, { name }).then(unwrap),
  updateSettings: (id, settings) =>
    http.put(`/api/devices/${encodeURIComponent(id)}/settings`, settings).then(unwrap),
  removeDevice: (id, { force = false } = {}) =>
    http.delete(`/api/devices/${encodeURIComponent(id)}`, { params: force ? { force: 1 } : undefined }),
  readings: (id, range) =>
    http.get(`/api/devices/${encodeURIComponent(id)}/readings`, { params: { range } }).then(unwrap),

  // Alarms
  alarms: (id) => http.get(`/api/devices/${encodeURIComponent(id)}/alarms`).then(data),
  createAlarm: (id, alarm) => http.post(`/api/devices/${encodeURIComponent(id)}/alarms`, alarm).then(unwrap),
  updateAlarm: (id, alarmId, patch) =>
    http.put(`/api/devices/${encodeURIComponent(id)}/alarms/${alarmId}`, patch).then(unwrap),
  deleteAlarm: (id, alarmId) => http.delete(`/api/devices/${encodeURIComponent(id)}/alarms/${alarmId}`),

  // Discovery & pairing
  discovery: () => http.get('/api/discovery').then(data),
  scan: () => http.post('/api/discovery/scan', {}),
  probe: (host) => http.post('/api/discovery/probe', { host }).then(unwrap),
  pairStart: (host) => http.post('/api/pairing/start', { host }).then(data),
  pairConfirm: (host, code) => http.post('/api/pairing/confirm', { host, code }).then(unwrap),
};
