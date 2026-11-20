import { useSyncExternalStore } from 'react';

// Tiny store for "is the local server / live socket reachable".
// The HTTP client reports every response; Echo reports socket state.
let state = { server: true, socket: 'connecting' };
const listeners = new Set();
let probeTimer = null;

function set(patch) {
  const next = { ...state, ...patch };
  if (next.server === state.server && next.socket === state.socket) return;
  state = next;
  listeners.forEach((l) => l());
  if (!state.server) startProbe();
}

// While the server is down, ping /up until it answers.
function startProbe() {
  if (probeTimer) return;
  probeTimer = setInterval(async () => {
    try {
      const res = await fetch('/up', { cache: 'no-store', credentials: 'same-origin' });
      if (res.ok) {
        clearInterval(probeTimer);
        probeTimer = null;
        set({ server: true });
      }
    } catch {
      /* still down */
    }
  }, 4000);
}

export const connection = {
  reportServer: (ok) => set({ server: ok }),
  reportSocket: (socket) => set({ socket }),
  get: () => state,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useConnection() {
  return useSyncExternalStore(connection.subscribe, connection.get);
}
