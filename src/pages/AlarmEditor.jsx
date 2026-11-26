import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCreateAlarm, useDeleteAlarm, useUpdateAlarm } from '../hooks/useAlarms';
import { describeError } from '../api/client';
import { describeDays, pad2 } from '../lib/format';
import { Modal } from '../components/Modal';
import { DayPicker, TimePicker } from '../components/alarms';
import { Button, SelectField, TextField } from '../components/ui';
import { useToast } from '../components/Toast';

const SNOOZE = [5, 10, 15];

export function AlarmEditor({ deviceId, alarm, defaultSnooze, onClose }) {
  const editing = !!alarm;
  const [h0, m0] = (alarm?.time ?? '07:00').split(':').map(Number);
  const [hour, setHour] = useState(h0);
  const [minute, setMinute] = useState(m0);
  const [days, setDays] = useState(alarm?.days ?? [1, 2, 3, 4, 5]);
  const [label, setLabel] = useState(alarm?.label ?? '');
  const [snooze, setSnooze] = useState(alarm?.snooze_min ?? defaultSnooze ?? 10);

  const create = useCreateAlarm(deviceId);
  const update = useUpdateAlarm(deviceId);
  const del = useDeleteAlarm(deviceId);
  const toast = useToast();
  const saving = create.isPending || update.isPending;

  const time = `${pad2(hour)}:${pad2(minute)}`;
  const summary = `${time} · ${days.length === 0 ? 'Rings once' : describeDays(days)}`;
  const snoozeOptions = SNOOZE.includes(Number(snooze)) ? SNOOZE : [...SNOOZE, Number(snooze)].sort((a, b) => a - b);

  const save = (e) => {
    e?.preventDefault();
    const body = { time, days, label: label.trim() || null, snooze_min: Number(snooze) };
    const opts = {
      onSuccess: () => {
        toast.success('Alarm saved');
        onClose();
      },
      onError: (err) => toast.error(`Couldn't save alarm — ${describeError(err)}`, { retry: () => save() }),
    };
    if (editing) update.mutate({ id: alarm.id, patch: body }, opts);
    else create.mutate({ alarm: { ...body, enabled: true } }, opts);
  };

  const remove = () => {
    onClose();
    const run = () =>
      del.mutate(
        { id: alarm.id },
        {
          onSuccess: () => toast.success('Alarm deleted'),
          onError: (err) => toast.error(`Couldn't delete alarm — ${describeError(err)}`, { retry: run }),
        },
      );
    run();
  };

  return (
    <Modal
      title={editing ? 'Edit alarm' : 'New alarm'}
      onClose={saving ? undefined : onClose}
      cancelText="Cancel"
      footer={
        <>
          {editing && (
            <Button variant="danger-text" onClick={remove} disabled={saving}>
              <Trash2 size={18} aria-hidden="true" />
              Delete alarm
            </Button>
          )}
          <span className="spacer" />
          <Button variant="secondary" className="hide-m" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" style={{ minWidth: 96 }} loading={saving} onClick={save}>
            {saving ? 'Saving' : 'Save'}
          </Button>
        </>
      }
    >
      <form className="modal-body" onSubmit={save} style={{ gap: 24 }}>
        <div>
          <TimePicker
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
          <p className="muted num" style={{ marginTop: 12, textAlign: 'center', fontSize: 13 }} aria-live="polite">
            {summary}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span id="ae-repeat" className="label">
            Repeat
          </span>
          <DayPicker value={days} onChange={setDays} labelledBy="ae-repeat" />
        </div>

        <div className="label-row">
          <TextField label="Label" value={label} maxLength={32} placeholder="Alarm" onChange={(e) => setLabel(e.target.value)} />
          <SelectField label="Snooze" value={snooze} onChange={(e) => setSnooze(Number(e.target.value))}>
            {snoozeOptions.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </SelectField>
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
