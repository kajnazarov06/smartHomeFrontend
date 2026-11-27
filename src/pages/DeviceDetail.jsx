import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlarmClock, ArrowLeft, Check, CloudOff, Pencil, Plus, Settings, X } from 'lucide-react';
import { useDevice, useRenameDevice } from '../hooks/useDevices';
import { MAX_ALARMS, useAlarms, useDeleteAlarm, useUpdateAlarm } from '../hooks/useAlarms';
import { useReadings } from '../hooks/useReadings';
import { useNow } from '../lib/useNow';
import { deviceTz, timeAgo } from '../lib/format';
import { DEVICE_NAME_MAX } from '../lib/deviceName';
import { describeError } from '../api/client';
import { ClockDisplay, SensorTile, hasCap, sensorValue, sensorsOf } from '../components/device';
import { HistoryChart, HistoryChartSkeleton } from '../components/HistoryChart';
import { AlarmRow } from '../components/alarms';
import { Button, IconButton, Skeleton, StatusBadge } from '../components/ui';
import { useToastMutate } from '../components/Toast';
import { AlarmEditor } from './AlarmEditor';
import { DeviceSettings } from './DeviceSettings';

export function DeviceDetail() {
  const { id } = useParams();
  const { data: device, isPending, isError, error } = useDevice(id);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isPending) return <DetailSkeleton />;
  if (isError && !device) {
    return (
      <main className="container detail">
        <div className="card empty">
          <div>
            <div className="empty-title">{error?.status === 404 ? 'Device not found' : "Couldn't load this device"}</div>
            <div className="empty-text">{error?.status === 404 ? 'It may have been removed.' : describeError(error)}</div>
          </div>
          <Link to="/" className="btn btn-secondary">
            Back to My devices
          </Link>
        </div>
      </main>
    );
  }

  const online = !!device.online;
  const sensors = sensorsOf(device);
  const tz = deviceTz(device);

  return (
    <main className="container detail">
      <DetailHeader device={device} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="split">
        <section className="card hero" aria-label="Current readings">
          <div className={online ? '' : 'dimmed'}>
            {hasCap(device, 'clock') ? <ClockDisplay tz={tz} size="hero" showDate /> : <div className="clock clock-hero">—</div>}
          </div>
          {!online && <OfflineNote device={device} />}
          {sensors.length > 0 && (
            <div className={`sensors ${online ? '' : 'dimmed'}`}>
              {sensors.map((k) => (
                <SensorTile key={k} kind={k} size="lg" value={sensorValue(device, k)} />
              ))}
            </div>
          )}
        </section>

        {sensors.length > 0 && <History deviceId={device.id} sensors={sensors} />}
      </div>

      {hasCap(device, 'alarm') && <AlarmsCard device={device} />}

      <footer className="detail-foot">
        {device.type_label && (
          <span>
            Type <span className="v">{device.type_label}</span>
          </span>
        )}
        <span>
          Firmware <span className="v num">{device.fw_version || '—'}</span>
        </span>
        <span>
          IP address <span className="v num">{device.last_ip || '—'}</span>
        </span>
        <LastSeen at={device.last_seen_at} online={online} />
      </footer>

      {settingsOpen && <DeviceSettings device={device} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

function LastSeen({ at, online }) {
  const now = useNow();
  return (
    <span>
      Last seen <span className="v">{online ? 'just now' : timeAgo(at, now)}</span>
    </span>
  );
}

function OfflineNote({ device }) {
  const now = useNow();
  return (
    <div className="offline-note">
      <CloudOff size={16} aria-hidden="true" />
      Last seen {timeAgo(device.last_seen_at, now)} — showing the last known values.
    </div>
  );
}

function DetailHeader({ device, onOpenSettings }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name);
  const rename = useRenameDevice(device.id);
  const run = useToastMutate();

  const save = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === device.name) return;
    run(rename, trimmed, { action: 'rename', success: 'Name saved' });
  };

  return (
    <div className="detail-head">
      <Link to="/" className="icon-btn" aria-label="Back to My devices">
        <ArrowLeft size={20} />
      </Link>
      {editing ? (
        <form className="rename-form" onSubmit={save}>
          <label htmlFor="rename" className="sr-only">
            Device name
          </label>
          <input
            id="rename"
            className="input"
            value={name}
            maxLength={DEVICE_NAME_MAX}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setName(device.name);
                setEditing(false);
              }
            }}
          />
          <IconButton label="Save name" type="submit">
            <Check size={20} />
          </IconButton>
          <IconButton
            label="Cancel rename"
            subtle
            onClick={() => {
              setName(device.name);
              setEditing(false);
            }}
          >
            <X size={20} />
          </IconButton>
        </form>
      ) : (
        <>
          <h1>{device.name}</h1>
          <IconButton
            label="Rename device"
            subtle
            className="hide-m"
            style={{ width: 36, height: 36 }}
            onClick={() => {
              setName(device.name);
              setEditing(true);
            }}
          >
            <Pencil size={18} />
          </IconButton>
        </>
      )}
      <StatusBadge status={device.online ? 'online' : 'offline'} />
      <span className="head-spacer" />
      <IconButton label="Device settings" onClick={onOpenSettings}>
        <Settings size={20} />
      </IconButton>
    </div>
  );
}

