import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { ApiError } from '../api/client';
import { createTestQueryClient, renderWithProviders } from '../test/utils';
import { alarmsResponse, makeAlarm, makeDevice, unreachableError } from '../test/fixtures';
import { DeviceDetail } from './DeviceDetail';

vi.mock('../api/endpoints');
vi.mock('../lib/echo');

function setup({ device = makeDevice(), alarms = [makeAlarm()], meta, alarmsError, deviceError } = {}) {
  const queryClient = createTestQueryClient();
  if (deviceError) api.device.mockRejectedValue(deviceError);
  else if (device) {
    queryClient.setQueryData(['device', device.id], device);
    api.device.mockResolvedValue(device);
    api.devices.mockResolvedValue([device]);
  }
  if (alarmsError) api.alarms.mockRejectedValue(alarmsError);
  else api.alarms.mockResolvedValue(alarmsResponse(alarms, meta));
  api.readings.mockResolvedValue({ points: [] });
  renderWithProviders(<DeviceDetail />, { route: '/devices/clk-1', path: '/devices/:id', queryClient });
  return queryClient;
}

const alarmsCard = () => screen.getByRole('region', { name: 'Alarms' });

describe('DeviceDetail — readings', () => {
  it('shows the name, status and both sensor values', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Bedroom' })).toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'Current readings' });
    expect(within(hero).getByText('Temperature')).toBeInTheDocument();
    expect(within(hero).getByText('21.5')).toBeInTheDocument();
    expect(within(hero).getByText('Humidity')).toBeInTheDocument();
    expect(within(hero).getByText('45')).toBeInTheDocument();
  });

  it('only renders the sensors the device has', () => {
    setup({ device: makeDevice({ capabilities: ['clock', 'alarm', 'humidity'] }) });
    const hero = screen.getByRole('region', { name: 'Current readings' });
    expect(within(hero).queryByText('Temperature')).not.toBeInTheDocument();
    expect(within(hero).getByText('45')).toBeInTheDocument();
  });

  it('shows the device facts in the footer', () => {
    setup();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.57')).toBeInTheDocument();
  });

  it('explains an offline device', () => {
    setup({ device: makeDevice({ online: false, last_seen_at: new Date(Date.now() - 3 * 3600_000).toISOString() }) });
    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
    expect(screen.getByText(/Last seen 3 h ago — showing the last known values/)).toBeInTheDocument();
  });

  it('shows not-found for a 404', async () => {
    setup({ deviceError: new ApiError({ status: 404, message: 'Not found' }) });
    expect(await screen.findByText('Device not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to My devices' })).toHaveAttribute('href', '/');
  });

  it('shows the empty history state', async () => {
    setup();
    expect(await screen.findByText('Collecting data — check back in a few minutes')).toBeInTheDocument();
  });
});

