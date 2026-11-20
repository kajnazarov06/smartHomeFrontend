import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { http } from '../api/client';
import { connection } from './connection';

// Reverb is reached through the same origin (/app/* is proxied by nginx or Vite),
// so the socket works on whatever host/port the app itself is served from.
const key = window.__ENV__?.REVERB_APP_KEY || import.meta.env.VITE_REVERB_APP_KEY;

let echo = null;

export function getEcho() {
  if (echo || !key) return echo;
  window.Pusher = Pusher;
  const secure = window.location.protocol === 'https:';
  const port = Number(window.location.port) || (secure ? 443 : 80);

  echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: secure,
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        http
          .post('/api/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((res) => callback(null, res.data))
          .catch((err) => callback(err, null));
      },
    }),
  });

  echo.connector.pusher.connection.bind('state_change', ({ current }) => {
    connection.reportSocket(current);
  });

  return echo;
}

export function disconnectEcho() {
  if (!echo) return;
  echo.disconnect();
  echo = null;
  connection.reportSocket('disconnected');
}
