import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const DURATION = { success: 3000, info: 5000, error: 8000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message, { retry, duration } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { id, type, message, retry }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration ?? DURATION[type]));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (msg, opts) => show('success', msg, opts),
      error: (msg, opts) => show('error', msg, opts),
      info: (msg, opts) => show('info', msg, opts),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <span className="toast-icon" aria-hidden="true">
                {t.type === 'success' ? <Check size={14} strokeWidth={3} /> : t.type === 'error' ? <X size={14} strokeWidth={3} /> : <Info size={14} strokeWidth={2.5} />}
              </span>
              <span className="toast-msg">{t.message}</span>
              {t.retry && (
                <button
                  type="button"
                  className="btn btn-text"
                  onClick={() => {
                    dismiss(t.id);
                    t.retry();
                  }}
                >
                  Retry
                </button>
              )}
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
