import { Link } from 'react-router-dom';
import { AlarmClock, Droplet, Thermometer } from 'lucide-react';
import { useNow } from '../lib/useNow';
import {
  describeDays,
  describeNextAlarm,
  deviceTz,
  formatClock,
  formatLongDate,
  formatNumber,
  rssiToBars,
  timeAgo,
} from '../lib/format';
import { FadeValue, Skeleton, StatusBadge, WifiIndicator } from './ui';

/** size: card (40 px) | hero (96 px, 64 px on phones). Tabular figures so digits don't jump. */
export function ClockDisplay({ tz, size = 'card', showDate = false }) {
  const now = useNow();
  return (
    <div>
      <div className={`clock clock-${size}`}>{formatClock(now, tz)}</div>
      {showDate && <div className="clock-date">{formatLongDate(now, tz)}</div>}
    </div>
  );
}

const SENSORS = {
  temperature: { icon: Thermometer, label: 'Temperature', unit: '°C', cls: 'c-temp', digits: 1, key: 'temperature_c' },
  humidity: { icon: Droplet, label: 'Humidity', unit: '%', cls: 'c-hum', digits: 0, key: 'humidity_pct' },
};

/** kind: temperature | humidity; size: sm (card) | lg (detail). */
export function SensorTile({ kind, value, size = 'sm' }) {
  const s = SENSORS[kind];
  const Icon = s.icon;
  const shown = formatNumber(value, s.digits);
  if (size === 'lg') {
    return (
      <div className="sensor-lg">
        <div className="lbl">
          <Icon size={18} strokeWidth={1.75} className={s.cls} aria-hidden="true" />
          {s.label}
        </div>
        <div>
          <FadeValue value={shown} className={`v num ${s.cls}`} />
          <span className="u">{s.unit}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="sensor-sm" aria-label={`${s.label} ${shown} ${s.unit}`}>
      <Icon size={18} strokeWidth={1.75} className={s.cls} aria-hidden="true" />
      <FadeValue value={shown} className={`v num ${s.cls}`} />
      <span className="u">{s.unit}</span>
    </div>
  );
}

export function sensorsOf(device) {
  const caps = device?.capabilities ?? [];
  // Older records may have no capability list; fall back to what the state carries.
  return Object.keys(SENSORS).filter(
    (k) => caps.includes(k) || (caps.length === 0 && device?.state?.[SENSORS[k].key] != null),
  );
}

export function hasCap(device, cap) {
  const caps = device?.capabilities ?? [];
  return caps.length === 0 ? cap === 'clock' || cap === 'alarm' : caps.includes(cap);
}

export function DeviceCard({ device, highlighted = false }) {
  const now = useNow();
  const online = !!device.online;
  const state = device.state ?? {};
  const bars = rssiToBars(state.wifi_rssi);
  const next = describeNextAlarm(device.next_alarm);
  const sensors = sensorsOf(device);
  const tz = deviceTz(device);

  const summary = [
    device.name,
    online ? 'online' : `offline, last seen ${timeAgo(device.last_seen_at, now)}`,
    hasCap(device, 'clock') ? formatClock(now, tz) : null,
    state.temperature_c != null ? `${formatNumber(state.temperature_c, 1)} degrees` : null,
    state.humidity_pct != null ? `${formatNumber(state.humidity_pct)} percent humidity` : null,
    next ? `next alarm ${next.time}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Link to={`/devices/${encodeURIComponent(device.id)}`} className={`dcard ${highlighted ? 'highlight' : ''}`} aria-label={summary}>
      <div className="dcard-head">
        <div className="dcard-name">
          {online && <span className="dot dot-online" aria-hidden="true" />}
          <span className="name">{device.name}</span>
          {!online && <StatusBadge status="offline" />}
          {highlighted && <span className="badge badge-new">New</span>}
        </div>
        <WifiIndicator bars={bars} offline={!online} />
      </div>

      <div className={`dcard-body ${online ? '' : 'dimmed'}`}>
        {hasCap(device, 'clock') && <ClockDisplay tz={tz} size="card" />}
        {sensors.length > 0 && (
          <div className="sensors">
            {sensors.map((k) => (
              <SensorTile key={k} kind={k} value={state[SENSORS[k].key]} />
            ))}
          </div>
        )}
      </div>

      <div className="dcard-foot">
        {!online ? (
          <>Last seen {timeAgo(device.last_seen_at, now)}</>
        ) : hasCap(device, 'alarm') ? (
          <>
            <AlarmClock size={16} strokeWidth={1.75} aria-hidden="true" />
            {next ? (
              <span>
                Alarm <span className="num">{next.time}</span>
                {next.days ? ` · ${next.days}` : ''}
              </span>
            ) : (
              'No alarms set'
            )}
          </>
        ) : (
          device.type_label
        )}
      </div>
    </Link>
  );
}

export function DeviceCardSkeleton() {
  return (
    <div className="dcard" aria-busy="true" aria-label="Loading device">
      <div className="dcard-head">
        <Skeleton width={140} height={18} />
        <Skeleton width={18} height={16} />
      </div>
      <Skeleton width={120} height={40} />
      <div className="sensors">
        <Skeleton height={50} radius={12} />
        <Skeleton height={50} radius={12} />
      </div>
      <Skeleton width={170} height={14} style={{ marginTop: 17 }} />
    </div>
  );
}

export { describeDays };