describe('DeviceDetail — rename', () => {
  async function rename(name) {
    await userEvent.click(screen.getByRole('button', { name: 'Rename device' }));
    const input = screen.getByRole('textbox', { name: 'Device name' });
    await userEvent.clear(input);
    await userEvent.type(input, name);
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
  }

  it('saves a new name', async () => {
    setup();
    api.renameDevice.mockResolvedValue(makeDevice({ name: 'Office' }));
    await rename('Office');
    expect(api.renameDevice).toHaveBeenCalledWith('clk-1', 'Office');
    expect(await screen.findByText('Name saved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Office' })).toBeInTheDocument();
  });

  it('skips the request when the name is unchanged or blank', async () => {
    setup();
    await rename('Bedroom');
    await rename('   ');
    expect(api.renameDevice).not.toHaveBeenCalled();
  });

  it('cancels with Escape', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Rename device' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Device name' }), 'xx{Escape}');
    expect(screen.getByRole('heading', { level: 1, name: 'Bedroom' })).toBeInTheDocument();
  });

  it('shows an error toast with Retry', async () => {
    setup();
    api.renameDevice.mockRejectedValueOnce(unreachableError());
    await rename('Office');
    expect(await screen.findByText("Couldn't rename — Clock didn't respond")).toBeInTheDocument();
    api.renameDevice.mockResolvedValueOnce(makeDevice({ name: 'Office' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(api.renameDevice).toHaveBeenCalledTimes(2);
  });

  // Known bug (DRY/KISS review #3): the Retry calls rename.mutate() without the toast callbacks.
  it.fails('confirms a successful retry with a toast', async () => {
    setup();
    api.renameDevice.mockRejectedValueOnce(unreachableError());
    await rename('Office');
    await screen.findByText("Couldn't rename — Clock didn't respond");
    api.renameDevice.mockResolvedValueOnce(makeDevice({ name: 'Office' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Name saved', {}, { timeout: 500 })).toBeInTheDocument();
  });
});

describe('DeviceDetail — alarms', () => {
  it('lists alarms sorted by time', async () => {
    setup({ alarms: [makeAlarm({ id: 2, time: '08:15' }), makeAlarm({ id: 1, time: '06:30' })] });
    await within(alarmsCard()).findByText('06:30');
    const times = within(alarmsCard())
      .getAllByRole('button', { name: /^Edit alarm/ })
      .map((b) => b.textContent.slice(0, 5));
    expect(times).toEqual(['06:30', '08:15']);
  });

  it('shows the empty state and opens the editor', async () => {
    setup({ alarms: [] });
    expect(await screen.findByText('No alarms yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add alarm' }));
    expect(screen.getByRole('dialog', { name: 'New alarm' })).toBeInTheDocument();
  });

  it('shows a load error with Try again', async () => {
    setup({ alarmsError: unreachableError() });
    expect(await screen.findByText("Couldn't load alarms — Clock didn't respond")).toBeInTheDocument();
  });

  it('notes stale alarms while the clock is online', async () => {
    setup({ meta: { stale: true } });
    expect(await screen.findByText(/changes will be sent when it.s back/)).toBeInTheDocument();
  });

  it('disables Add at the 10-alarm limit', async () => {
    setup({ alarms: Array.from({ length: 10 }, (_, i) => makeAlarm({ id: i + 1, time: `0${i}:00` })) });
    const add = await within(alarmsCard()).findByRole('button', { name: /Add/ });
    expect(add).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('A clock can store at most 10 alarms');
  });

  it('turns an alarm off', async () => {
    setup();
    api.updateAlarm.mockResolvedValue(makeAlarm({ enabled: false }));
    await userEvent.click(await screen.findByRole('switch', { name: 'Alarm 07:00 on' }));
    expect(api.updateAlarm).toHaveBeenCalledWith('clk-1', 1, { enabled: false });
    expect(await screen.findByRole('switch', { name: 'Alarm 07:00 off' })).toBeInTheDocument();
  });

  it('toasts a failed toggle with Retry and rolls it back', async () => {
    setup();
    api.updateAlarm.mockRejectedValue(unreachableError());
    await userEvent.click(await screen.findByRole('switch', { name: 'Alarm 07:00 on' }));
    expect(await screen.findByText("Couldn't turn off alarm — Clock didn't respond")).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Alarm 07:00 on' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.updateAlarm).toHaveBeenCalledTimes(2));
  });

  it('deletes from the row menu', async () => {
    setup();
    api.deleteAlarm.mockResolvedValue({});
    await userEvent.click(await screen.findByRole('button', { name: 'More options for alarm 07:00' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(api.deleteAlarm).toHaveBeenCalledWith('clk-1', 1);
    expect(await screen.findByText('Alarm deleted')).toBeInTheDocument();
  });

  it('toasts a failed delete with Retry', async () => {
    setup();
    api.deleteAlarm.mockRejectedValue(unreachableError());
    await userEvent.click(await screen.findByRole('button', { name: 'More options for alarm 07:00' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByText("Couldn't delete alarm — Clock didn't respond")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.deleteAlarm).toHaveBeenCalledTimes(2));
  });

  it('deletes from the editor', async () => {
    setup();
    api.deleteAlarm.mockResolvedValue({});
    await userEvent.click(await screen.findByRole('button', { name: /^Edit alarm 07:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete alarm' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.deleteAlarm).toHaveBeenCalledWith('clk-1', 1);
    await waitFor(() => expect(screen.queryByText('07:00')).not.toBeInTheDocument());
  });

  // Known bug: AlarmEditor closes (unmounts) before mutate() settles, so its toast callbacks never run.
  it.fails('confirms a delete from the editor with a toast', async () => {
    setup();
    api.deleteAlarm.mockResolvedValue({});
    await userEvent.click(await screen.findByRole('button', { name: /^Edit alarm 07:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete alarm' }));
    expect(await screen.findByText('Alarm deleted', {}, { timeout: 500 })).toBeInTheDocument();
  });
});
