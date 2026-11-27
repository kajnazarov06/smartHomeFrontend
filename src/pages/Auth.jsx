import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStatus, useLogin, useRegister, useUser } from '../hooks/useAuth';
import { describeError, fieldErrors as toFieldErrors } from '../api/client';
import { AuthLogo, Banner, Button, TextField } from '../components/ui';
import { ConnectionBanner } from '../components/AppShell';

function AuthLayout({ children }) {
  return (
    <>
      <ConnectionBanner />
      <main className="auth">
        <AuthLogo />
        {children}
      </main>
    </>
  );
}

export function SignIn() {
  const { data: user } = useUser();
  const { data: status } = useAuthStatus();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState(null);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;
  // First launch: nobody has an account yet.
  if (status && !status.has_users && status.registration_open) return <Navigate to="/register" replace />;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.login.trim()) errs.login = 'Enter your email or username.';
    if (!form.password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    setBanner(null);
    if (Object.keys(errs).length) return;

    login.mutate(
      { login: form.login.trim(), password: form.password, remember: true },
      {
        onSuccess: () => navigate(location.state?.from || '/', { replace: true }),
        onError: (err) => {
          if (err.status === 422 || err.status === 429) {
            const errs = toFieldErrors(err);
            const msg = errs.login;
            if (err.status === 429) setBanner(msg || 'Too many attempts. Wait a minute and try again.');
            else if (msg) setBanner('Email or password is incorrect. Check them and try again.');
            else setFieldErrors(errs);
          } else {
            setBanner(describeError(err, "Couldn't sign in"));
          }
        },
      },
    );
  };

  return (
    <AuthLayout>
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div>
          <h1>Sign in</h1>
          <p className="sub">Control your clocks on this network.</p>
        </div>
        {banner && <Banner>{banner}</Banner>}
        <TextField
          label="Email or username"
          autoComplete="username"
          value={form.login}
          onChange={(e) => setForm({ ...form, login: e.target.value })}
          error={fieldErrors.login}
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={fieldErrors.password}
        />
        <Button type="submit" variant="primary" block loading={login.isPending}>
          Sign in
        </Button>
        {status?.registration_open !== false && (
          <p className="auth-alt">
            New here? <Link to="/register">Create account</Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUp() {
  const { data: user } = useUser();
  const { data: status } = useAuthStatus();
  const register = useRegister();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);

  if (user) return <Navigate to="/" replace />;

  const closed = status && !status.registration_open;
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (form.password.length < 8) errs.password = 'Use at least 8 characters.';
    if (form.password_confirmation !== form.password) errs.password_confirmation = "Passwords don't match.";
    setErrors(errs);
    setBanner(null);
    if (Object.keys(errs).length) return;

    register.mutate(
      { email: form.email.trim(), password: form.password, password_confirmation: form.password_confirmation },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: (err) => {
          if (err.status === 422) {
            setErrors(toFieldErrors(err));
          } else {
            setBanner(describeError(err, "Couldn't create the account"));
          }
        },
      },
    );
  };

  return (
    <AuthLayout>
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div>
          <h1>Create account</h1>
          <p className="sub">
            {status && !status.has_users
              ? 'Set up the first account for this home.'
              : 'One account for every clock in your home.'}
          </p>
        </div>
        {closed && <Banner>Registration is closed. Ask the owner of this app to sign you in.</Banner>}
        {banner && <Banner>{banner}</Banner>}
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} autoFocus />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters."
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.password_confirmation}
          onChange={set('password_confirmation')}
          error={errors.password_confirmation}
        />
        <Button type="submit" variant="primary" block loading={register.isPending} disabled={closed}>
          Create account
        </Button>
        {status?.has_users !== false && (
          <p className="auth-alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
