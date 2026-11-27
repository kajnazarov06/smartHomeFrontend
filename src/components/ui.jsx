import { forwardRef, useId } from 'react';
import { AlertCircle, AlertTriangle, Clock3 } from 'lucide-react';

export function Spinner({ className = '' }) {
  return <span className={`spinner ${className}`} aria-hidden="true" />;
}

/** variant: primary | secondary | text | danger | danger-outline | danger-text */
export const Button = forwardRef(function Button(
  { variant = 'secondary', loading = false, block = false, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ label, subtle, className = '', children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={`icon-btn ${subtle ? 'subtle' : ''} ${className}`} aria-label={label} {...rest}>
      {children}
    </button>
  );
});

export function Toggle({ checked, onChange, label, disabled, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      {...rest}
    />
  );
}

export const TextField = forwardRef(function TextField({ label, error, hint, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input ${error ? 'err' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <span id={`${inputId}-err`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
});

export function SelectField({ label, children, id, ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className="field">
      <label htmlFor={selectId} className="label">
        {label}
      </label>
      <select id={selectId} className="select" {...rest}>
        {children}
      </select>
    </div>
  );
}

/** status: online | offline | pairing | error */
export function StatusBadge({ status, children }) {
  const text = children ?? { online: 'Online', offline: 'Offline', pairing: 'Pairing', error: 'Error' }[status];
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {text}
    </span>
  );
}

/** 0–4 bars; 1 bar or less shows in the warning colour. */
export function WifiIndicator({ bars = 0, offline = false }) {
  const weak = !offline && bars <= 1 && bars > 0;
  const on = weak ? 'var(--warn)' : 'var(--text)';
  const off = 'var(--muted-fill)';
  const label = offline || bars === 0 ? 'No Wi-Fi signal' : `${weak ? 'Weak Wi-Fi, ' : 'Wi-Fi '}${bars} of 4 bars`;
  const shown = offline ? 0 : bars;
  const rects = [
    [0, 11, 5],
    [5, 7.5, 8.5],
    [10, 4, 12],
    [15, 0, 16],
  ];
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" role="img" aria-label={label} style={{ flex: 'none' }}>
      <title>{label}</title>
      {rects.map(([x, y, h], i) => (
        <rect key={x} x={x} y={y} width="3" height={h} rx="1" fill={i < shown ? on : off} />
      ))}
    </svg>
  );
}

/** Re-runs a short fade whenever the value changes (live updates, no layout shift). */
export function FadeValue({ value, className = '', ...rest }) {
  return (
    <span key={String(value)} className={`fade-value ${className}`} {...rest}>
      {value}
    </span>
  );
}

export function Skeleton({ width, height, radius, style, className = '' }) {
  return <div className={`sk ${className}`} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function LogoMark({ size = 18, strokeWidth = 2 }) {
  return <Clock3 size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}

/** Logo + "Smart Home" for the top bar; wrap it in a Link or a span with class `brand`. */
export function BrandName() {
  return (
    <>
      <span className="brand-mark">
        <LogoMark />
      </span>
      Smart Home
    </>
  );
}

/** Large logo above the sign-in / sign-up / boot-error cards. */
export function AuthLogo() {
  return (
    <div className="auth-logo">
      <span className="mark">
        <LogoMark size={30} strokeWidth={1.75} />
      </span>
      <div className="t">Smart Home</div>
    </div>
  );
}

const BANNER_ICON = { error: AlertCircle, warn: AlertTriangle };

/** tone: error | warn | info. Error and warn are announced (role="alert"). */
export function Banner({ tone = 'error', children }) {
  const Icon = BANNER_ICON[tone];
  return (
    <div className={`banner banner-${tone}`} role={Icon ? 'alert' : undefined}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}
