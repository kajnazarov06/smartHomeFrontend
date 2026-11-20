import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from './ui';

const RANGES = [
  { id: '24h', label: '24 h' },
  { id: '7d', label: '7 d' },
];

const fmtTick = (range) => (t) =>
  new Intl.DateTimeFormat('en-GB', range === '24h' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { weekday: 'short' }).format(t);

const fmtTip = (t) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);

function TipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <span className="muted">{fmtTip(p.t)}</span>
      <span className="num">
        <span className="c-temp" style={{ fontWeight: 500 }}>
          {p.temperature == null ? '—' : p.temperature.toFixed(1)} °C
        </span>
        {' · '}
        <span className="c-hum" style={{ fontWeight: 500 }}>
          {p.humidity == null ? '—' : Math.round(p.humidity)} %
        </span>
      </span>
    </div>
  );
}

function domainFor(points, key, pad, step) {
  const vals = points.map((p) => p[key]).filter((v) => v != null);
  if (!vals.length) return [0, 1];
  const lo = Math.floor((Math.min(...vals) - pad) / step) * step;
  const hi = Math.ceil((Math.max(...vals) + pad) / step) * step;
  return [lo, hi === lo ? lo + step : hi];
}

export function HistoryChart({ points, range, onRangeChange, loading, showTemp = true, showHum = true }) {
  const tempDomain = useMemo(() => domainFor(points ?? [], 'temperature', 0.5, 2), [points]);
  const humDomain = useMemo(() => domainFor(points ?? [], 'humidity', 2, 10), [points]);
  const empty = !loading && (!points || points.length < 2);

  const summary = useMemo(() => {
    if (!points?.length) return 'No history yet';
    const t = points.map((p) => p.temperature).filter((v) => v != null);
    const h = points.map((p) => p.humidity).filter((v) => v != null);
    const r = (a, d) => (a.length ? `${Math.min(...a).toFixed(d)} to ${Math.max(...a).toFixed(d)}` : 'no data');
    return `History for the last ${range === '24h' ? '24 hours' : '7 days'}: temperature ${r(t, 1)} °C, humidity ${r(h, 0)} %`;
  }, [points, range]);

  return (
    <section className="card chart-card" aria-label="History">
      <div className="chart-head">
        <div>
          <h2>History</h2>
          <div className="legend">
            {showTemp && (
              <span>
                <i style={{ background: 'var(--temp)' }} />
                Temperature °C
              </span>
            )}
            {showHum && (
              <span>
                <i style={{ background: 'var(--hum)' }} />
                Humidity %
              </span>
            )}
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={range === r.id}
              onClick={() => onRangeChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-box" role="img" aria-label={summary}>
        {loading && !points ? (
          <Skeleton height="100%" radius={12} />
        ) : empty ? (
          <div className="chart-empty">
            <div className="line" />
            <div className="line" />
            <div className="line" />
            <div className="line" />
            <div className="msg">Collecting data — check back in a few minutes</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtTick(range)}
                tick={{ fill: 'var(--text-2)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                yAxisId="t"
                hide={!showTemp}
                domain={tempDomain}
                tickFormatter={(v) => `${v}°`}
                tick={{ fill: 'var(--text-2)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickCount={4}
              />
              <YAxis
                yAxisId="h"
                orientation="right"
                hide={!showHum}
                domain={humDomain}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: 'var(--text-2)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickCount={4}
              />
              <Tooltip content={<TipContent />} cursor={{ stroke: 'var(--muted-fill)' }} isAnimationActive={false} />
              {showHum && (
                <Line
                  yAxisId="h"
                  type="monotone"
                  dataKey="humidity"
                  stroke="var(--hum)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              {showTemp && (
                <Line
                  yAxisId="t"
                  type="monotone"
                  dataKey="temperature"
                  stroke="var(--temp)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export function HistoryChartSkeleton() {
  return (
    <section className="card chart-card" aria-busy="true" aria-label="Loading history">
      <div className="chart-head">
        <Skeleton width={80} height={18} />
        <Skeleton width={104} height={36} radius={12} />
      </div>
      <Skeleton height={240} radius={12} />
    </section>
  );
}
