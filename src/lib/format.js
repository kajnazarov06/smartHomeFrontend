// Formatting helpers shared by cards, detail and alarms.

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pad2 = (n) => String(n).padStart(2, '0');

function validTz(tz) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** "22:47" in the device's time zone. */
export function formatClock(now, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: validTz(tz),
  }).format(now);
}

/** "Thursday, 19 November" in the device's time zone. */
export function formatLongDate(now, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: validTz(tz),
  }).format(now);
}

export function deviceTz(device) {
  return device?.state?.tz || device?.settings?.tz || undefined;
}

/** ISO weekdays (1 = Mon) → "Mon–Fri", "Weekends", "Every day", "Once", "Mon, Wed". */
export function describeDays(days = []) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const key = set.join(',');
  if (set.length === 0) return 'Once';
  if (key === '1,2,3,4,5,6,7') return 'Every day';
  if (key === '1,2,3,4,5') return 'Mon–Fri';
  if (key === '6,7') return 'Weekends';
  // Consecutive run of 3+ days → "Tue–Sat"
  const consecutive = set.every((d, i) => i === 0 || d === set[i - 1] + 1);
  if (consecutive && set.length >= 3) return `${SHORT[set[0] - 1]}–${SHORT[set.at(-1) - 1]}`;
  return set.map((d) => SHORT[d - 1]).join(', ');
}

/** Wi-Fi RSSI (dBm) → 0–4 bars. */
export function rssiToBars(rssi) {
  if (rssi == null || Number.isNaN(Number(rssi))) return 0;
  const r = Number(rssi);
  if (r >= -55) return 4;
  if (r >= -65) return 3;
  if (r >= -75) return 2;
  if (r >= -85) return 1;
  return 0;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function formatNumber(v, digits = 0) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(digits);
}

/** mm:ss countdown. */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** next_alarm may be "06:30" or {time, days, label} depending on the firmware. */
export function describeNextAlarm(next) {
  if (!next) return null;
  if (typeof next === 'string') return { time: next.slice(0, 5), days: null };
  if (typeof next === 'object' && next.time) {
    return { time: String(next.time).slice(0, 5), days: Array.isArray(next.days) ? describeDays(next.days) : null };
  }
  return null;
}

export function utcOffsetLabel(tz, date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value;
    return (part || 'GMT').replace('GMT', 'UTC').replace('-', '−') || 'UTC';
  } catch {
    return '';
  }
}
