import { useRef, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useLogout, useUser } from '../hooks/useAuth';
import { useRealtime } from '../hooks/useRealtime';
import { qk } from '../hooks/keys';
import { useConnection } from '../lib/connection';
import { useDismiss } from '../lib/useDismiss';
import { useToast } from './Toast';
import { BrandName, Spinner } from './ui';

export function AppShell() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const toast = useToast();

  useRealtime(user?.id, {
    onAlarmRinging: ({ device_id }) => {
      const name = qc.getQueryData(qk.devices)?.find((d) => d.id === device_id)?.name ?? 'Your clock';
      toast.info(`${name}: alarm ringing`);
    },
  });

  // Device detail has its own app bar on phones (back · name · settings), so the global bar steps aside there.
  const detail = useMatch('/devices/:id');
  const ownBar = !!detail && detail.params.id !== 'add';

  return (
    <>
      <TopBar user={user} hideOnPhone={ownBar} />
      <ConnectionBanner flush={ownBar} />
      <Outlet />
    </>
  );
}

function TopBar({ user, hideOnPhone }) {
  return (
    <header className={`topbar ${hideOnPhone ? 'hide-m' : ''}`}>
      <div className="container">
        <Link to="/" className="brand">
          <BrandName />
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

  useDismiss(ref, open, (reason) => {
    setOpen(false);
    if (reason === 'escape') ref.current?.querySelector('button')?.focus();
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="usermenu-btn"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar">
          <User size={16} aria-hidden="true" />
        </span>
        <span className="who">Account</span>
        <ChevronDown className="chev" size={16} color="var(--text-2)" aria-hidden="true" />
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

export function ConnectionBanner({ flush = false }) {
  const { server } = useConnection();
  if (server) return null;
  return (
    <div className={`conn-banner ${flush ? 'flush-m' : ''}`} role="alert">
      <Spinner />
      Can&apos;t reach the local server. Reconnecting…
    </div>
  );
}
