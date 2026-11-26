import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { renderWithProviders } from '../test/utils';
import { makeDevice, unreachableError } from '../test/fixtures';
import { Dashboard } from './Dashboard';

vi.mock('../api/endpoints');

const render = (route = '/') => renderWithProviders(<Dashboard />, { route });

describe('Dashboard', () => {
  it('shows skeletons while loading', () => {
    api.devices.mockReturnValue(new Promise(() => {}));
    render();
    expect(screen.getAllByLabelText('Loading device')).toHaveLength(3);
  });

  it('shows the empty state', async () => {
    api.devices.mockResolvedValue([]);
    render();
    expect(await screen.findByText('No devices yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first device' })).toHaveAttribute('href', '/devices/add');
  });

  it('shows an error with Try again', async () => {
    api.devices.mockRejectedValueOnce(unreachableError()).mockResolvedValueOnce([makeDevice()]);
    render();
    expect(await screen.findByText("Couldn't load your devices")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Bedroom')).toBeInTheDocument();
  });

  it('lists devices with an online count', async () => {
    api.devices.mockResolvedValue([makeDevice(), makeDevice({ id: 'clk-2', name: 'Kitchen', online: false })]);
    render();
    expect(await screen.findByText('2 devices · 1 online')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add device' })).toBeInTheDocument();
  });

  it('highlights a just-added device', async () => {
    api.devices.mockResolvedValue([makeDevice()]);
    render({ pathname: '/', state: { highlight: 'clk-1' } });
    expect(await screen.findByText('New')).toBeInTheDocument();
  });
});
