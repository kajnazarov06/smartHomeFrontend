import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server: same origin for the browser. /api, /sanctum, /up go to the backend nginx,
// /app (Reverb WebSocket) goes to the Reverb container. Inside Docker the targets are the
// backend's service names on the shared `smarthome_default` network.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const backend = env.BACKEND_URL || 'http://localhost:8080';
  const reverb = env.REVERB_URL || 'http://localhost:8081';

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
      mockReset: true,
      restoreMocks: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            charts: ['recharts'],
            realtime: ['laravel-echo', 'pusher-js', 'axios'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: { usePolling: env.CHOKIDAR_USEPOLLING === 'true' },
      proxy: {
        '^/(api|sanctum|up)(/|$)': { target: backend, changeOrigin: false, xfwd: true },
        '^/app/': { target: reverb, ws: true, changeOrigin: true },
      },
    },
  };
});
