import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/global.css';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { onUnauthorized } from './api/client';
import { disconnectEcho } from './lib/echo';
import { qk } from './hooks/keys';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Don't hammer the backend on 4xx; retry network blips.
      retry: (count, err) => (err?.status === 0 || err?.status >= 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

// Session expired anywhere → back to sign-in.
onUnauthorized(() => {
  disconnectEcho();
  queryClient.setQueryData(qk.user, null);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
