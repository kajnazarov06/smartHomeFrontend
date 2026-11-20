# Smart Home — web frontend

React + Vite SPA for the Smart Home v1 backend (`../smartHome`). Dark UI from the Frontend Design Brief v1
and the Claude Design canvas. Stack: React Router, TanStack Query, Laravel Echo (Reverb), Recharts, lucide icons.

## Run (Docker)

The backend stack must be running first (`cd ../smartHome && docker compose up -d`). This stack joins its
`smarthome_default` network.

```bash
cp .env.example .env     # REVERB_APP_KEY = the backend's REVERB_APP_KEY
docker compose up -d --build
```

Open http://localhost:5173.

The `web` container serves the built app with nginx. It also proxies `/api`, `/sanctum` and `/up` to the backend
nginx and `/app/*` to Reverb, so the browser sees a single origin. Sanctum cookies and CSRF need that.

**Dev server with hot reload:**

```bash
docker compose stop web
docker compose --profile dev up dev
```

Port 5173 is already in the backend's `SANCTUM_STATEFUL_DOMAINS`. If you change `WEB_PORT` or `DEV_PORT`,
add `localhost:<port>` there too.

## Layout

| Path | What |
| --- | --- |
| `src/api/` | axios client (Sanctum, XSRF, 419 retry, error codes) and endpoint functions |
| `src/hooks/` | `useDevices`, `useDevice`, `useAlarms` (optimistic), `useReadings`, `useRealtime` (Echo → query cache), `useAuth` |
| `src/lib/` | connection store (server/socket status), Echo setup, formatting, shared ticking clock |
| `src/components/` | presentational components: DeviceCard, ClockDisplay, SensorTile, WifiIndicator, HistoryChart, AlarmRow, DayPicker, TimePicker, PairingCodeInput, Modal/SidePanel/ConfirmDialog, Toasts, app shell |
| `src/pages/` | Sign in/up, Dashboard, Add device stepper, Device detail, Alarm editor, Device settings |
| `docker/nginx/` | nginx template (lazy upstream DNS) and runtime `env.js` writer |
