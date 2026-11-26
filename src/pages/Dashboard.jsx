import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import { DeviceCard, DeviceCardSkeleton } from '../components/device';
import { Button } from '../components/ui';
import { describeError } from '../api/client';

export function Dashboard() {
  const { data: devices, isPending, isError, error, refetch } = useDevices();
  const location = useLocation();
  const navigate = useNavigate();
  const [highlight, setHighlight] = useState(location.state?.highlight ?? null);

  // A just-added device stays highlighted for a few seconds.
  useEffect(() => {
    if (location.state?.highlight) {
      setHighlight(location.state.highlight);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);
  useEffect(() => {
    if (!highlight) return undefined;
    const t = setTimeout(() => setHighlight(null), 8000);
    return () => clearTimeout(t);
  }, [highlight]);

  const online = devices?.filter((d) => d.online).length ?? 0;
  const noun = (n) => (n === 1 ? 'device' : 'devices');

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <h1 className="page-title">My devices</h1>
          {devices && devices.length > 0 && (
            <p className="page-sub">
              {devices.length} {noun(devices.length)} · {online} online
            </p>
          )}
        </div>
        {(!devices || devices.length > 0) && (
          <Link to="/devices/add" className="btn btn-primary add-btn">
            <Plus size={18} aria-hidden="true" />
            <span className="add-btn-label">Add device</span>
          </Link>
        )}
      </div>

      {isPending ? (
        <div className="grid" aria-busy="true">
          <DeviceCardSkeleton />
          <DeviceCardSkeleton />
          <DeviceCardSkeleton />
        </div>
      ) : isError && !devices ? (
        <div className="card empty">
          <div>
            <div className="empty-title">Couldn&apos;t load your devices</div>
            <div className="empty-text">{describeError(error)}</div>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <div className="grid">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} highlighted={d.id === highlight} />
          ))}
        </div>
      )}

      <Outlet />
    </main>
  );
}

function EmptyDashboard() {
  return (
    <div className="card empty" style={{ padding: '72px 24px' }}>
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
        <circle cx="48" cy="50" r="34" stroke="var(--muted-fill)" strokeWidth="2.5" />
        <circle cx="48" cy="50" r="27" stroke="var(--border)" strokeWidth="1.5" />
        <path d="M48 32v18l11 7" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 18 14 26M74 18l8 8" stroke="var(--muted-fill)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="48" cy="50" r="3" fill="var(--accent)" />
      </svg>
      <div>
        <div className="empty-title">No devices yet</div>
        <div className="empty-text">Add a clock on your home Wi-Fi to see it here.</div>
      </div>
      <Link to="/devices/add" className="btn btn-primary">
        <Plus size={18} aria-hidden="true" />
        Add your first device
      </Link>
    </div>
  );
}
