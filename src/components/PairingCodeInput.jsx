import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Six digit boxes: auto-advance, backspace goes back, arrow keys move, paste fills all.
 * Calls onComplete(code) once all six are filled.
 */
export const PairingCodeInput = forwardRef(function PairingCodeInput(
  { value, onChange, onComplete, error = false, disabled = false, shake = false },
  ref,
) {
  const inputs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  useImperativeHandle(ref, () => ({ focus: (i = 0) => inputs.current[i]?.focus() }));

  const commit = (next) => {
    const code = next.join('').slice(0, 6);
    onChange(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) onComplete?.(code);
  };

  const setAt = (i, d) => {
    const next = [...digits];
    next[i] = d;
    // keep it contiguous: drop anything after an empty box
    const firstEmpty = next.findIndex((x) => !x);
    commit(firstEmpty === -1 ? next : next.slice(0, firstEmpty));
  };

  const fill = (text, from = 0) => {
    const clean = text.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits.slice(0, from), ...clean.split('')].slice(0, 6);
    commit(next);
    inputs.current[Math.min(next.length, 5)]?.focus();
  };

  return (
    <div className={`pins ${shake ? 'shake' : ''}`} role="group" aria-label="Pairing code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className={`pin ${d ? 'filled' : ''} ${error ? 'err' : ''}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={error || undefined}
          value={d}
          disabled={disabled}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) return fill(v, i); // autofill / mobile paste
            const target = Math.min(i, digits.findIndex((x) => !x) === -1 ? 5 : digits.findIndex((x) => !x));
            setAt(target, v);
            if (v) inputs.current[Math.min(target + 1, 5)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              e.preventDefault();
              setAt(i - 1, '');
              inputs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowLeft' && i > 0) {
              e.preventDefault();
              inputs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < 5) {
              e.preventDefault();
              inputs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData('text'), 0);
          }}
        />
      ))}
    </div>
  );
});
