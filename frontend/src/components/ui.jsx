import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export function Spinner({ className = 'size-5' }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} aria-label="Chargement" />;
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="size-7" />
    </div>
  );
}

export function ErrorMessage({ error, className = '' }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-red-900/60 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-200 ${className}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{error.message ?? String(error)}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 rounded-2xl bg-zinc-800 p-3 text-brand-400">
          <Icon className="size-7" />
        </div>
      )}
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-zinc-400">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// Contrôle segmenté (onglets compacts)
export function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div
      role="tablist"
      className={`inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${pad} ${
              active ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {option.icon && <option.icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, hint, accent = false }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
      <div className={`tabular truncate text-lg font-bold ${accent ? 'text-brand-400' : 'text-zinc-100'}`}>
        {value}
      </div>
      {hint && <div className="truncate text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

// Fenêtre modale : feuille ancrée en bas sur mobile, centrée sur desktop.
export function Modal({ open, onClose, title, children, footer }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-zinc-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
