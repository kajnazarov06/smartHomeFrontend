import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';

/** No retries, no GC timers; seeded data stays fresh so tests control every fetch. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Renders the current pathname so tests can assert navigation. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Renders `ui` at `route` (string or `{pathname, state}`) under `path`, inside
 * QueryClient + Router + Toast providers — the same stack as main.jsx.
 */
export function renderWithProviders(ui, { route = '/', path = '/', queryClient = createTestQueryClient() } = {}) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={null} />
          </Routes>
          <LocationProbe />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** Wrapper for renderHook. */
export function queryWrapper(queryClient) {
  return function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** A promise you resolve/reject from the test, to observe optimistic states. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
