# Smart Home — web frontend (v1)

React SPA that controls ESP32 bedroom clocks through the Laravel backend in `../smartHome`. The browser talks
**only** to the backend, never to a device. The backend's `../smartHome/CLAUDE.md` is the source of truth for the
API, broadcasts, error codes and device behaviour. Read it before changing anything that calls the API.

```
Browser ──▶ web (nginx :5173) ──/api, /sanctum, /up──▶ backend nginx (nginx:80) ──▶ Laravel
                              └──/app/* (WebSocket)──▶ reverb:8080
```

- Design sources: the "Smart Home App — Frontend Design Brief (v1)" PDF and the Claude Design canvas
  https://claude.ai/artifact/Jv3qv67Kv3AA3QLBSxWka7 (boards: Sign in/up, Dashboard, Device detail, Add device,
  Alarm editor, Settings, States, Components, 390 px checks).
- Language: **JavaScript (JSX), not TypeScript**. Tests: Vitest + React Testing Library (jsdom). No linter yet.

## Running it

Everything runs in Docker (Colima on this machine). The backend stack must be up first. This stack joins its
external network `smarthome_default`.

```bash
cp .env.example .env                    # REVERB_APP_KEY = backend's REVERB_APP_KEY (public value)
docker compose up -d --build            # production build behind nginx → http://localhost:5173
docker compose stop web && docker compose --profile dev up dev   # Vite + HMR on the same port
```

| Command | Purpose |
| --- | --- |
| `docker compose up -d --build` | Rebuild and restart `web` after code changes (prod image) |
| `docker compose logs -f web` | nginx access/error log (proxy problems show here) |
| `make test` | Run the test suite once (`make test-file F=src/pages` for one file/folder, `make test-watch` to watch) |
| `make build` | Compile check without the stack (`npx vite build` in Docker) |
| `make check` | Tests + build |
| `docker run --rm -v "$PWD":/app -w /app node:22-alpine npm install <pkg>` | Add a dependency (keeps `package-lock.json` in sync; the image uses `npm ci`) |

Fake clock for testing without hardware: see `../smartHome/CLAUDE.md` ("Fake clock"). Add it by IP in the
Add device flow; its pairing code is printed in `docker logs fake-clock`.

### Docker / proxy details

- `Dockerfile` stages: `deps` (npm ci) → `dev` (Vite) | `build` → `runtime` (nginx:1.27-alpine).
- `docker/nginx/default.conf.template` is rendered by envsubst (`BACKEND_UPSTREAM`, `REVERB_UPSTREAM`). Upstreams
  are variables with `resolver 127.0.0.11`, so nginx starts even when the backend is down. Keep it that way.
  Use `$http_host` for `Host` so Laravel sees the browser's origin.
- `docker/nginx/40-runtime-env.sh` writes `/env.js` (`window.__ENV__.REVERB_APP_KEY`) at container start, so one
  image works with any key. `public/env.js` is the dev stub. In dev the key comes from `VITE_REVERB_APP_KEY`.
- The Vite dev proxy (`vite.config.js`) mirrors the nginx routes. Targets come from `BACKEND_URL` / `REVERB_URL`
  (defaults: `localhost:8080` / `localhost:8081` for running Vite on the host).
- Ports bind to `127.0.0.1` unless `.env` sets `BIND_ADDR=0.0.0.0` (to test on a phone at
  `http://<mac-ip>:5173`). That origin must also be in the backend's `SANCTUM_STATEFUL_DOMAINS`.

## Auth and same-origin rules (easy to break)

- Sanctum SPA cookie session. Call `GET /sanctum/csrf-cookie` before login/register (done in `api.login` /
  `api.register`). axios sends `X-XSRF-TOKEN` (`withCredentials` + `withXSRFToken`). A 419 refreshes the cookie and
  retries once.
- The app's origin **must** be in the backend's `SANCTUM_STATEFUL_DOMAINS`. Port 5173 already is. A new port →
  add `localhost:<port>` there. Otherwise login answers 400 ("only available from the web UI") or 401.
- Login body is `{login, password, remember}`: `login` is an email **or** username. Register sends `email`,
  `password`, `password_confirmation`.
- `GET /api/auth/status` → `{has_users, registration_open}`. With no users, `/login` redirects to `/register`.
- Any 401 (except calls marked `skipAuthRedirect`) clears `['user']`, and `RequireAuth` sends the user to `/login`.

## Code map (`src/`)

