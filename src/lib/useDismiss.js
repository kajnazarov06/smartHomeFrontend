import { useEffect, useRef } from 'react';

/**
 * While `open`, calls `onDismiss(reason)` on a press outside `ref` (`'outside'`) or on Escape (`'escape'`).
 * `touch` also listens to touchstart (for swipe rows on phones).
 */
export function useDismiss(ref, open, onDismiss, { escape = true, touch = false } = {}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;
    const onPress = (e) => !ref.current?.contains(e.target) && dismissRef.current('outside');
    const onKey = (e) => e.key === 'Escape' && dismissRef.current('escape');
    document.addEventListener('mousedown', onPress);
    if (touch) document.addEventListener('touchstart', onPress, { passive: true });
    if (escape) document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('touchstart', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, escape, touch]);
}
