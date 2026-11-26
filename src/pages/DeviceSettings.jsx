import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, SunDim, Trash2 } from 'lucide-react';
import { useRemoveDevice, useUpdateSettings } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { describeError } from '../api/client';
import { utcOffsetLabel } from '../lib/format';
import { ConfirmDialog, SidePanel } from '../components/Modal';
import { Button, SelectField, TextField } from '../components/ui';
import { useToast } from '../components/Toast';

const SNOOZE = [5, 10, 15];

function timeZones(current) {
  let zones = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Tashkent', 'America/New_York'];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export function DeviceSettings({ device, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const update = useUpdateSettings(device.id);
  const remove = useRemoveDevice(device.id);
  const { data: alarmData } = useAlarms(device.id);

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const initial = {
    name: device.name,
    tz: device.settings?.tz || device.state?.tz || browserTz,
    brightness: device.settings?.brightness ?? 70,
    snooze_min: device.settings?.snooze_min ?? 10,
  };
  const [form, setForm] = useState(initial);
  const [nameError, setNameError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const zones = useMemo(() => timeZones(form.tz), [form.tz]);
  const snoozeOptions = SNOOZE.includes(form.snooze_min) ? SNOOZE : [...SNOOZE, form.snooze_min].sort((a, b) => a - b);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'range' || k === 'snooze_min' ? Number(e.target.value) : e.target.value });

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      setNameError('Give your clock a name.');
      return;
    }
    // Send only what changed; the device must accept it.
    const patch = {};
    if (name !== initial.name) patch.name = name;
    for (const k of ['tz', 'brightness', 'snooze_min']) if (form[k] !== initial[k]) patch[k] = form[k];
    if (!Object.keys(patch).length) return onClose();

    update.mutate(patch, {
      onSuccess: () => {
        toast.success('Settings saved');
        onClose();
      },
      onError: (err) => {
        if (err.status === 422 && err.errors?.name) setNameError(err.errors.name[0]);
        toast.error(`Couldn't save settings — ${describeError(err)}`, { retry: save });
      },
    });
  };

  const doRemove = (force = false) =>
    remove.mutate(
      { force },
      {
        onSuccess: () => {
          toast.success(`${device.name} removed`);
          navigate('/', { replace: true });
        },
        onError: (err) => {
          if (err.code === 'device_unreachable') setUnreachable(true);
          else toast.error(`Couldn't remove device — ${describeError(err)}`);
        },
      },
    );

  const alarmCount = alarmData?.alarms?.length ?? 0;
  const busy = update.isPending;

  return (
    <SidePanel
      title="Device settings"
      onClose={busy ? undefined : onClose}
      cancelText="Cancel"
      footer={
        <>
          <Button variant="secondary" className="hide-m" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" style={{ minWidth: 96 }} loading={busy} onClick={save}>
            {busy ? 'Saving' : 'Save'}
          </Button>
        </>
      }
    >
      {!device.online && (
        <div className="banner banner-info">
          <span>The clock is offline. Settings can be saved once it&apos;s back online.</span>
        </div>
      )}
      <TextField
        label="Name"
        value={form.name}
        maxLength={64}
        onChange={(e) => {
          set('name')(e);
          setNameError(null);
        }}
        error={nameError}
      />
      <SelectField label="Time zone" value={form.tz} onChange={set('tz')}>
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll('_', ' ')} ({utcOffsetLabel(z)})
          </option>
        ))}
      </SelectField>
      <div className="field" style={{ gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label htmlFor="st-bright" className="label">
            Display brightness
          </label>
          <span className="num" style={{ fontSize: 14, fontWeight: 500 }}>
            {form.brightness}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SunDim size={18} color="var(--text-2)" aria-hidden="true" />
          <input
            id="st-bright"
            className="range"
            type="range"
            min="0"
            max="100"
            step="5"
            value={form.brightness}
            onChange={set('brightness')}
            aria-valuetext={`${form.brightness}%`}
          />
          <Sun size={20} color="var(--text-2)" aria-hidden="true" />
        </div>
      </div>
      <SelectField label="Default snooze" value={form.snooze_min} onChange={set('snooze_min')}>
        {snoozeOptions.map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </SelectField>

      <section className="danger-zone" aria-labelledby="st-danger">
        <h2 id="st-danger">Danger zone</h2>
        <p>Removing the clock deletes its alarms and history from this app. You&apos;ll need to pair it again to use it.</p>
        <Button variant="danger-outline" onClick={() => setConfirming(true)}>
          <Trash2 size={18} aria-hidden="true" />
          Remove device
        </Button>
      </section>

      {confirming && (
        <ConfirmDialog
          destructive
          title={unreachable ? "Clock didn't respond" : `Remove ${device.name}?`}
          icon={<Trash2 size={22} />}
          confirmLabel={unreachable ? 'Remove anyway' : 'Remove device'}
          loading={remove.isPending}
          onCancel={() => {
            setConfirming(false);
            setUnreachable(false);
          }}
          onConfirm={() => doRemove(unreachable)}
        >
          <p>
            {unreachable
              ? 'The app could not tell the clock to forget it. If you remove it anyway, the clock keeps its old pairing until you factory-reset it (hold the button for 10 seconds).'
              : `The clock will be removed from your account${alarmCount ? ` and its ${alarmCount} ${alarmCount === 1 ? 'alarm' : 'alarms'} deleted` : ''}. To use it again you'll need to pair it with a new code from the clock's screen.`}
          </p>
        </ConfirmDialog>
      )}
    </SidePanel>
  );
}
