import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useLogout, useUser } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { useConnection } from '../lib/connection';
import { useToast } from './Toast';
import { LogoMark } from './ui';

export function AppShell() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const toast = useToast();

  useRealtime(user?.id, {
    onAlarmRinging: ({ device_id }) => {
      const name = qc.getQueryData(['devices'])?.find((d) => d.id === device_id)?.name ?? 'Your clock';
      toast.info(`${name}: alarm ringing`);
    },
  });

  return (
    <>
      <TopBar user={user} />
      <ConnectionBanner />
      <Outlet />
    </>
  );
}

function TopBar({ user }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <LogoMark />
          </span>
          Smart Home
        </Link>
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}

function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const logout = useLogout();
  const navigate = useNavigate();
  const who = user.email || user.username || 'Account';

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="usermenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar">
          <User size={16} aria-hidden="true" />
        </span>
        <span className="who">Account</span>
        <ChevronDown size={16} color="var(--text-2)" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <span className="muted">Signed in as</span>
            <strong title={who}>{who}</strong>
          </div>
          <button
            type="button"
            role="menuitem"
            className="menuitem"
            autoFocus
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => navigate('/login', { replace: true }),
              })
            }
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function ConnectionBanner() {
  const { server } = useConnection();
  if (server) return null;
  return (
    <div className="conn-banner" role="alert">
      <span className="spinner" aria-hidden="true" />
      Can&apos;t reach the local server. Reconnecting…
    </div>
  );
}
