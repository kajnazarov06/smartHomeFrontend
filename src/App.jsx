import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useUser } from './hooks/useAuth';
import { AppShell } from './components/AppShell';
import { DeviceCardSkeleton } from './components/device';
import { Button, LogoMark } from './components/ui';
import { describeError } from './api/client';
import { SignIn, SignUp } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { AddDevice } from './pages/AddDevice';
import { DeviceDetail } from './pages/DeviceDetail';

function RequireAuth() {
  const { data: user, isPending, isError, error, refetch } = useUser();
  const location = useLocation();

  if (isPending) return <BootSkeleton />;
  if (isError) {
    return (
      <main className="auth">
        <div className="auth-logo">
          <span className="mark">
            <LogoMark size={30} strokeWidth={1.75} />
          </span>
          <div className="t">Smart Home</div>
        </div>
        <div className="card empty" style={{ maxWidth: 400, width: '100%' }}>
          <div>
            <div className="empty-title">Can&apos;t reach the local server</div>
            <div className="empty-text">{describeError(error)}. Check that the Smart Home backend is running.</div>
          </div>
          <Button variant="primary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function BootSkeleton() {
  return (
    <>
      <header className="topbar">
        <div className="container">
          <span className="brand">
            <span className="brand-mark">
              <LogoMark />
            </span>
            Smart Home
          </span>
        </div>
      </header>
      <main className="container page" aria-busy="true">
        <div className="page-head">
          <h1 className="page-title">My devices</h1>
        </div>
        <div className="grid">
          <DeviceCardSkeleton />
          <DeviceCardSkeleton />
          <DeviceCardSkeleton />
        </div>
      </main>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<SignIn />} />
      <Route path="/register" element={<SignUp />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />}>
            <Route path="devices/add" element={<AddDevice />} />
          </Route>
          <Route path="/devices/:id" element={<DeviceDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
