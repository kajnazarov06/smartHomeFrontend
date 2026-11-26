import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PairingCodeInput } from './PairingCodeInput';

function Harness({ onComplete }) {
  const [code, setCode] = useState('');
  return (
    <>
      <PairingCodeInput value={code} onChange={setCode} onComplete={onComplete} />
      <output>{code}</output>
    </>
  );
}

const box = (n) => screen.getByRole('textbox', { name: `Digit ${n}` });

describe('PairingCodeInput', () => {
  it('auto-advances and completes after six digits', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('123456');
    expect(screen.getByRole('status')).toHaveTextContent('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('ignores letters', async () => {
    render(<Harness />);
    await userEvent.click(box(1));
    await userEvent.keyboard('a1b');
    expect(screen.getByRole('status')).toHaveTextContent(/^1$/);
    expect(box(2)).toHaveFocus();
  });

  it('pastes a formatted code into all boxes', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.paste('12-34 56');
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(box(6)).toHaveValue('6');
  });

  it('backspace on an empty box clears the previous one', async () => {
    render(<Harness />);
    await userEvent.click(box(1));
    await userEvent.keyboard('12');
    expect(box(3)).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('status')).toHaveTextContent(/^1$/);
    expect(box(2)).toHaveFocus();
  });

  it('moves with arrow keys', async () => {
    render(<Harness />);
    await userEvent.click(box(3));
    await userEvent.keyboard('{ArrowLeft}');
    expect(box(2)).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(box(4)).toHaveFocus();
  });
});
