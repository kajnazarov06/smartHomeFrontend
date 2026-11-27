import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock3, Radar, TimerOff } from 'lucide-react';
import { describeError } from '../api/client';
import { useRenameDevice } from '../hooks/useDevices';
import { SCAN_TIMEOUT, usePairConfirm, usePairStart, useProbe, useScan } from '../hooks/usePairing';
import { useNow } from '../lib/useNow';
import { formatCountdown } from '../lib/format';
import { DEVICE_NAME_MAX, deviceNameError } from '../lib/deviceName';
import { Modal } from '../components/Modal';
import { Banner, Button, Spinner, TextField } from '../components/ui';
import { PairingCodeInput } from '../components/PairingCodeInput';
import { useToast } from '../components/Toast';

const STEPS = ['Find', 'Pair', 'Name'];

export function AddDevice() {
  const navigate = useNavigate();
  const { mutateAsync: pairStart } = usePairStart();
  const [step, setStep] = useState('find'); // find | pair | name | done
  const [target, setTarget] = useState(null); // { host, name, id }
  const [pairing, setPairing] = useState(null); // { expiresAt, lockedUntil }
  const [starting, setStarting] = useState(null); // host being contacted
  const [findError, setFindError] = useState(null);
  const [device, setDevice] = useState(null);

  const close = () => navigate('/', { state: device ? { highlight: device.id } : undefined });

  const startPairing = useCallback(
    async (t) => {
      setStarting(t.host);
      setFindError(null);
      try {
        const res = await pairStart(t.host);
        setTarget(t);
        setPairing({ expiresAt: Date.now() + (res.expires_in ?? 120) * 1000, lockedUntil: null });
        setStep('pair');
      } catch (err) {
        if (err.code === 'pairing_locked') {
          setTarget(t);
          setPairing({ expiresAt: null, lockedUntil: Date.now() + (err.retryAfter ?? 300) * 1000 });
          setStep('pair');
        } else {
          setFindError(`${t.name || t.host}: ${describeError(err, "Couldn't start pairing")}`);
        }
      } finally {
        setStarting(null);
      }
    },
    [pairStart],
  );

  const stepIndex = { find: 0, pair: 1, name: 2, done: 3 }[step];

  return (
    <Modal title="Add device" onClose={close} className="sheet-full">
      {step !== 'done' && <Stepper current={stepIndex} />}
      <div className="modal-body" style={{ paddingTop: 28 }}>
        {step === 'find' && <FindStep onPick={startPairing} starting={starting} error={findError} setError={setFindError} />}
        {step === 'pair' && (
          <PairStep
            target={target}
            pairing={pairing}
            setPairing={setPairing}
            onRestart={() => startPairing(target)}
            restarting={!!starting}
            onBack={() => setStep('find')}
            onPaired={(d) => {
              setDevice(d);
              setStep('name');
            }}
          />
        )}
        {step === 'name' && device && (
          <NameStep
            device={device}
            onDone={(d) => {
              setDevice(d);
              setStep('done');
            }}
          />
        )}
        {step === 'done' && device && (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '16px 0 4px' }}>
            <span className="success-mark">
              <Check size={36} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div>
              <h2 className="step-title">{device.name} is ready</h2>
              <p className="step-text">It now shows on your dashboard.</p>
            </div>
            <Button variant="primary" block onClick={close} data-autofocus style={{ marginTop: 8 }}>
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stepper({ current }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : '';
        return (
          <li key={label} className={i < STEPS.length - 1 ? 'grow' : ''} aria-current={i === current ? 'step' : undefined}>
            <span className={`step-dot ${state}`}>{i < current ? <Check size={14} strokeWidth={3} aria-label="done" /> : i + 1}</span>
            <span className={`step-label ${i === current ? 'current' : ''}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`step-line ${i < current ? 'done' : ''}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Step 1: Find ---------------- */

function FindStep({ onPick, starting, error, setError }) {
  const now = useNow();
  const { start, startedAt, finished, found } = useScan();
  const [showIp, setShowIp] = useState(false);

  const scan = useCallback(async () => {
    setError(null);
    try {
      await start();
    } catch (err) {
      if (err.status !== 429) setError(describeError(err, "Couldn't start a scan"));
    }
  }, [setError, start]);

  // Scan once on open.
  useEffect(() => {
    scan();
  }, [scan]);

  const scanning = !!startedAt && !finished && now - startedAt < SCAN_TIMEOUT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 className="step-title">Find your clock</h2>
        <p className="step-text">Make sure your clock is connected to your home Wi-Fi.</p>
      </div>

      {error && <Banner>{error}</Banner>}

      <ScanResults
        scanning={scanning}
        found={found}
        starting={starting}
        onPick={onPick}
        onScan={scan}
        onAddByIp={() => setShowIp(true)}
      />

      <div className="more-links">
        <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} aria-expanded={showIp} onClick={() => setShowIp((v) => !v)}>
          Add by IP address
        </button>
        {showIp && <AddByIpForm onPick={onPick} starting={starting} />}
        <WifiHelp />
      </div>
    </div>
  );
}

function ScanResults({ scanning, found, starting, onPick, onScan, onAddByIp }) {
  if (scanning && found.length === 0) {
    return (
      <div className="scan" role="status">
        <div className="scan-rings">
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <span className="scan-core">
            <Radar size={26} aria-hidden="true" />
          </span>
        </div>
        <span className="muted" style={{ fontSize: 14 }}>
          Looking for clocks on this network…
        </span>
      </div>
    );
  }

  if (found.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600 }}>No clocks found on this network</h3>
        <ul className="tips">
          <li>Is your computer on the same Wi-Fi as the clock?</li>
          <li>Does the clock show the connected icon?</li>
          <li>Restart the clock and wait 30 seconds.</li>
        </ul>
        <div className="step-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={onScan}>
            Scan again
          </Button>
          <Button variant="secondary" onClick={onAddByIp}>
            Add by IP
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="label" role="status">
          {found.length} {found.length === 1 ? 'clock' : 'clocks'} found
        </span>
        <button type="button" className="linkbtn" onClick={onScan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan again'}
        </button>
      </div>
      <ul className="found-list">
        {found.map((f) => (
          <li key={f.id}>
            <span className="found-icon">
              <Clock3 size={20} aria-hidden="true" />
            </span>
            <span className="found-meta">
              <span className="n">{f.name || f.hostname || 'Clock'}</span>
              <span className="s num">
                ID {f.id} · {f.host}
              </span>
            </span>
            {f.supported === false ? (
              <span className="muted" style={{ fontSize: 13 }}>
                Not supported
              </span>
            ) : (
              <Button
                variant="secondary"
                style={{ minHeight: 40 }}
                onClick={() => onPick({ host: f.host, name: f.name, id: f.id })}
                loading={starting === f.host}
                disabled={!!starting}
                aria-label={`Add ${f.name || 'clock'} ${f.id}`}
              >
                Add
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function probeErrorText(err, host) {
  if (err.status === 422 && err.errors?.host) return 'Use a local address, like 192.168.1.57 or clock-a1b2.local.';
  if (err.code === 'device_unreachable' || err.code === 'device_not_found') return `No clock answered at ${host}.`;
  return describeError(err);
}

function AddByIpForm({ onPick, starting }) {
  const probe = useProbe();
  const [ip, setIp] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const host = ip.trim();
    if (!host) {
      setError('Enter the clock’s IP address.');
      return;
    }
    setError(null);
    try {
      const info = await probe.mutateAsync(host);
      if (info.paired_here) setError(`${info.name || 'This clock'} is already in your devices.`);
      else if (info.supported === false) setError(`This device (${info.type}) is not supported.`);
      else onPick({ host: info.host || host, name: info.name, id: info.id });
    } catch (err) {
      setError(probeErrorText(err, host));
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }} noValidate>
      <div style={{ display: 'flex', gap: 8 }}>
        <label htmlFor="ad-ip" className="sr-only">
          IP address
        </label>
        <input
          id="ad-ip"
          className={`input num ${error ? 'err' : ''}`}
          placeholder="192.168.1.57"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'ad-ip-err' : undefined}
        />
        <Button type="submit" variant="secondary" loading={probe.isPending || (!!starting && starting === ip.trim())}>
          Connect
        </Button>
      </div>
      {error && (
        <span id="ad-ip-err" className="field-error">
          {error}
        </span>
      )}
    </form>
  );
}

function WifiHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkbtn quiet" style={{ alignSelf: 'flex-start' }} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Clock not connected to Wi-Fi yet?
      </button>
      {open && (
        <ol className="help-steps">
          <li>
            Hold the clock&apos;s button until the screen shows <strong>SETUP</strong>.
          </li>
          <li>
            On your phone, join the Wi-Fi network named <strong>ClockStation-XXXX</strong>.
          </li>
          <li>Choose your home Wi-Fi in the page that opens, then come back here.</li>
        </ol>
      )}
    </>
  );
}

/* ---------------- Step 2: Pair ---------------- */

function PairStep({ target, pairing, setPairing, onRestart, restarting, onBack, onPaired }) {
  const now = useNow();
  const pairConfirm = usePairConfirm();
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(null); // { attemptsLeft }
  const [shakeKey, setShakeKey] = useState(0);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const verifying = pairConfirm.isPending;

  const lockedFor = pairing?.lockedUntil ? (pairing.lockedUntil - now) / 1000 : 0;
  const locked = lockedFor > 0;
  const expiresIn = pairing?.expiresAt ? (pairing.expiresAt - now) / 1000 : 0;
  const expired = !locked && (!pairing?.expiresAt || expiresIn <= 0);

  useEffect(() => {
    if (!locked && !expired) inputRef.current?.focus(0);
  }, [locked, expired, pairing?.expiresAt]);

  const confirm = async (value) => {
    setError(null);
    try {
      const device = await pairConfirm.mutateAsync({ host: target.host, code: value });
      onPaired(device);
    } catch (err) {
      setCode('');
      if (err.code === 'invalid_pairing_code' || (err.status === 422 && err.data?.attempts_left != null)) {
        setWrong({ attemptsLeft: err.data?.attempts_left });
        setShakeKey((k) => k + 1);
        setTimeout(() => inputRef.current?.focus(0), 0);
      } else if (err.code === 'pairing_locked') {
        setWrong(null);
        setPairing({ expiresAt: null, lockedUntil: Date.now() + (err.retryAfter ?? 300) * 1000 });
      } else {
        setError(describeError(err, "Couldn't check the code"));
      }
    }
  };

  const restart = () => {
    setWrong(null);
    setError(null);
    setCode('');
    onRestart();
  };

  const name = target?.name || 'your clock';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 className="step-title">Pair {name}</h2>
        <p className="step-text">Enter the 6-digit code shown on your clock.</p>
      </div>

      {locked && (
        <Banner tone="warn">
          Too many attempts. Try again in{' '}
          <span className="num" style={{ fontWeight: 600, color: 'var(--warn)' }}>
            {formatCountdown(lockedFor)}
          </span>
        </Banner>
      )}
      {error && <Banner>{error}</Banner>}

      {expired ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' }}>
          <span className="confirm-icon" aria-hidden="true">
            <TimerOff size={22} />
          </span>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Code expired</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Ask the clock for a fresh 6-digit code.
          </div>
          <Button variant="primary" onClick={restart} loading={restarting}>
            Show a new code
          </Button>
        </div>
      ) : (
        <>
          <PairingCodeInput
            key={shakeKey}
            ref={inputRef}
            value={code}
            onChange={(c) => {
              setCode(c);
              if (c) setWrong(null);
            }}
            onComplete={confirm}
            error={!!wrong && !code}
            shake={shakeKey > 0 && !!wrong}
            disabled={verifying || locked}
          />
          <div className="pair-status">
            {verifying ? (
              <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="muted">
                <Spinner />
                Checking code…
              </span>
            ) : wrong ? (
              <span role="alert" style={{ color: 'var(--err)' }}>
                Wrong code
                {wrong.attemptsLeft != null && `, ${wrong.attemptsLeft} ${wrong.attemptsLeft === 1 ? 'try' : 'tries'} left`}
              </span>
            ) : locked ? (
              <span />
            ) : (
              <span className="num muted">
                Code expires in <span style={{ color: 'var(--text)' }}>{formatCountdown(expiresIn)}</span>
              </span>
            )}
            {!locked && (
              <button type="button" className="linkbtn" onClick={restart} disabled={verifying || restarting}>
                Show a new code
              </button>
            )}
          </div>
        </>
      )}

      <div className="step-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Button variant="secondary" onClick={onBack} disabled={verifying}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Name ---------------- */

function NameStep({ device, onDone }) {
  const toast = useToast();
  const rename = useRenameDevice(device.id);
  const [name, setName] = useState(device.name || 'Bedroom clock');
  const [error, setError] = useState(null);

  const finish = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    const invalid = deviceNameError(trimmed);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (trimmed === device.name) return onDone(device);
    try {
      onDone(await rename.mutateAsync(trimmed));
    } catch (err) {
      // The device is paired either way; the name can be changed later in settings.
      toast.error(`Couldn't rename — ${describeError(err)}`);
      onDone(device);
    }
  };

  return (
    <form onSubmit={finish} style={{ display: 'flex', flexDirection: 'column', gap: 20 }} noValidate>
      <div>
        <h2 className="step-title">Name your clock</h2>
        <p className="step-text">You can change this later in settings.</p>
      </div>
      <TextField
        label="Name"
        value={name}
        maxLength={DEVICE_NAME_MAX}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        error={error}
        data-autofocus
        autoFocus
      />
      <div className="step-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
        <Button type="submit" variant="primary" loading={rename.isPending}>
          Finish
        </Button>
      </div>
    </form>
  );
}
