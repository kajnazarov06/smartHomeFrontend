import { describe, expect, it } from 'vitest';
import {
  describeDays,
  describeNextAlarm,
  deviceTz,
  formatClock,
  formatCountdown,
  formatLongDate,
  formatNumber,
  pad2,
  rssiToBars,
  timeAgo,
  utcOffsetLabel,
} from './format';

describe('describeDays', () => {
  it.each([
    [[], 'Once'],
    [undefined, 'Once'],
    [[1, 2, 3, 4, 5, 6, 7], 'Every day'],
    [[5, 1, 2, 3, 4], 'Mon–Fri'],
    [[7, 6], 'Weekends'],
    [[2, 3, 4, 5, 6], 'Tue–Sat'],
    [[1, 2], 'Mon, Tue'],
    [[1, 3], 'Mon, Wed'],
    [[3, 1, 1], 'Mon, Wed'],
  ])('%j → %s', (days, expected) => {
    expect(describeDays(days)).toBe(expected);
  });
});

describe('rssiToBars', () => {
  it.each([
    [null, 0],
    [undefined, 0],
    ['abc', 0],
    [-50, 4],
    [-55, 4],
    [-60, 3],
    ['-60', 3],
    [-70, 2],
    [-80, 1],
    [-90, 0],
  ])('%s dBm → %i bars', (rssi, bars) => {
    expect(rssiToBars(rssi)).toBe(bars);
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-01-15T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();

  it.each([
    [null, 'never'],
    [ago(30_000), 'just now'],
    [ago(-60_000), 'just now'],
    [ago(5 * 60_000), '5 min ago'],
    [ago(3 * 3600_000), '3 h ago'],
    [ago(24 * 3600_000), '1 day ago'],
    [ago(2 * 24 * 3600_000), '2 days ago'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});

describe('number helpers', () => {
  it('pad2 pads to two digits', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(12)).toBe('12');
  });

  it('formatNumber rounds, accepts strings and shows a dash for missing values', () => {
    expect(formatNumber(21.46, 1)).toBe('21.5');
    expect(formatNumber('44.6')).toBe('45');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber('n/a')).toBe('—');
  });

  it('formatCountdown renders m:ss and never goes negative', () => {
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(0.2)).toBe('0:01');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('describeNextAlarm', () => {
  it.each([
    [null, null],
    [42, null],
    [{}, null],
    ['06:30', { time: '06:30', days: null }],
    ['2026-11-25T07:00:00', { time: '07:00', days: null }],
    [{ time: '06:30:00', days: [6, 7] }, { time: '06:30', days: 'Weekends' }],
    [{ time: '06:30' }, { time: '06:30', days: null }],
  ])('%j → %j', (input, expected) => {
    expect(describeNextAlarm(input)).toEqual(expected);
  });
});

describe('time zones', () => {
  const date = new Date('2026-01-15T12:34:00Z');

  it('formatClock renders 24 h time in the device tz', () => {
    expect(formatClock(date, 'Europe/Berlin')).toBe('13:34');
    expect(formatClock(date, 'Asia/Tashkent')).toBe('17:34');
  });

  it('formatClock falls back to the local tz for an invalid zone', () => {
    expect(formatClock(date, 'Not/AZone')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('formatLongDate renders weekday, day and month', () => {
    expect(formatLongDate(date, 'UTC')).toMatch(/Thursday,? 15 January/);
  });

  it('deviceTz prefers the live state over settings', () => {
    expect(deviceTz({ state: { tz: 'A/B' }, settings: { tz: 'C/D' } })).toBe('A/B');
    expect(deviceTz({ state: {}, settings: { tz: 'C/D' } })).toBe('C/D');
    expect(deviceTz({})).toBeUndefined();
    expect(deviceTz(null)).toBeUndefined();
  });

  it('utcOffsetLabel renders UTC offsets with a real minus sign', () => {
    // ICU versions differ: "GMT" or "GMT+0".
    expect(utcOffsetLabel('UTC', date)).toMatch(/^UTC(\+0)?$/);
    expect(utcOffsetLabel('Asia/Tashkent', date)).toBe('UTC+5');
    expect(utcOffsetLabel('America/New_York', date)).toBe('UTC−5');
    expect(utcOffsetLabel('Not/AZone', date)).toBe('');
  });
});
