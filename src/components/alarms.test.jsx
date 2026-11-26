import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAlarm } from '../test/fixtures';
import { AlarmRow, DayPicker, TimePicker } from './alarms';

describe('AlarmRow', () => {
  function renderRow(alarm = makeAlarm()) {
    const handlers = { onEdit: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn() };
    render(<AlarmRow alarm={alarm} {...handlers} />);
    return handlers;
  }

  it('shows time and a label derived from the days', () => {
    renderRow();
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('Mon–Fri')).toBeInTheDocument();
  });

  it('prefers the alarm label and says Once for a one-shot', () => {
    renderRow(makeAlarm({ label: 'Gym', days: [] }));
    expect(screen.getByText('Gym')).toBeInTheDocument();
  });

  it('labels a one-shot without a label as Once', () => {
    renderRow(makeAlarm({ days: [] }));
    expect(screen.getByText('Once')).toBeInTheDocument();
  });

  it('opens the editor', async () => {
    const alarm = makeAlarm();
    const { onEdit } = renderRow(alarm);
    await userEvent.click(screen.getByRole('button', { name: /^Edit alarm 07:00/ }));
    expect(onEdit).toHaveBeenCalledWith(alarm);
  });

  it('toggles', async () => {
    const alarm = makeAlarm();
    const { onToggle, onEdit } = renderRow(alarm);
    await userEvent.click(screen.getByRole('switch', { name: 'Alarm 07:00 on' }));
    expect(onToggle).toHaveBeenCalledWith(alarm, false);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('deletes and edits from the row menu', async () => {
    const alarm = makeAlarm();
    const { onDelete, onEdit } = renderRow(alarm);
    const more = screen.getByRole('button', { name: 'More options for alarm 07:00' });

    await userEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(alarm);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(more);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(alarm);
  });

  it('closes the menu on outside click and Escape', async () => {
    renderRow();
    const more = screen.getByRole('button', { name: 'More options for alarm 07:00' });

    await userEvent.click(more);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(more);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('locks toggle and menu while the alarm is pending', () => {
    renderRow(makeAlarm({ pending: true }));
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More options for alarm 07:00' })).toBeDisabled();
  });
});

describe('DayPicker', () => {
  function Harness({ initial, onChange = () => {} }) {
    const [days, setDays] = useState(initial);
    return (
      <>
        <DayPicker
          value={days}
          onChange={(d) => {
            onChange(d);
            setDays(d);
          }}
        />
        <output>{JSON.stringify(days)}</output>
      </>
    );
  }

  it('toggles days and keeps them sorted', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[3, 1]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    expect(onChange).toHaveBeenLastCalledWith([1, 2, 3]);
    await userEvent.click(screen.getByRole('button', { name: 'Monday' }));
    expect(onChange).toHaveBeenLastCalledWith([2, 3]);
    expect(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies presets and highlights the matching one', async () => {
    render(<Harness initial={[7, 6]} />);
    expect(screen.getByRole('button', { name: 'Weekends' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Once' }));
    expect(screen.getByRole('status')).toHaveTextContent('[]');
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays' }));
    expect(screen.getByRole('status')).toHaveTextContent('[1,2,3,4,5]');
  });
});

describe('TimePicker', () => {
  function Harness({ h, m }) {
    const [t, setT] = useState({ h, m });
    return (
      <>
        <TimePicker hour={t.h} minute={t.m} onChange={(hour, minute) => setT({ h: hour, m: minute })} />
        <output>{`${t.h}:${t.m}`}</output>
      </>
    );
  }
  const shown = () => screen.getByRole('status').textContent;

  it('wraps hours', async () => {
    render(<Harness h={23} m={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hour up' }));
    expect(shown()).toBe('0:0');
    await userEvent.click(screen.getByRole('button', { name: 'Hour down' }));
    expect(shown()).toBe('23:0');
  });

  it.each([
    [7, 'up', 10],
    [10, 'up', 15],
    [7, 'down', 5],
    [10, 'down', 5],
    [0, 'down', 55],
    [57, 'up', 0],
  ])('minute buttons snap to 5: %i %s → %i', async (from, dir, to) => {
    render(<Harness h={7} m={from} />);
    await userEvent.click(screen.getByRole('button', { name: `Minute ${dir}` }));
    expect(shown()).toBe(`7:${to}`);
  });

  it('steps by one with arrow keys and the wheel', () => {
    render(<Harness h={7} m={30} />);
    const minute = screen.getByRole('textbox', { name: 'Minute' });
    fireEvent.keyDown(minute, { key: 'ArrowUp' });
    expect(shown()).toBe('7:31');
    fireEvent.keyDown(minute, { key: 'ArrowDown' });
    fireEvent.keyDown(minute, { key: 'ArrowDown' });
    expect(shown()).toBe('7:29');
    fireEvent.wheel(minute, { deltaY: -100 });
    expect(shown()).toBe('7:30');
  });

  it('accepts typed values in range and ignores out-of-range ones', () => {
    render(<Harness h={7} m={30} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Minute' }), { target: { value: '45' } });
    expect(shown()).toBe('7:45');
    fireEvent.change(screen.getByRole('textbox', { name: 'Hour' }), { target: { value: '25' } });
    expect(shown()).toBe('7:45');
    fireEvent.change(screen.getByRole('textbox', { name: 'Hour' }), { target: { value: '9' } });
    expect(shown()).toBe('9:45');
  });

  it('shows padded values', () => {
    render(<Harness h={7} m={5} />);
    expect(screen.getByRole('textbox', { name: 'Hour' })).toHaveValue('07');
    expect(screen.getByRole('textbox', { name: 'Minute' })).toHaveValue('05');
  });
});
