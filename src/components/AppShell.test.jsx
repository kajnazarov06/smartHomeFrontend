import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { getEcho } from '../lib/echo';
import { useConnection } from '../lib/connection';
import { createTestQueryClient, renderWithProviders } from '../test/utils';
import { makeDevice } from '../test/fixtures';
import { AppShell } from './AppShell';

vi.mock('../api/endpoints');
vi.mock('../lib/echo');
vi.mock('../lib/connection', async (importOriginal) => ({
  ...(await importOriginal()),
  useConnection: vi.fn(() => ({ server: true, socket: 'connected' })),
}));

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(['user'], { id: 7, email: 'me@example.com' });
  queryClient.setQueryData(['devices'], [makeDevice()]);
  renderWithProviders(<AppShell />, { queryClient });
  return queryClient;
}

describe('AppShell', () => {
  it('opens the account menu and shows who is signed in', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('closes the account menu on Escape and returns focus', async () => {
    setup();
    const button = screen.getByRole('button', { name: 'Account menu' });
    await userEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes the account menu on outside click', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('signs out, clears the cache and goes to sign-in', async () => {
    const qc = setup();
    api.logout.mockResolvedValue({});
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
    expect(qc.getQueryData(['user'])).toBeNull();
    expect(qc.getQueryData(['devices'])).toBeUndefined();
  });

  it('toasts when an alarm rings', async () => {
    const handlers = {};
    const channel = { listen: (e, fn) => ((handlers[e] = fn), channel) };
    getEcho.mockReturnValue({ private: () => channel, leave: vi.fn() });
    setup();
    act(() => handlers['.alarm.ringing']({ device_id: 'clk-1' }));
    expect(await screen.findByText('Bedroom: alarm ringing')).toBeInTheDocument();
  });

  it('shows the connection banner only while the server is down', () => {
    setup();
    expect(screen.queryByText(/Can't reach the local server/)).not.toBeInTheDocument();
    useConnection.mockReturnValue({ server: false, socket: 'connecting' });
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the local server. Reconnecting…");
  });
});
