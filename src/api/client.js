import axios from 'axios';
import { connection } from '../lib/connection';

// Same-origin Sanctum SPA session: cookies + X-XSRF-TOKEN (axios reads the XSRF-TOKEN cookie).
export const http = axios.create({
  baseURL: '/',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  timeout: 15000,
});

let unauthorizedHandler = () => {};
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

export function csrfCookie() {
  return http.get('/sanctum/csrf-cookie');
}

http.interceptors.response.use(
  (res) => {
    connection.reportServer(true);
    return res;
  },
  async (error) => {
    const status = error.response?.status;
    const config = error.config ?? {};

    // No response, or the proxy answered for a backend that is down.
    if (!error.response || [502, 504].includes(status) && !error.response.data?.code) {
      connection.reportServer(false);
    } else {
      connection.reportServer(true);
    }

    // CSRF token expired: fetch a fresh cookie and retry once.
    if (status === 419 && !config._csrfRetried) {
      config._csrfRetried = true;
      await csrfCookie();
      return http(config);
    }

    if (status === 401 && !config.skipAuthRedirect) {
      unauthorizedHandler();
    }

    return Promise.reject(toApiError(error));
  },
);

export class ApiError extends Error {
  constructor({ message, status, code, errors, data, retryAfter }) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors ?? {};
    this.data = data ?? {};
    this.retryAfter = retryAfter;
  }
}

function toApiError(error) {
  if (!error.response) {
    return new ApiError({
      message: "Can't reach the local server",
      status: 0,
      code: 'network_error',
    });
  }
  const { status, data = {}, headers = {} } = error.response;
  const retryHeader = Number(headers['retry-after']);
  return new ApiError({
    message: data.message || defaultMessage(status),
    status,
    code: data.code,
    errors: data.errors,
    data,
    retryAfter: data.retry_after ?? (Number.isFinite(retryHeader) ? retryHeader : undefined),
  });
}

function defaultMessage(status) {
  if (status === 404) return 'Not found';
  if (status === 429) return 'Too many attempts';
  if (status >= 500) return 'The server had a problem';
  return 'Something went wrong';
}

/** Laravel 422 `errors` → `{field: first message}`; `{}` for any other error. */
export function fieldErrors(err) {
  return Object.fromEntries(Object.entries(err?.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/** Human message for a device/backend error, tuned for the codes the backend returns. */
export function describeError(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  switch (err.code) {
    case 'network_error':
      return "Can't reach the local server";
    case 'device_unreachable':
      return "Clock didn't respond";
    case 'device_unauthorized':
      return 'Clock rejected the app — pair it again';
    case 'device_rejected':
      return err.message || 'Clock rejected the change';
    case 'unsupported_device_type':
      return 'This device type is not supported';
    case 'pairing_locked':
      return 'Too many attempts';
    default:
      return err.message || fallback;
  }
}
