import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeDevice } from '../test/fixtures';
import { DeviceCard, SensorTile, hasCap, sensorsOf } from './device';

describe('sensorsOf', () => {
  it('follows the capability list', () => {
    expect(sensorsOf(makeDevice())).toEqual(['temperature', 'humidity']);
    expect(sensorsOf(makeDevice({ capabilities: ['clock', 'temperature'] }))).toEqual(['temperature']);
    expect(sensorsOf(makeDevice({ capabilities: ['clock'] }))).toEqual([]);
  });

  it('falls back to the state for records without capabilities', () => {
    expect(sensorsOf({ capabilities: [], state: { humidity_pct: 40 } })).toEqual(['humidity']);
    expect(sensorsOf({ state: {} })).toEqual([]);
    expect(sensorsOf(null)).toEqual([]);
  });
});

describe('hasCap', () => {
  it('checks the capability list', () => {
    expect(hasCap(makeDevice({ capabilities: ['temperature'] }), 'alarm')).toBe(false);
    expect(hasCap(makeDevice({ capabilities: ['temperature'] }), 'temperature')).toBe(true);
  });

  it('assumes a clock with alarms when no capabilities are known', () => {
    const legacy = { capabilities: [] };
    expect(hasCap(legacy, 'clock')).toBe(true);
    expect(hasCap(legacy, 'alarm')).toBe(true);
    expect(hasCap(legacy, 'temperature')).toBe(false);
  });
});

describe('SensorTile', () => {
  it('formats temperature to one decimal', () => {
    render(<SensorTile kind="temperature" value={21.46} />);
    expect(screen.getByLabelText('Temperature 21.5 °C')).toBeInTheDocument();
  });

  it('rounds humidity and shows a dash when missing', () => {
    const { rerender } = render(<SensorTile kind="humidity" value={44.6} size="lg" />);
    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    rerender(<SensorTile kind="humidity" value={null} size="lg" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('DeviceCard', () => {
  const renderCard = (device, props) =>
    render(
      <MemoryRouter>
        <DeviceCard device={device} {...props} />
      </MemoryRouter>,
    );

  it('links to the detail page with a spoken summary', () => {
    renderCard(makeDevice());
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/devices/clk-1');
    const label = link.getAttribute('aria-label');
    expect(label).toMatch(/^Bedroom, online, \d{2}:\d{2}, /);
    expect(label).toContain('21.5 degrees');
    expect(label).toContain('45 percent humidity');
    expect(label).toContain('next alarm 07:00');
  });

  it('shows sensor values from the device state', () => {
    renderCard(makeDevice());
    expect(screen.getByLabelText('Temperature 21.5 °C')).toBeInTheDocument();
    expect(screen.getByLabelText('Humidity 45 %')).toBeInTheDocument();
  });

  it('shows the next alarm with its days', () => {
    renderCard(makeDevice({ next_alarm: { time: '06:30', days: [6, 7] } }));
    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText(/Weekends/)).toBeInTheDocument();
  });

  it('says when no alarms are set', () => {
    renderCard(makeDevice({ next_alarm: null }));
    expect(screen.getByText('No alarms set')).toBeInTheDocument();
  });

  it('shows offline state and last seen', () => {
    renderCard(makeDevice({ online: false, last_seen_at: new Date(Date.now() - 5 * 60_000).toISOString() }));
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Last seen 5 min ago')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('aria-label')).toContain('offline, last seen 5 min ago');
  });

  it('renders a non-clock device from its capabilities', () => {
    renderCard(makeDevice({ capabilities: ['temperature'], type_label: 'Thermometer', next_alarm: null, state: { temperature_c: 19 } }));
    expect(screen.getByText('Thermometer')).toBeInTheDocument();
    expect(screen.queryByText('No alarms set')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Humidity/)).not.toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('aria-label')).not.toMatch(/\d{2}:\d{2}/);
  });

  it('marks a just-added device', () => {
    renderCard(makeDevice(), { highlighted: true });
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
