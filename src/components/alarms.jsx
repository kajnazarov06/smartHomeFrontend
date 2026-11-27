import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { DAY_LETTERS, DAY_NAMES, describeDays, pad2 } from '../lib/format';
import { useDismiss } from '../lib/useDismiss';
import { SelectField, Toggle } from './ui';

/** Row: time, label, day letters, toggle, menu. Swipe left on phones to reveal Delete. */
export function AlarmRow({ alarm, onEdit, onToggle, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const days = new Set(alarm.days ?? []);
  const label = alarm.label || (days.size ? describeDays(alarm.days) : 'Once');
  const swipe = useSwipeReveal(!alarm.pending);

  return (
    <div ref={swipe.rowRef} className={`arow ${alarm.enabled ? '' : 'off'} ${alarm.pending ? 'pending' : ''} ${swipe.open ? 'swiped' : ''}`}>
      <button
        type="button"
        className="arow-del"
        tabIndex={swipe.open ? 0 : -1}
        aria-hidden={!swipe.open}
        onClick={() => {
          swipe.close();
          onDelete(alarm);
        }}
      >
        <Trash2 size={18} aria-hidden="true" />
        Delete
      </button>
      <div className="arow-inner" ref={swipe.ref} {...swipe.handlers} style={swipe.style}>
        <button
          type="button"
          className="alink"
          onClick={() => onEdit(alarm)}
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

        <Toggle
          checked={alarm.enabled}
          onChange={(v) => onToggle(alarm, v)}
          disabled={alarm.pending}
          label={`Alarm ${alarm.time} ${alarm.enabled ? 'on' : 'off'}`}
        />

        <RowMenu
          open={menuOpen}
          setOpen={setMenuOpen}
          label={`More options for alarm ${alarm.time}`}
          disabled={alarm.pending}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: () => onEdit(alarm) },
            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(alarm) },
          ]}
        />
      </div>
    </div>
  );
}

const REVEAL = 96; // px the row slides to show its Delete button

/**
 * Touch-only swipe-left-to-reveal (phones). Vertical scrolling stays native (`touch-action: pan-y`).
 * While open, a tap on the row closes it instead of editing.
 */
function useSwipeReveal(enabled) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(null); // live offset while dragging, null when idle
  const ref = useRef(null); // the sliding part
  const rowRef = useRef(null); // the whole row, Delete button included
  const g = useRef(null);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  // Tap anywhere else closes an open row.
  useDismiss(rowRef, open, () => setOpen(false), { escape: false, touch: true });

  const handlers = {
    onTouchStart: (e) => {
      if (!enabled || e.touches.length !== 1) return;
      const t = e.touches[0];
      g.current = { x: t.clientX, y: t.clientY, base: open ? -REVEAL : 0, axis: null };
    },
    onTouchMove: (e) => {
      const s = g.current;
      if (!s) return;
      const t = e.touches[0];
      const mx = t.clientX - s.x;
      const my = t.clientY - s.y;
      if (!s.axis && Math.hypot(mx, my) > 8) s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (s.axis === 'x') setDx(Math.max(-REVEAL - 24, Math.min(0, s.base + mx)));
    },
    onTouchEnd: () => {
      const s = g.current;
      g.current = null;
      if (s?.axis === 'x' && dx != null) {
        setOpen(dx < -REVEAL / 2);
        // Suppress the click a touch sequence may still fire on the row.
        ref.current?.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => ref.current?.removeEventListener('click', stop, { capture: true }), 400);
      }
      setDx(null);
    },
    onTouchCancel: () => {
      g.current = null;
      setDx(null);
    },
    onClickCapture: (e) => {
      if (open) {
        stop(e);
        setOpen(false);
      }
    },
  };

  const offset = dx ?? (open ? -REVEAL : 0);
  return {
    open,
    ref,
    rowRef,
    handlers,
    close: () => setOpen(false),
    style: offset ? { transform: `translateX(${offset}px)`, transition: dx == null ? undefined : 'none' } : undefined,
  };
}

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
}

function RowMenu({ open, setOpen, label, items, disabled }) {
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  useEffect(() => {
    if (open) ref.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open]);

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

const SNOOZE = [5, 10, 15];
export const DEFAULT_SNOOZE = 10;

/** Snooze length in minutes. A non-standard value the clock reports stays selectable. */
export function SnoozeSelect({ label, value, onChange }) {
  const options = SNOOZE.includes(value) ? SNOOZE : [...SNOOZE, value].sort((a, b) => a - b);
  return (
    <SelectField label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map((m) => (
        <option key={m} value={m}>
          {m} min
        </option>
      ))}
    </SelectField>
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
const wrap = (v, max) => (v + max) % max;

/** Next multiple of 5 in direction `dir` (+1 / −1): 07 → 10 / 05, 10 → 15 / 05. */
const snap5 = (m, dir) => (dir > 0 ? m + 5 - (m % 5) : m - (m % 5 || 5));

export function TimePicker({ hour, minute, onChange }) {
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
        onStep={(d, big) => setM(big ? snap5(minute, d) : minute + d)}
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
