import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCreateAlarm, useUpdateAlarm } from '../hooks/useAlarms';
import { describeDays, pad2 } from '../lib/format';
import { Modal } from '../components/Modal';
import { DEFAULT_SNOOZE, DayPicker, SnoozeSelect, TimePicker } from '../components/alarms';
import { Button, TextField } from '../components/ui';
import { useToastMutate } from '../components/Toast';

/** `onDelete(alarm)` is run by the parent, which stays mounted after the editor closes. */
export function AlarmEditor({ deviceId, alarm, defaultSnooze, onDelete, onClose }) {
  const editing = !!alarm;
  const [h0, m0] = (alarm?.time ?? '07:00').split(':').map(Number);
  const [hour, setHour] = useState(h0);
  const [minute, setMinute] = useState(m0);
  const [days, setDays] = useState(alarm?.days ?? [1, 2, 3, 4, 5]);
  const [label, setLabel] = useState(alarm?.label ?? '');
  const [snooze, setSnooze] = useState(Number(alarm?.snooze_min ?? defaultSnooze ?? DEFAULT_SNOOZE));

  const create = useCreateAlarm(deviceId);
  const update = useUpdateAlarm(deviceId);
  const run = useToastMutate();
  const saving = create.isPending || update.isPending;

  const time = `${pad2(hour)}:${pad2(minute)}`;
  const summary = `${time} · ${days.length === 0 ? 'Rings once' : describeDays(days)}`;

  const save = (e) => {
    e?.preventDefault();
    const body = { time, days, label: label.trim() || null, snooze_min: snooze };
    const opts = { action: 'save alarm', success: 'Alarm saved', onSuccess: onClose };
    if (editing) run(update, { id: alarm.id, patch: body }, opts);
    else run(create, { alarm: { ...body, enabled: true } }, opts);
  };

  const remove = () => {
    onClose();
    onDelete(alarm);
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
          <SnoozeSelect label="Snooze" value={snooze} onChange={setSnooze} />
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
