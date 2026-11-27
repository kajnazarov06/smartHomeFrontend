import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { createTestQueryClient, renderWithProviders } from '../test/utils';
import { alarmsResponse, makeAlarm, unreachableError } from '../test/fixtures';
import { AlarmEditor } from './AlarmEditor';

vi.mock('../api/endpoints');

function setup(props = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(['alarms', 'clk-1'], alarmsResponse(props.alarm ? [props.alarm] : []));
  const onClose = vi.fn();
  renderWithProviders(<AlarmEditor deviceId="clk-1" onClose={onClose} {...props} />, { queryClient });
  return { onClose, queryClient };
}

const dialog = () => screen.getByRole('dialog');
const save = () => userEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
const snoozeOptions = () =>
  within(screen.getByRole('combobox', { name: 'Snooze' }))
    .getAllByRole('option')
    .map((o) => o.value);

describe('AlarmEditor — new alarm', () => {
  it('defaults to 07:00 on weekdays', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'New alarm' })).toBeInTheDocument();
    expect(screen.getByText('07:00 · Mon–Fri')).toBeInTheDocument();
  });

  it('creates the alarm with the chosen fields', async () => {
    const { onClose } = setup({ defaultSnooze: 15 });
    api.createAlarm.mockResolvedValue(makeAlarm({ id: 9 }));

    await userEvent.click(screen.getByRole('button', { name: 'Hour up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Weekends' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Label' }), '  Gym  ');
    expect(screen.getByRole('combobox', { name: 'Snooze' })).toHaveValue('15');
    await save();

    expect(api.createAlarm).toHaveBeenCalledWith('clk-1', {
      time: '08:00',
      days: [6, 7],
      label: 'Gym',
      snooze_min: 15,
      enabled: true,
    });
    expect(await screen.findByText('Alarm saved')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('says "Rings once" for a one-shot and sends a null label', async () => {
    setup();
    api.createAlarm.mockResolvedValue(makeAlarm());
    await userEvent.click(screen.getByRole('button', { name: 'Once' }));
    expect(screen.getByText('07:00 · Rings once')).toBeInTheDocument();
    await save();
    expect(api.createAlarm).toHaveBeenCalledWith('clk-1', expect.objectContaining({ days: [], label: null, snooze_min: 10 }));
  });

  it('toasts a failed save with Retry', async () => {
    const { onClose } = setup();
    api.createAlarm.mockRejectedValueOnce(unreachableError()).mockResolvedValueOnce(makeAlarm({ id: 9 }));
    await save();
    expect(await screen.findByText("Couldn't save alarm — Clock didn't respond")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.createAlarm).toHaveBeenCalledTimes(2);
  });

  it('offers the standard snooze lengths', () => {
    setup();
    expect(snoozeOptions()).toEqual(['5', '10', '15']);
  });
});

describe('AlarmEditor — editing', () => {
  const alarm = makeAlarm({ id: 3, time: '06:45', days: [1, 3], label: 'Run', snooze_min: 20 });

  it('starts from the alarm and keeps a non-standard snooze', () => {
    setup({ alarm });
    expect(screen.getByRole('dialog', { name: 'Edit alarm' })).toBeInTheDocument();
    expect(screen.getByText('06:45 · Mon, Wed')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Run');
    expect(snoozeOptions()).toEqual(['5', '10', '15', '20']);
    expect(screen.getByRole('combobox', { name: 'Snooze' })).toHaveValue('20');
  });

  it('updates the alarm', async () => {
    setup({ alarm });
    api.updateAlarm.mockResolvedValue(alarm);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Snooze' }), '5');
    await save();
    expect(api.updateAlarm).toHaveBeenCalledWith('clk-1', 3, {
      time: '06:45',
      days: [1, 3],
      label: 'Run',
      snooze_min: 5,
    });
  });

  it('closes and hands the delete to the parent', async () => {
    const onDelete = vi.fn();
    const { onClose } = setup({ alarm, onDelete });
    await userEvent.click(screen.getByRole('button', { name: 'Delete alarm' }));
    expect(onClose).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(alarm);
    expect(api.deleteAlarm).not.toHaveBeenCalled();
  });

  it('closes on Cancel', async () => {
    const { onClose } = setup({ alarm });
    await userEvent.click(within(dialog()).getAllByRole('button', { name: 'Cancel' })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
