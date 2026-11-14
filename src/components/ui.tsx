import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/* ---------- Sheet (bottom sheet on phones, dialog on wide screens) ---------- */

let openSheets = 0;

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerExtra,
  size = 'auto',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  size?: 'auto' | 'full';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openSheets++;
    document.documentElement.classList.add('sheet-open');
    document.getElementById('root')?.setAttribute('inert', '');
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', key);
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener('keydown', key);
      openSheets--;
      if (openSheets <= 0) {
        document.documentElement.classList.remove('sheet-open');
        document.getElementById('root')?.removeAttribute('inert');
      }
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panel}
        className={`sheet sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <div className="sheet__titles">
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            {subtitle && <div className="sheet__subtitle">{subtitle}</div>}
          </div>
          {headerExtra}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className = '',
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: string; disabled?: boolean }[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`seg seg--${size} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="seg__opt"
          disabled={o.disabled}
          title={o.hint}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stepper ---------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  size = 'md',
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
  format?: (v: number) => ReactNode;
}) {
  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} verringern`}>
        <Icon name="minus" size={16} strokeWidth={2.5} />
      </button>
      <output className="stepper__val" aria-live="polite">
        {format ? format(value) : value}
      </output>
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} erhöhen`}>
        <Icon name="plus" size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ---------- Switch row ---------- */

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`switch-row${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {hint && <span className="switch-row__hint">{hint}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/* ---------- Toasts ---------- */

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(text: string, action?: ToastMsg['action']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((text: string, action?: ToastMsg['action']) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setToast(null), action ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Confirm sheet ---------- */

export function ConfirmSheet({
  open,
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="confirm-text">{text}</p>
    </Sheet>
  );
}

/* ---------- misc ---------- */

export function Section({ title, aside, children, className = '' }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`}>
      {(title || aside) && (
        <div className="section__head">
          {title && <h3 className="section__title">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function PlayerDot({ index }: { index: number }) {
  return <span className="pdot" style={{ background: `var(--p${(index % 7) + 1})` }} aria-hidden="true" />;
}
