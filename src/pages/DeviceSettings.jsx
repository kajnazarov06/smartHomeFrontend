import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, SunDim, Trash2 } from 'lucide-react';
import { useRemoveDevice, useUpdateSettings } from '../hooks/useDevices';
import { useAlarms } from '../hooks/useAlarms';
import { describeError, fieldErrors } from '../api/client';
import { utcOffsetLabel } from '../lib/format';
import { DEVICE_NAME_MAX, deviceNameError } from '../lib/deviceName';
import { ConfirmDialog, SidePanel } from '../components/Modal';
import { DEFAULT_SNOOZE, SnoozeSelect } from '../components/alarms';
import { Banner, Button, SelectField, TextField } from '../components/ui';
import { useToast, useToastMutate } from '../components/Toast';

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
  const run = useToastMutate();
  const update = useUpdateSettings(device.id);
  const remove = useRemoveDevice(device.id);
  const { data: alarmData } = useAlarms(device.id);

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const initial = {
    name: device.name,
    tz: device.settings?.tz || device.state?.tz || browserTz,
    brightness: device.settings?.brightness ?? 70,
    snooze_min: device.settings?.snooze_min ?? DEFAULT_SNOOZE,
  };
  const [form, setForm] = useState(initial);
  const [nameError, setNameError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const zones = useMemo(() => timeZones(form.tz), [form.tz]);
  const set = (k, parse = (v) => v) => (e) => setForm({ ...form, [k]: parse(e.target.value) });

  const save = () => {
    const name = form.name.trim();
    const invalid = deviceNameError(name);
    if (invalid) {
      setNameError(invalid);
      return;
    }
    // Send only what changed; the device must accept it.
    const patch = {};
    if (name !== initial.name) patch.name = name;
    for (const k of ['tz', 'brightness', 'snooze_min']) if (form[k] !== initial[k]) patch[k] = form[k];
    if (!Object.keys(patch).length) return onClose();

    run(update, patch, {
      action: 'save settings',
      success: 'Settings saved',
      onSuccess: onClose,
      onError: (err) => {
        if (fieldErrors(err).name) setNameError(fieldErrors(err).name);
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
        <Banner tone="info">The clock is offline. Settings can be saved once it&apos;s back online.</Banner>
      )}
      <TextField
        label="Name"
        value={form.name}
        maxLength={DEVICE_NAME_MAX}
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
            onChange={set('brightness', Number)}
            aria-valuetext={`${form.brightness}%`}
          />
          <Sun size={20} color="var(--text-2)" aria-hidden="true" />
        </div>
      </div>
      <SnoozeSelect label="Default snooze" value={form.snooze_min} onChange={(v) => setForm({ ...form, snooze_min: v })} />

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
