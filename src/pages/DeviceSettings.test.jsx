import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { createTestQueryClient, renderWithProviders } from '../test/utils';
import { alarmsResponse, makeAlarm, makeDevice, unreachableError, validationError } from '../test/fixtures';
import { DeviceSettings } from './DeviceSettings';

vi.mock('../api/endpoints');

function setup(device = makeDevice(), alarms = [makeAlarm(), makeAlarm({ id: 2 })]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(['devices'], [device]);
  queryClient.setQueryData(['device', device.id], device);
  queryClient.setQueryData(['alarms', device.id], alarmsResponse(alarms));
  api.alarms.mockResolvedValue(alarmsResponse(alarms));
  const onClose = vi.fn();
  renderWithProviders(<DeviceSettings device={device} onClose={onClose} />, {
    route: '/devices/clk-1',
    path: '/devices/:id',
    queryClient,
  });
  return { onClose, queryClient };
}

const panel = () => screen.getByRole('dialog', { name: 'Device settings' });
const save = () => userEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
const nameField = () => screen.getByRole('textbox', { name: 'Name' });

describe('DeviceSettings — saving', () => {
  it('starts from the device settings', () => {
    setup();
    expect(nameField()).toHaveValue('Bedroom');
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveValue('Europe/Berlin');
    expect(screen.getByRole('slider', { name: 'Display brightness' })).toHaveValue('70');
    expect(screen.getByRole('combobox', { name: 'Default snooze' })).toHaveValue('10');
  });

  it('closes without a request when nothing changed', async () => {
    const { onClose } = setup();
    await save();
    expect(api.updateSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sends only the changed fields', async () => {
    const { onClose } = setup();
    api.updateSettings.mockResolvedValue(makeDevice({ name: 'Office' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Display brightness' }), { target: { value: '50' } });
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), ' Office ');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Default snooze' }), '15');
    await save();

    expect(api.updateSettings).toHaveBeenCalledWith('clk-1', { name: 'Office', brightness: 50, snooze_min: 15 });
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('requires a name', async () => {
    setup();
    await userEvent.clear(nameField());
    await save();
    expect(screen.getByText('Give your clock a name.')).toBeInTheDocument();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('shows a server-side name error and an error toast', async () => {
    const { onClose } = setup();
    api.updateSettings.mockRejectedValue(validationError({ name: ['The name has already been taken.'] }));
    await userEvent.type(nameField(), '2');
    await save();
    expect(await screen.findByText('The name has already been taken.', { selector: '.field-error' })).toBeInTheDocument();
    expect(screen.getByText(/^Couldn't save settings — /)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a non-standard snooze in the options', () => {
    setup(makeDevice({ settings: { tz: 'UTC', brightness: 70, snooze_min: 20 } }));
    const options = within(screen.getByRole('combobox', { name: 'Default snooze' }))
      .getAllByRole('option')
      .map((o) => o.value);
    expect(options).toEqual(['5', '10', '15', '20']);
  });

  it('warns when the clock is offline', () => {
    setup(makeDevice({ online: false }));
    expect(screen.getByText(/The clock is offline/)).toBeInTheDocument();
  });
});

describe('DeviceSettings — removing', () => {
  const openConfirm = async () => {
    await userEvent.click(within(panel()).getByRole('button', { name: 'Remove device' }));
    return screen.getByRole('alertdialog');
  };

  it('confirms with the alarm count, removes and goes home', async () => {
    setup();
    api.removeDevice.mockResolvedValue({});
    const confirm = await openConfirm();
    expect(within(confirm).getByRole('heading')).toHaveTextContent('Remove Bedroom?');
    expect(confirm).toHaveTextContent('and its 2 alarms deleted');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove device' }));

    expect(api.removeDevice).toHaveBeenCalledWith('clk-1', { force: false });
    expect(await screen.findByText('Bedroom removed')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('offers Remove anyway when the clock does not respond', async () => {
    setup();
    api.removeDevice.mockRejectedValueOnce(unreachableError()).mockResolvedValueOnce({});
    const confirm = await openConfirm();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove device' }));

    expect(await within(confirm).findByRole('heading', { name: "Clock didn't respond" })).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove anyway' }));
    expect(api.removeDevice).toHaveBeenLastCalledWith('clk-1', { force: true });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it('can be cancelled', async () => {
    setup();
    const confirm = await openConfirm();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.removeDevice).not.toHaveBeenCalled();
  });
});