function History({ deviceId, sensors }) {
  const [range, setRange] = useState('24h');
  const { data, isPending } = useReadings(deviceId, range);
  if (isPending && !data) return <HistoryChartSkeleton />;
  return (
    <HistoryChart
      points={data}
      range={range}
      onRangeChange={setRange}
      showTemp={sensors.includes('temperature')}
      showHum={sensors.includes('humidity')}
    />
  );
}

function AlarmsCard({ device }) {
  const { data, isPending, isError, error, refetch } = useAlarms(device.id);
  const update = useUpdateAlarm(device.id);
  const del = useDeleteAlarm(device.id);
  const run = useToastMutate();
  const [editor, setEditor] = useState(null); // null | { alarm? }

  // Alarms are offline-first: changes are saved on the server and pushed when the clock is reachable.
  const stale = data?.stale;

  const toggle = (alarm, enabled) =>
    run(update, { id: alarm.id, patch: { enabled } }, { action: `${enabled ? 'turn on' : 'turn off'} alarm` });

  // Lives here, not in the editor: the editor closes before the request settles.
  const remove = (alarm) => run(del, { id: alarm.id }, { action: 'delete alarm', success: 'Alarm deleted' });

  const alarms = data?.alarms ?? [];
  const full = alarms.length >= MAX_ALARMS;

  return (
    <section className="card alarms-card" aria-label="Alarms">
      <div className="alarms-head">
        <h2>Alarms</h2>
        {alarms.length > 0 && (
          <span className="tip-wrap" tabIndex={full ? 0 : undefined}>
            <Button variant="secondary" onClick={() => setEditor({})} disabled={full}>
              <Plus size={18} aria-hidden="true" />
              Add<span className="hide-m">&nbsp;alarm</span>
            </Button>
            {full && (
              <span className="tooltip" role="tooltip">
                A clock can store at most {MAX_ALARMS} alarms
              </span>
            )}
          </span>
        )}
      </div>

      {stale && device.online && (
        <div className="stale-note">
          <CloudOff size={16} aria-hidden="true" />
          The clock didn&apos;t respond — changes will be sent when it&apos;s back.
          <button type="button" className="linkbtn" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {isPending ? (
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy="true">
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      ) : isError && !data ? (
        <div className="empty" style={{ padding: '24px' }}>
          <div className="empty-text">Couldn&apos;t load alarms — {describeError(error)}</div>
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : alarms.length === 0 ? (
        <div className="empty" style={{ padding: '16px 24px 32px', gap: 12 }}>
          <span className="empty-icon">
            <AlarmClock size={22} aria-hidden="true" />
          </span>
          <div style={{ fontSize: 15 }}>No alarms yet</div>
          <Button variant="secondary" onClick={() => setEditor({})}>
            <Plus size={18} aria-hidden="true" />
            Add alarm
          </Button>
        </div>
      ) : (
        <div>
          {alarms.map((a) => (
            <AlarmRow
              key={a.id}
              alarm={a}
              onEdit={(alarm) => setEditor({ alarm })}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
          <p className="swipe-hint">Swipe an alarm left to delete it.</p>
        </div>
      )}

      {editor && (
        <AlarmEditor
          deviceId={device.id}
          alarm={editor.alarm}
          defaultSnooze={device.settings?.snooze_min}
          onDelete={remove}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <main className="container detail" aria-busy="true" aria-label="Loading device">
      <div className="detail-head">
        <Skeleton width={44} height={44} radius={12} />
        <Skeleton width={200} height={28} />
      </div>
      <div className="split">
        <section className="card hero">
          <div>
            <Skeleton width="70%" height={88} />
            <Skeleton width={180} height={18} style={{ marginTop: 16 }} />
          </div>
          <div className="sensors">
            <Skeleton height={104} radius={16} />
            <Skeleton height={104} radius={16} />
          </div>
        </section>
        <HistoryChartSkeleton />
      </div>
      <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width={80} height={18} />
        <Skeleton height={56} radius={12} />
        <Skeleton height={56} radius={12} />
      </section>
    </main>
  );
}
