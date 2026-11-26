import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { ApiError, describeError, http, onUnauthorized } from './client';
import { connection } from '../lib/connection';

const originalAdapter = http.defaults.adapter;

/** Fake axios adapter: `routes(config)` returns `[status, data?, headers?]` or throws for a network error. */
function fakeServer(routes) {
  const adapter = vi.fn(async (config) => {
    const [status, data = {}, headers = {}] = routes(config);
    const response = { status, data, headers, config, statusText: '' };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
  });
  http.defaults.adapter = adapter;
  return adapter;
}

let reportServer;
beforeEach(() => {
  // Don't let the real store start its /up probe interval.
  reportServer = vi.spyOn(connection, 'reportServer').mockImplementation(() => {});
});
afterEach(() => {
  http.defaults.adapter = originalAdapter;
  onUnauthorized(() => {});
});

describe('http interceptor', () => {
  it('reports the server up on success', async () => {
    fakeServer(() => [200, { ok: true }]);
    await expect(http.get('/api/x')).resolves.toMatchObject({ data: { ok: true } });
    expect(reportServer).toHaveBeenLastCalledWith(true);
  });

  it('turns a network failure into ApiError network_error and reports the server down', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
    };
    const err = await http.get('/api/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'network_error', message: "Can't reach the local server" });
    expect(reportServer).toHaveBeenLastCalledWith(false);
  });

  it('treats a 502 without a backend code as the server being down', async () => {
    fakeServer(() => [502, '']);
    await http.get('/api/x').catch(() => {});
    expect(reportServer).toHaveBeenLastCalledWith(false);
  });

  it('treats a 503 device error as the server being up', async () => {
    fakeServer(() => [503, { code: 'device_unreachable', message: 'Device unreachable' }]);
    const err = await http.get('/api/x').catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: 'device_unreachable', message: 'Device unreachable' });
    expect(reportServer).toHaveBeenLastCalledWith(true);
  });

  it('maps Laravel validation errors and data', async () => {
    fakeServer(() => [422, { message: 'Invalid', errors: { name: ['Too long'] }, attempts_left: 2 }]);
    const err = await http.post('/api/x').catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.errors).toEqual({ name: ['Too long'] });
    expect(err.data.attempts_left).toBe(2);
  });

  it('reads retryAfter from the body first, then the Retry-After header', async () => {
    fakeServer(() => [429, { code: 'pairing_locked', retry_after: 120 }, { 'retry-after': '30' }]);
    expect((await http.post('/api/x').catch((e) => e)).retryAfter).toBe(120);

    fakeServer(() => [429, {}, { 'retry-after': '30' }]);
    expect((await http.post('/api/x').catch((e) => e)).retryAfter).toBe(30);

    fakeServer(() => [429, {}]);
    expect((await http.post('/api/x').catch((e) => e)).retryAfter).toBeUndefined();
  });

  it.each([
    [404, 'Not found'],
    [429, 'Too many attempts'],
    [500, 'The server had a problem'],
    [400, 'Something went wrong'],
  ])('uses a default message for %i without one', async (status, message) => {
    fakeServer(() => [status, {}]);
    expect((await http.get('/api/x').catch((e) => e)).message).toBe(message);
  });

  it('refreshes the CSRF cookie and retries once on 419', async () => {
    let calls = 0;
    const adapter = fakeServer((config) => {
      if (config.url === '/sanctum/csrf-cookie') return [204];
      calls += 1;
      return calls === 1 ? [419] : [200, { ok: true }];
    });
    await expect(http.post('/api/x')).resolves.toMatchObject({ data: { ok: true } });
    expect(adapter.mock.calls.map(([c]) => c.url)).toEqual(['/api/x', '/sanctum/csrf-cookie', '/api/x']);
  });

  it('gives up after one 419 retry', async () => {
    const adapter = fakeServer((config) => (config.url === '/sanctum/csrf-cookie' ? [204] : [419]));
    const err = await http.post('/api/x').catch((e) => e);
    expect(err.status).toBe(419);
    expect(adapter).toHaveBeenCalledTimes(3);
  });

  it('calls the unauthorized handler on 401 unless skipAuthRedirect is set', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    fakeServer(() => [401, {}]);

    await http.get('/api/user', { skipAuthRedirect: true }).catch(() => {});
    expect(handler).not.toHaveBeenCalled();

    await http.get('/api/devices').catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('describeError', () => {
  const err = (code, message) => new ApiError({ code, message, status: 500 });

  it.each([
    ['network_error', "Can't reach the local server"],
    ['device_unreachable', "Clock didn't respond"],
    ['device_unauthorized', 'Clock rejected the app — pair it again'],
    ['unsupported_device_type', 'This device type is not supported'],
    ['pairing_locked', 'Too many attempts'],
  ])('%s → %s', (code, text) => {
    expect(describeError(err(code, 'server text'))).toBe(text);
  });

  it('uses the server message for device_rejected, with a fallback', () => {
    expect(describeError(err('device_rejected', 'Brightness out of range'))).toBe('Brightness out of range');
    expect(describeError(err('device_rejected', ''))).toBe('Clock rejected the change');
  });

  it('falls back to the message, then the fallback text', () => {
    expect(describeError(err(undefined, 'Boom'))).toBe('Boom');
    expect(describeError(err(undefined, ''), 'Nope')).toBe('Nope');
    expect(describeError(null, 'Nope')).toBe('Nope');
    expect(describeError(undefined)).toBe('Something went wrong');
  });
});
