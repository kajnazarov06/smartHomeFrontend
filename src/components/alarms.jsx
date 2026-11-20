import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { DAY_LETTERS, DAY_NAMES, describeDays, pad2 } from '../lib/format';
import { Toggle } from './ui';

/** Row: time, label, day letters, toggle, menu. `disabledReason` disables editing with a tooltip. */
export function AlarmRow({ alarm, onEdit, onToggle, onDelete, disabledReason }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const days = new Set(alarm.days ?? []);
  const locked = !!disabledReason;
  const label = alarm.label || (days.size ? describeDays(alarm.days) : 'Once');

  return (
    <div className={`arow ${alarm.enabled ? '' : 'off'} ${alarm.pending ? 'pending' : ''}`}>
      <button
        type="button"
        className="alink"
        onClick={() => onEdit(alarm)}
        disabled={locked}
        aria-label={`Edit alarm ${alarm.time}, ${label}, ${describeDays(alarm.days)}`}
      >
        <span className="t num">{alarm.time}</span>
        <span className="meta">
          <span className="lbl">{label}</span>
          <span className="daylets" aria-hidden="true">
            {DAY_LETTERS.map((l, i) => (
              <span key={i} className={days.has(i + 1) ? 'on' : ''}>
                {l}
              </span>
            ))}
          </span>
        </span>
      </button>

      <span className="tip-wrap" tabIndex={locked ? 0 : undefined}>
        <Toggle
          checked={alarm.enabled}
          onChange={(v) => onToggle(alarm, v)}
          disabled={locked || alarm.pending}
          label={`Alarm ${alarm.time} ${alarm.enabled ? 'on' : 'off'}`}
        />
        {locked && (
          <span className="tooltip" role="tooltip">
            {disabledReason}
          </span>
        )}
      </span>

      <RowMenu
        open={menuOpen}
        setOpen={setMenuOpen}
        label={`More options for alarm ${alarm.time}`}
        disabled={locked || alarm.pending}
        items={[
          { label: 'Edit', icon: Pencil, onSelect: () => onEdit(alarm) },
          { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(alarm) },
        ]}
      />
    </div>
  );
}

function RowMenu({ open, setOpen, label, items, disabled }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="row-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn subtle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="menu" role="menu" style={{ minWidth: 160 }}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={`menuitem ${it.danger ? 'danger' : ''}`}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              <it.icon size={16} aria-hidden="true" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PRESETS = [
  { name: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { name: 'Weekends', days: [6, 7] },
  { name: 'Every day', days: [1, 2, 3, 4, 5, 6, 7] },
  { name: 'Once', days: [] },
];
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Seven round chips (ISO weekdays) plus a presets row. */
export function DayPicker({ value, onChange, labelledBy }) {
  const days = [...value].sort((a, b) => a - b);
  const toggle = (d) => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b));
  return (
    <>
      <div className="days" role="group" aria-labelledby={labelledBy}>
        {DAY_LETTERS.map((l, i) => (
          <button
            key={i}
            type="button"
            className="day"
            aria-pressed={days.includes(i + 1)}
            aria-label={DAY_NAMES[i]}
            onClick={() => toggle(i + 1)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="preset" aria-pressed={same(p.days, days)} onClick={() => onChange(p.days)}>
            {p.name}
          </button>
        ))}
      </div>
    </>
  );
}

/** 24-hour picker: two number fields with steppers, arrow keys and mouse-wheel scroll. */
export function TimePicker({ hour, minute, onChange }) {
  const wrap = (v, max) => (v + max) % max;
  const setH = (h) => onChange(wrap(h, 24), minute);
  const setM = (m) => onChange(hour, wrap(m, 60));

  return (
    <div className="timepick" role="group" aria-label="Alarm time, 24-hour">
      <NumberColumn label="Hour" value={hour} onStep={(d) => setH(hour + d)} onSet={(v) => v < 24 && onChange(v, minute)} />
      <span className="colon" aria-hidden="true">
        :
      </span>
      <NumberColumn
        label="Minute"
        value={minute}
        onStep={(d, big) => setM(big ? (d > 0 ? minute + 5 - (minute % 5) : minute % 5 ? minute - (minute % 5) : minute - 5) : minute + d)}
        onSet={(v) => v < 60 && onChange(hour, v)}
        bigStep
      />
    </div>
  );
}

function NumberColumn({ label, value, onStep, onSet, bigStep }) {
  const [draft, setDraft] = useState(null);
  const ref = useRef(null);

  // Wheel scrolling needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      e.preventDefault();
      onStep(e.deltaY < 0 ? 1 : -1, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onStep]);

  return (
    <div className="timecol">
      <button type="button" className="step-btn" aria-label={`${label} up`} onClick={() => onStep(1, bigStep)}>
        <ChevronUp size={20} />
      </button>
      <input
        ref={ref}
        className="tnum"
        aria-label={label}
        inputMode="numeric"
        maxLength={2}
        value={draft ?? pad2(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(-2);
          setDraft(digits);
          const v = parseInt(digits, 10);
          if (!Number.isNaN(v)) onSet(v);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDraft(null);
            onStep(1, false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDraft(null);
            onStep(-1, false);
          }
        }}
      />
      <button type="button" className="step-btn" aria-label={`${label} down`} onClick={() => onStep(-1, bigStep)}>
        <ChevronDown size={20} />
      </button>
    </div>
  );
}
