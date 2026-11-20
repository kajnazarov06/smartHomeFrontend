import { useSyncExternalStore } from 'react';

// One shared ticking clock for every ClockDisplay (aligned to whole seconds).
let now = Date.now();
const listeners = new Set();
let timer = null;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
  timer = setTimeout(tick, 1000 - (now % 1000));
}

function subscribe(fn) {
  listeners.add(fn);
  if (!timer) tick();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now);
}
