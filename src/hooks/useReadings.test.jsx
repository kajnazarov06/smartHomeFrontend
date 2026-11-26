import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from '../api/endpoints';
import { createTestQueryClient, queryWrapper } from '../test/utils';
import { useReadings } from './useReadings';

vi.mock('../api/endpoints');

describe('useReadings', () => {
  it('maps points to numbers and timestamps', async () => {
    api.readings.mockResolvedValue({
      points: [
        { ts: '2026-01-01T00:00:00Z', temperature_c: '21.5', humidity_pct: null },
        { ts: '2026-01-01T00:30:00Z', temperature_c: null, humidity_pct: 40 },
      ],
    });

    const { result } = renderHook(() => useReadings('clk-1', '7d'), { wrapper: queryWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.readings).toHaveBeenCalledWith('clk-1', '7d');
    expect(result.current.data).toEqual([
      { t: Date.parse('2026-01-01T00:00:00Z'), temperature: 21.5, humidity: null },
      { t: Date.parse('2026-01-01T00:30:00Z'), temperature: null, humidity: 40 },
    ]);
  });

  it('returns an empty list when the backend has no points', async () => {
    api.readings.mockResolvedValue({});
    const { result } = renderHook(() => useReadings('clk-1'), { wrapper: queryWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(api.readings).toHaveBeenCalledWith('clk-1', '24h');
  });
});
