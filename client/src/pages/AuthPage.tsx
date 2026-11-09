import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PinPad } from '@/components/ui/PinPad';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { describeThisDevice } from '@/lib/device';
import { getGuestTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { LandingPage } from '@/pages/LandingPage';

type View = 'landing' | 'login' | 'register' | 'reset';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

const digitsOf = (s: string) => s.replace(/\D/g, '');
/** Accepts 98765 43210 / +91 98765 43210 / 09876543210. */
function tenDigits(raw: string): string {
  let d = digitsOf(raw);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
const validMobile = (raw: string) => /^[6-9]\d{9}$/.test(tenDigits(raw));
const spaced = (d: string) => `${d.slice(0, 5)} ${d.slice(5)}`;

const slide = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 36 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36 }),
};

interface Props { isDark: boolean; onToggleTheme: () => void }

export function AuthPage({ isDark, onToggleTheme }: Props) {
  const [view, setView] = useState<View>('landing');
  // Carried from "forgot Pin" back to sign-in: the number to pre-fill and a confirmation line.
  const [after, setAfter] = useState<{ mobile: string; notice?: string }>({ mobile: '' });
  const toLogin = (mobile = '', notice?: string) => { setAfter({ mobile, notice }); setView('login'); };
  return (
    <div className="relative flex h-dvh justify-center bg-bg">
      {/* The landing colour fields extend past the phone column on wide screens. */}
      <div className="relative h-full w-full max-w-[430px]">
        <AnimatePresence mode="wait" initial={false}>
          {view === 'landing' ? (
            <motion.div key="landing" className="h-full" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
              <LandingPage onCreate={() => setView('register')} onSignIn={() => setView('login')} isDark={isDark} onToggleTheme={onToggleTheme} />
            </motion.div>
          ) : (
            <motion.div key={view} className="h-full" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
              {view === 'login' && <LoginFlow onBack={() => setView('landing')} onSwitch={() => setView('register')} onForgot={(m) => { setAfter({ mobile: m }); setView('reset'); }} initialMobile={after.mobile} notice={after.notice} />}
              {view === 'register' && <RegisterFlow onBack={() => setView('landing')} onSwitch={() => toLogin()} />}
              {view === 'reset' && <ResetFlow initialMobile={after.mobile} onBack={() => toLogin(after.mobile)} onDone={(m) => toLogin(m, 'Your Secret Pin was changed. Enter your new Secret Pin to sign in.')} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------- shared pieces ---------------- */

function Screen({ onBack, progress, title, sub, children, footer }: { onBack: () => void; progress?: [number, number]; title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pt-3">
        <button type="button" onClick={onBack} className="flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[17px] font-medium text-accent active:opacity-60">
          <ChevronLeft size={26} aria-hidden />Back
        </button>
        {progress && (
          <div className="flex flex-1 gap-1.5 pr-4" role="progressbar" aria-valuemin={1} aria-valuemax={progress[1]} aria-valuenow={progress[0]} aria-label={`Step ${progress[0]} of ${progress[1]}`}>
            {Array.from({ length: progress[1] }, (_, i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.span className="brand-gradient block h-full" initial={false} animate={{ width: i < progress[0] ? '100%' : '0%' }} transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em]">{title}</h1>
        {sub && <p className="mt-2 text-[17px] text-muted">{sub}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="px-6 pb-5 pt-3">{footer}</div>}
    </div>
  );
}

function MobileField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field
      label="Mobile number"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      prefix="+91"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))}
      error={error}
    />
  );
}

/* ---------------- sign in ---------------- */

function LoginFlow({ onBack, onSwitch, onForgot, initialMobile = '', notice }: { onBack: () => void; onSwitch: () => void; onForgot: (mobile: string) => void; initialMobile?: string; notice?: string }) {
  const { login } = useAuth();
  const [step, setStep] = useState(initialMobile ? 1 : 0);
  const [dir, setDir] = useState(1);
  const [mobile, setMobile] = useState(initialMobile);
  const [pin, setPin] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const thisDevice = useMemo(() => describeThisDevice(), []);

  const go = (s: number) => { setDir(s > step ? 1 : -1); setStep(s); };

  function next(e: FormEvent) {
    e.preventDefault();
    if (!validMobile(mobile)) return setMobileError('Enter your 10-digit mobile number');
    setMobileError(''); go(1);
  }

  async function submit(code: string) {
    setBusy(true); setPinError('');
    try { await login(tenDigits(mobile), code, remember); }
    catch (err) {
      setPinError(err instanceof ApiError ? err.message : 'Can’t reach the server. Please check your internet connection.');
      setPin('');
    } finally { setBusy(false); }
  }

  const onPin = (v: string) => { setPin(v); setPinError(''); if (v.length === 4) setTimeout(() => submit(v), 160); };

  return (
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.div key={step} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="h-full">
        {step === 0 ? (
          <form onSubmit={next} className="h-full" noValidate>
            <Screen onBack={onBack} title="Welcome back" sub="Enter your mobile number to sign in."
              footer={<div className="space-y-1"><Button type="submit" block>Continue</Button><Button type="button" variant="link" block onClick={onSwitch}>Create a new account</Button></div>}>
              <MobileField value={mobile} onChange={(v) => { setMobile(v); setMobileError(''); }} error={mobileError} />
              <div className="mt-5">
                <Switch label="Remember me" checked={remember} onChange={setRemember}
                  hint={remember ? `Stay signed in on this device (${thisDevice}). Turn off on a shared phone or computer.` : 'You’ll sign in again each time you open the app.'} />
              </div>
            </Screen>
          </form>
        ) : (
          <Screen onBack={() => { setPin(''); setPinError(''); go(0); }} title="Enter your Secret Pin" sub={`Signing in as +91 ${spaced(tenDigits(mobile))}`}>
            {notice && <p role="status" className="mb-5 rounded-[14px] bg-accent/12 px-4 py-3 text-center text-[15px] font-medium text-accent">{notice}</p>}
            <PinPad label="Secret Pin" value={pin} onChange={onPin} error={pinError} disabled={busy} />
            <div className="mt-4 flex flex-col items-center">
              <Button type="button" variant="link" onClick={() => onForgot(tenDigits(mobile))}>Forgot Secret Pin?</Button>
              <Button type="button" variant="link" role="switch" aria-checked={remember} onClick={() => setRemember((r) => !r)}>
                Remember me: {remember ? 'On' : 'Off'}
              </Button>
            </div>
          </Screen>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------- create account ---------------- */

type Errors = Partial<Record<'name' | 'gender' | 'dob' | 'mobile' | 'pin', string>>;

function RegisterFlow({ onBack, onSwitch }: { onBack: () => void; onSwitch: () => void }) {
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ name: '', gender: '', dob: '', mobile: '', pin: '', pin2: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const todayRef = useRef(new Date().toISOString().slice(0, 10));

  const go = (s: number) => { setDir(s > step ? 1 : -1); setStep(s); };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  function step0(e: FormEvent) {
    e.preventDefault();
    const er: Errors = {};
    if (!f.name.trim()) er.name = 'Please enter your name';
    if (!f.gender) er.gender = 'Please choose an option';
    setErrors(er);
    if (!Object.keys(er).length) go(1);
  }

  function step1(e: FormEvent) {
    e.preventDefault();
    const er: Errors = {};
    if (!f.dob) er.dob = 'Please enter your date of birth';
    else if (f.dob > todayRef.current) er.dob = 'Date of birth cannot be in the future';
    if (!validMobile(f.mobile)) er.mobile = 'Enter a valid 10-digit mobile number';
    setErrors(er);
    if (!Object.keys(er).length) go(2);
  }

  async function create(pin: string) {
    setBusy(true);
    try { const guest = getGuestTheme();
      await register({ name: f.name.trim(), gender: f.gender, dob: f.dob, mobile: tenDigits(f.mobile), pin, ...(guest === 'dark' && { theme: guest }) }); }
    catch (err) {
      // Send the person back to the field the server complained about.
      const message = err instanceof ApiError ? err.message : 'Can’t reach the server. Please check your internet connection.';
      const d = err instanceof ApiError ? err.details ?? {} : {};
      setF((s) => ({ ...s, pin: '', pin2: '' }));
      if (d.name || d.gender) { setErrors({ name: d.name?.[0], gender: d.gender?.[0] }); go(0); }
      else if (d.dob || d.mobile || /mobile|age|born/i.test(message)) { setErrors({ dob: d.dob?.[0], mobile: d.mobile?.[0] ?? (/mobile/i.test(message) ? message : undefined) }); go(1); }
      else { setErrors({ pin: message }); go(2); }
    } finally { setBusy(false); }
  }

  const onCreatePin = (v: string) => { set('pin', v); if (v.length === 4) setTimeout(() => go(3), 220); };
  const onConfirmPin = (v: string) => {
    setF((s) => ({ ...s, pin2: v })); setErrors((e) => ({ ...e, pin: undefined }));
    if (v.length === 4) {
      setTimeout(() => {
        if (v === f.pin) create(v);
        else { setErrors({ pin: 'The two Secret Pins don’t match. Please try again.' }); setF((s) => ({ ...s, pin2: '' })); }
      }, 160);
    }
  };

  const progress: [number, number] = [Math.min(step + 1, 3), 3];

  return (
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.div key={step} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="h-full">
        {step === 0 && (
          <form onSubmit={step0} className="h-full" noValidate>
            <Screen onBack={onBack} progress={progress} title="Let’s create your account"
              footer={<div className="space-y-1"><Button type="submit" block>Continue</Button><Button type="button" variant="link" block onClick={onSwitch}>I already have an account</Button></div>}>
              <div className="space-y-5">
                <Field label="Name" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={60} />
                <fieldset>
                  <legend className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Gender</legend>
                  <div role="radiogroup" aria-label="Gender" className={cn('divide-y divide-line overflow-hidden rounded-[16px] bg-surface shadow-[var(--sm-shadow)] dark:bg-surface-2', errors.gender && 'shake ring-2 ring-neg/70')} key={errors.gender ?? 'ok'}>
                    {GENDERS.map((g) => (
                      <button key={g.value} type="button" role="radio" aria-checked={f.gender === g.value} onClick={() => set('gender', g.value)} className="flex h-[52px] w-full items-center justify-between px-4 text-left text-[17px] active:bg-surface-2">
                        {g.label}
                        {f.gender === g.value && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} className="text-accent"><Check size={22} strokeWidth={3} aria-hidden /></motion.span>}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p role="alert" className="mt-1.5 px-1 text-[14px] font-medium text-neg">{errors.gender}</p>}
                </fieldset>
              </div>
            </Screen>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={step1} className="h-full" noValidate>
            <Screen onBack={() => go(0)} progress={progress} title="A few more details"
              footer={<Button type="submit" block>Continue</Button>}>
              <div className="space-y-5">
                <Field label="Date of birth" type="date" autoComplete="bday" max={todayRef.current} value={f.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} />
                <MobileField value={f.mobile} onChange={(v) => set('mobile', v)} error={errors.mobile} />
              </div>
            </Screen>
          </form>
        )}

        {step === 2 && (
          <Screen onBack={() => go(1)} progress={progress} title="Create your Secret Pin" sub="4 digits. You’ll use it with your mobile number to sign in.">
            <PinPad label="Create Secret Pin" value={f.pin} onChange={onCreatePin} error={errors.pin} disabled={busy} />
          </Screen>
        )}

        {step === 3 && (
          <Screen onBack={() => { setF((s) => ({ ...s, pin2: '' })); setErrors({}); go(2); }} progress={progress} title="Confirm your Secret Pin" sub="Enter the same 4 digits again.">
            <PinPad label="Confirm Secret Pin" value={f.pin2} onChange={onConfirmPin} error={errors.pin} disabled={busy} />
          </Screen>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------- forgot Secret Pin ---------------- */

function ResetFlow({ onBack, onDone, initialMobile }: { onBack: () => void; onDone: (mobile: string) => void; initialMobile: string }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState({ mobile: initialMobile, dob: '', pin: '', pin2: '' });
  const [errors, setErrors] = useState<{ mobile?: string; dob?: string; pin?: string }>({});
  const [busy, setBusy] = useState(false);
  const todayRef = useRef(new Date().toISOString().slice(0, 10));

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  function verify(e: FormEvent) {
    e.preventDefault();
    const er: typeof errors = {};
    if (!validMobile(f.mobile)) er.mobile = 'Enter your 10-digit mobile number';
    if (!f.dob) er.dob = 'Please enter your date of birth';
    else if (f.dob > todayRef.current) er.dob = 'Date of birth cannot be in the future';
    setErrors(er);
    if (!Object.keys(er).length) go(1);
  }

  async function submit(pin: string) {
    setBusy(true);
    try {
      await api('/auth/reset-pin', { method: 'POST', json: { mobile: tenDigits(f.mobile), dob: f.dob, pin } });
      onDone(tenDigits(f.mobile));
    } catch (err) {
      // Details are checked on the server, so a mismatch sends the person back to the first step.
      setF((s) => ({ ...s, pin: '', pin2: '' }));
      setErrors({ dob: err instanceof ApiError ? err.message : 'Can’t reach the server. Please check your internet connection.' });
      go(0);
    } finally { setBusy(false); }
  }

  const onNew = (v: string) => { setF((s) => ({ ...s, pin: v })); if (v.length === 4) setTimeout(() => go(2), 220); };
  const onConfirm = (v: string) => {
    setF((s) => ({ ...s, pin2: v })); setErrors({});
    if (v.length === 4) {
      setTimeout(() => {
        if (v === f.pin) submit(v);
        else { setErrors({ pin: 'The two Secret Pins don’t match. Please try again.' }); setF((s) => ({ ...s, pin2: '' })); }
      }, 160);
    }
  };

  return (
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.div key={step} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="h-full">
        {step === 0 && (
          <form onSubmit={verify} className="h-full" noValidate>
            <Screen onBack={onBack} progress={[1, 3]} title="Forgot your Secret Pin?" sub="Confirm it’s you with your mobile number and date of birth."
              footer={<Button type="submit" block>Continue</Button>}>
              <div className="space-y-5">
                <MobileField value={f.mobile} onChange={(v) => { setF((s) => ({ ...s, mobile: v })); setErrors((e) => ({ ...e, mobile: undefined })); }} error={errors.mobile} />
                <Field label="Date of birth" type="date" autoComplete="bday" max={todayRef.current} value={f.dob} onChange={(e) => { setF((s) => ({ ...s, dob: e.target.value })); setErrors((er) => ({ ...er, dob: undefined })); }} error={errors.dob} />
              </div>
            </Screen>
          </form>
        )}
        {step === 1 && (
          <Screen onBack={() => go(0)} progress={[2, 3]} title="Create a new Secret Pin" sub="Choose 4 digits you’ll remember.">
            <PinPad label="New Secret Pin" value={f.pin} onChange={onNew} disabled={busy} />
          </Screen>
        )}
        {step === 2 && (
          <Screen onBack={() => { setF((s) => ({ ...s, pin2: '' })); setErrors({}); go(1); }} progress={[3, 3]} title="Confirm your new Secret Pin" sub="Enter the same 4 digits again.">
            <PinPad label="Confirm new Secret Pin" value={f.pin2} onChange={onConfirm} error={errors.pin} disabled={busy} />
          </Screen>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
