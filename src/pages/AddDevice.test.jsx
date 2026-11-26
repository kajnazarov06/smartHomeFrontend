import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { ApiError } from '../api/client';
import { renderWithProviders } from '../test/utils';
import { makeDevice, unreachableError, validationError } from '../test/fixtures';
import { AddDevice } from './AddDevice';

vi.mock('../api/endpoints');

const FOUND = { id: 'a1b2', name: 'Clock A', host: '192.168.1.57' };

function setup({ found = [], scanError } = {}) {
  api.discovery.mockResolvedValue({ data: found });
  if (scanError) api.scan.mockRejectedValue(scanError);
  else api.scan.mockResolvedValue({});
  return renderWithProviders(<AddDevice />, { route: '/devices/add', path: '/devices/add' });
}

async function addByIp(ip) {
  await userEvent.click(screen.getByRole('button', { name: 'Add by IP address' }));
  if (ip) await userEvent.type(screen.getByLabelText('IP address'), ip);
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
}

async function reachPairStep() {
  setup({ found: [FOUND] });
  api.pairStart.mockResolvedValue({ expires_in: 120 });
  await userEvent.click(await screen.findByRole('button', { name: 'Add Clock A a1b2' }));
  await screen.findByRole('heading', { name: 'Pair Clock A' });
}

async function typeCode(code) {
  await userEvent.click(screen.getByRole('textbox', { name: 'Digit 1' }));
  await userEvent.keyboard(code);
}

describe('AddDevice — find', () => {
  it('scans on open and lists found clocks', async () => {
    setup({ found: [FOUND] });
    expect(await screen.findByText('1 clock found')).toBeInTheDocument();
    expect(screen.getByText('ID a1b2 · 192.168.1.57')).toBeInTheDocument();
    expect(api.scan).toHaveBeenCalledTimes(1);
  });

  it('shows a scan error', async () => {
    setup({ scanError: new ApiError({ status: 500, message: 'The server had a problem' }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem');
  });

  it('ignores a throttled scan', async () => {
    setup({ scanError: new ApiError({ status: 429, message: 'Too many attempts' }) });
    await waitFor(() => expect(api.scan).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks unsupported devices', async () => {
    setup({ found: [{ ...FOUND, supported: false }] });
    expect(await screen.findByText('Not supported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add Clock A/ })).not.toBeInTheDocument();
  });
});

describe('AddDevice — add by IP', () => {
  it('requires an address', async () => {
    setup();
    await addByIp('');
    expect(screen.getByText('Enter the clock’s IP address.')).toBeInTheDocument();
    expect(api.probe).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid host', () => validationError({ host: ['Invalid host'] }), 'Use a local address, like 192.168.1.57 or clock-a1b2.local.'],
    ['no answer', unreachableError, 'No clock answered at 10.0.0.9.'],
    ['an unknown device', () => new ApiError({ status: 404, code: 'device_not_found' }), 'No clock answered at 10.0.0.9.'],
  ])('explains %s', async (_, makeError, text) => {
    setup();
    api.probe.mockRejectedValue(makeError());
    await addByIp('10.0.0.9');
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it.each([
    [{ paired_here: true, name: 'Clock A' }, 'Clock A is already in your devices.'],
    [{ supported: false, type: 'lamp' }, 'This device (lamp) is not supported.'],
  ])('rejects %j', async (info, text) => {
    setup();
    api.probe.mockResolvedValue(info);
    await addByIp('10.0.0.9');
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(api.pairStart).not.toHaveBeenCalled();
  });

  it('starts pairing with the probed host', async () => {
    setup();
    api.probe.mockResolvedValue({ host: '10.0.0.9', name: 'Clock B', id: 'b2' });
    api.pairStart.mockResolvedValue({ expires_in: 120 });
    await addByIp(' 10.0.0.9 ');
    expect(api.probe).toHaveBeenCalledWith('10.0.0.9');
    expect(await screen.findByRole('heading', { name: 'Pair Clock B' })).toBeInTheDocument();
    expect(api.pairStart).toHaveBeenCalledWith('10.0.0.9');
  });
});

describe('AddDevice — pair', () => {
  it('shows the countdown', async () => {
    await reachPairStep();
    expect(screen.getByText(/Code expires in/)).toHaveTextContent(/[12]:\d{2}/);
  });

  it('shows attempts left for a wrong code', async () => {
    await reachPairStep();
    api.pairConfirm.mockRejectedValue(
      new ApiError({ status: 422, code: 'invalid_pairing_code', data: { attempts_left: 2 } }),
    );
    await typeCode('111111');
    expect(api.pairConfirm).toHaveBeenCalledWith('192.168.1.57', '111111');
    expect(await screen.findByText('Wrong code, 2 tries left')).toBeInTheDocument();
  });

  it('shows the lock countdown when pairing is locked', async () => {
    setup({ found: [FOUND] });
    api.pairStart.mockRejectedValue(new ApiError({ status: 429, code: 'pairing_locked', retryAfter: 90 }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Clock A a1b2' }));
    expect(await screen.findByText(/Too many attempts. Try again in/)).toBeInTheDocument();
    expect(screen.getByText(/^1:(29|30)$/)).toBeInTheDocument();
  });

  it('reports other pairing start errors on the find step', async () => {
    setup({ found: [FOUND] });
    api.pairStart.mockRejectedValue(unreachableError());
    await userEvent.click(await screen.findByRole('button', { name: 'Add Clock A a1b2' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Clock A: Clock didn't respond");
  });

  it('goes back to find', async () => {
    await reachPairStep();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Find your clock' })).toBeInTheDocument();
  });
});

describe('AddDevice — name and finish', () => {
  async function reachNameStep() {
    await reachPairStep();
    api.pairConfirm.mockResolvedValue(makeDevice({ id: 'a1b2', name: 'Clock A' }));
    await typeCode('123456');
    await screen.findByRole('heading', { name: 'Name your clock' });
  }

  it('renames, finishes and highlights the device on the dashboard', async () => {
    await reachNameStep();
    api.renameDevice.mockResolvedValue(makeDevice({ id: 'a1b2', name: 'Office' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Clock A');
    await userEvent.clear(name);
    await userEvent.type(name, 'Office');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(api.renameDevice).toHaveBeenCalledWith('a1b2', 'Office');
    expect(await screen.findByRole('heading', { name: 'Office is ready' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('skips the rename when the name is unchanged', async () => {
    await reachNameStep();
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('heading', { name: 'Clock A is ready' })).toBeInTheDocument();
    expect(api.renameDevice).not.toHaveBeenCalled();
  });

  it('requires a name', async () => {
    await reachNameStep();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Give your clock a name.')).toBeInTheDocument();
  });

  it('finishes anyway with a toast when the rename fails', async () => {
    await reachNameStep();
    api.renameDevice.mockRejectedValue(unreachableError());
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText("Couldn't rename — Clock didn't respond")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clock A is ready' })).toBeInTheDocument();
  });
});