| Path | What |
| --- | --- |
| `api/client.js` | axios instance, `ApiError {status, code, errors, data, retryAfter}`, `describeError()` (maps backend `code`s to user text), connection reporting |
| `api/endpoints.js` | One function per backend route. Unwraps Laravel `{data: …}` |
| `hooks/keys.js` | `qk`: every query key. Never write a key literal elsewhere |
| `hooks/useAuth.js` | `useUser` (`['user']`, null when signed out), `useAuthStatus`, `useLogin`, `useRegister`, `useLogout` |
| `hooks/useDevices.js` | `useDevices`, `useDevice`, rename/settings/remove mutations, `patchDeviceCache`, `storeDevice` |
| `hooks/useAlarms.js` | `useAlarms` → `{alarms, stale}`, optimistic create/update/delete with rollback, `MAX_ALARMS` |
| `hooks/useReadings.js` | `useReadings(id, '24h' \| '7d')` → `[{t, temperature, humidity}]` |
| `hooks/usePairing.js` | Add device: `useScan` (start + poll fallback, `SCAN_TIMEOUT`), `useProbe`, `usePairStart`, `usePairConfirm` |
| `hooks/useRealtime.js` | Echo `private-users.{id}` → writes into the query cache |
| `lib/connection.js` | Store for server reachability (+ `/up` probe while down) and socket state (`useConnection`) |
| `lib/echo.js` | Laravel Echo (Reverb) on the page's own host/port. Private-channel auth via axios to `/api/broadcasting/auth` |
| `lib/format.js` | Clock/date in device tz, `describeDays`, `rssiToBars`, `timeAgo`, countdowns, `describeNextAlarm` |
| `lib/useNow.js` | One shared 1 s ticker for every clock and countdown |
| `lib/useDismiss.js` | Close a menu/popover on outside press or Escape |
| `lib/deviceName.js` | `DEVICE_NAME_MAX`, `deviceNameError()`: the device-name rule |
| `components/ui.jsx` | Button (variants + `loading`), IconButton, Toggle (`role="switch"`), TextField, SelectField, StatusBadge, WifiIndicator, FadeValue, Skeleton, Spinner, Banner (`tone` error/warn/info), BrandName, AuthLogo |
| `components/Modal.jsx` | Modal (bottom sheet < 768 px), SidePanel, ConfirmDialog. Escape, focus trap, focus restore |
| `components/Toast.jsx` | `useToast()` → `success/error/info(msg, {retry})`. Success hides after 3 s. `useToastMutate()` → `run(mutation, vars, {action, success, onSuccess, onError})`: error toast "Couldn't {action} — …" with Retry |
| `components/device.jsx` | ClockDisplay, SensorTile, DeviceCard (+ skeleton, DeviceGridSkeleton), `sensorsOf`, `sensorValue`, `hasCap` |
| `components/HistoryChart.jsx` | Recharts, two Y axes, 24 h / 7 d tabs, empty + skeleton states |
| `components/alarms.jsx` | AlarmRow (+ row menu, swipe to delete), DayPicker (ISO days + presets), TimePicker (24 h, arrows/wheel/typing), SnoozeSelect, `DEFAULT_SNOOZE` |
| `components/PairingCodeInput.jsx` | 6 boxes: auto-advance, backspace, arrows, paste/autofill |
| `components/AppShell.jsx` | TopBar, UserMenu, ConnectionBanner. Mounts `useRealtime` |
| `pages/` | `Auth` (SignIn/SignUp), `Dashboard`, `AddDevice` (nested route modal), `DeviceDetail`, `AlarmEditor`, `DeviceSettings` |
| `styles/global.css` | Design tokens as CSS variables on `:root` + all component classes + breakpoints |

Routes: `/login`, `/register`, `/` (dashboard), `/devices/add` (modal over the dashboard), `/devices/:id`.
Settings and the alarm editor are local state inside Device detail, not routes.

## Conventions

- **Data flow:** every API call goes through TanStack Query hooks in `hooks/`. Components stay presentational
  and get data from hooks. The v2 mobile app is meant to reuse the hooks, so keep UI concerns (toasts,
  navigation) out of them: pass `onSuccess`/`onError` at the `mutate()` call site.
- **Query keys:** `['user']`, `['auth-status']`, `['devices']`, `['device', id]`, `['alarms', id]`,
  `['readings', id, range]`, `['discovery']`. Change a device through `patchDeviceCache`/`storeDevice` so the list
  and detail stay in sync.
- **Live data:** Echo events update the cache (`setQueryData`). Don't refetch on each push. Polling (15 s) only
  runs while the socket isn't `connected`. Event names have a leading dot: `.device.state`, `.device.status`,
  `.discovery.finished`, `.alarm.ringing`.
- **Generic devices:** render from `type` + `capabilities` (`sensorsOf`, `sensorValue`, `hasCap`), never hard-code "clock"
  or a state field name.
- **Mutations with toasts:** use `useToastMutate()` from a component that stays mounted until the request
  settles (TanStack drops `mutate()` callbacks of an unmounted component). That's why the alarm editor hands
  delete to the alarms card via `onDelete`.
