/** Every TanStack Query key in one place, so list/detail/alarms caches can't drift apart. */
export const qk = {
  user: ['user'],
  authStatus: ['auth-status'],
  devices: ['devices'],
  device: (id) => ['device', id],
  alarms: (deviceId) => ['alarms', deviceId],
  /** Without `range` this is the prefix for every range of a device. */
  readings: (deviceId, range) => (range ? ['readings', deviceId, range] : ['readings', deviceId]),
  discovery: ['discovery'],
};
