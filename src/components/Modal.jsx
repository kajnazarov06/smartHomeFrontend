import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Escape to close, focus moves in on open and back on close, Tab stays inside. */
function useDialog(ref, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
    (first || node)?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (prev && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
    };
  }, [ref]);
}

export function Modal({ title, onClose, children, footer, className = '', labelledBy }) {
  const ref = useRef(null);
  const titleId = useId();
  useDialog(ref, onClose);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId} tabIndex={-1}>
        {title != null && (
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn subtle" aria-label="Close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function SidePanel({ title, onClose, children, footer }) {
  const ref = useRef(null);
  const titleId = useId();
  useDialog(ref, onClose);
  return createPortal(
    <div className="scrim side" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside ref={ref} className="panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="panel-head">
          <h1 id={titleId}>{title}</h1>
          <button type="button" className="icon-btn subtle" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-foot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  icon,
  onConfirm,
  onCancel,
  extraAction,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  useDialog(ref, loading ? undefined : onCancel);
  return createPortal(
    <div className="scrim" style={{ zIndex: 60 }} onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel?.()}>
      <div
        ref={ref}
        className={`modal confirm ${destructive ? 'danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <span className="confirm-icon" aria-hidden="true">
          {icon ?? <AlertTriangle size={22} />}
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          <div id={descId}>{children}</div>
        </div>
        <div className="confirm-actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          {extraAction}
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