- **Errors:** branch on `err.code` (`device_unreachable`, `device_unauthorized`, `device_rejected`,
  `invalid_pairing_code` + `data.attempts_left`, `pairing_locked` + `retryAfter`, `unsupported_device_type`) and on
  422 `err.errors` (`fieldErrors(err)` → `{field: first message}`). Show user text via `describeError()`.
- **Alarms:** offline-first. The backend DB is the source of truth for user changes. A write to an unreachable
  clock answers 202 and stays `sync_status: pending` until the clock is back. Writes are optimistic and roll back
  on error with an error toast + Retry. Alarms stay editable when the device is offline or `meta.stale`. Max 10 alarms. `days` are ISO weekdays
  (1 = Mon), `[]` = one-shot. Time is `"HH:MM"` 24 h.
- **Removing a device:** a 503 `device_unreachable` offers "Remove anyway" (`?force=1`).
- **Device time** is rendered client-side from `useNow()` in the device tz (`state.tz` → `settings.tz`), not
  from `state.time`.

## Design rules (from the brief)

- Dark only. Use the tokens in `global.css` (`--bg #0E1013`, `--surface #171A1F`, `--surface-raised #20242B`,
  `--border #2A2F37`, `--text #E8EAED`, `--text-2 #9AA0A6`, `--accent #4C8DFF`, `--temp #FF9F43`, `--hum #3EC7E0`,
  `--ok`, `--warn`, `--err`). Don't use raw hex in components.
- Inter (bundled via `@fontsource/inter`, works offline on the LAN). Tabular figures (`.num`, `.clock`) for
  every changing number. Clock 40 px on cards, 96 px hero (64 px < 768 px).
- 16 px card radius, 12 px controls, 1 px borders, no heavy shadows. Motion 150–200 ms ease-out. Values fade
  on change (`FadeValue`) with no layout shift. Honour `prefers-reduced-motion`.
- Breakpoints: ≥ 1200 px 3-col grid / detail split; 768–1199 px 2 cols / single column; < 768 px 1 col, modals
  become bottom sheets.
- Icons: lucide-react outline only. Icon-only buttons need `aria-label`.
- Every screen needs its loading (skeleton, no full-page spinners), empty, offline and error states.
- Accessibility: 44 × 44 px targets, WCAG AA contrast, visible focus ring, real `<button>`/`<a>`/`<label>`.

## Known gaps / decisions

- Brief vs backend: pairing is `/api/pairing/start|confirm` (not `/api/devices/pair/*`), and settings go to
  `PUT /devices/{id}/settings`. The backend creates the device on confirm, so Add device step 2 pairs and step 3
  renames (`PATCH /devices/{id}`).
- The room picker from the brief is not built: the backend has no room field.
- `next_alarm` may be `"HH:MM"`, an ISO datetime (what `/api/devices` sends today) or an object. `describeNextAlarm` handles all three. Days are shown
  only when the object carries them.
- The bundle is split into `react`, `charts`, `realtime` chunks (`vite.config.js`). Recharts is the bulk of it.

## Tests

- Config is the `test` block in `vite.config.js`; setup in `src/test/setup.js`. Tests sit next to the code as
  `*.test.js(x)`.
- `src/test/utils.jsx`: `renderWithProviders(ui, {route, path, queryClient})` (QueryClient + MemoryRouter + Toast,
  plus a `data-testid="location"` probe for navigation), `createTestQueryClient()` (no retries, `staleTime:
  Infinity`, so seeded cache data is never refetched), `queryWrapper(qc)` for `renderHook`, `deferred()` for
  optimistic states. `src/test/fixtures.js`: `makeDevice`, `makeAlarm`, `alarmsResponse`, `unreachableError`,
  `validationError`.
- Mock the API with `vi.mock('../api/endpoints')` (automock) and set per-test results with
  `api.x.mockResolvedValue(...)`. Mocks reset between tests (`mockReset`). Set mocks **before** rendering when the
  call happens on mount. Mock `../lib/echo` in anything that mounts `useRealtime`.
- TanStack v5 passes `mutationFn` a second argument: assert hook-bound API calls with `mock.calls[0][0]`, not
  `toHaveBeenCalledWith`.
- `it.fails(...)` marks a known bug. When you fix it, the test starts failing: change it to `it(...)`.

## Before you finish a change

1. `make check` passes: tests are green and `vite build` compiles with no errors.
2. `docker compose up -d --build` and check the screen in a browser at 1440, 768 and 390 px, including its
   loading, empty, offline and error states. Check that the console has no errors.
3. New backend route → add it to `api/endpoints.js` and wrap it in a hook. Don't call axios from components.
4. Backend contract changed → update this file and the hooks, and keep `../smartHome/CLAUDE.md` as the reference.
