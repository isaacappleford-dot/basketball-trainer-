"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, Minus, Plus, X, XCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ---------------------------------- Buttons ---------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong font-semibold",
  secondary: "bg-surface-3 text-text hover:bg-line-strong",
  outline: "border border-line-strong text-text hover:bg-surface-2",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-bad-soft text-bad hover:bg-bad hover:text-white",
};
const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  xl: "h-14 px-6 text-base gap-2.5 rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Layout ---------------------------------- */

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cn("min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5", className)}>{children}</As>;
}

export function CardTitle({ children, action, icon, sub }: { children: ReactNode; action?: ReactNode; icon?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          {icon && <span className="text-accent">{icon}</span>}
          {children}
        </h2>
        {sub && <p className="mt-1 text-sm text-subtle">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className={cn("mt-1.5 font-display text-3xl font-bold tabular", accent && "text-accent")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad"; className?: string }) {
  const tones = {
    neutral: "bg-surface-3 text-muted",
    accent: "bg-accent-soft text-accent",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, onDismiss }: { tone?: "info" | "good" | "warn" | "bad"; title?: string; children?: ReactNode; onDismiss?: () => void }) {
  const map = {
    info: { cls: "border-line-strong bg-surface-2", icon: <Info size={18} className="text-muted" /> },
    good: { cls: "border-good/30 bg-good-soft", icon: <CheckCircle2 size={18} className="text-good" /> },
    warn: { cls: "border-warn/30 bg-warn-soft", icon: <AlertTriangle size={18} className="text-warn" /> },
    bad: { cls: "border-bad/30 bg-bad-soft", icon: <XCircle size={18} className="text-bad" /> },
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", map.cls)}>
      <span className="mt-0.5 shrink-0">{map.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-muted hover:text-text">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/* ----------------------------------- Forms ----------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-text placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 aria-[invalid=true]:border-bad";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, "h-11 text-base sm:text-sm", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-[88px] py-2.5 text-base sm:text-sm", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "h-11 appearance-none bg-[length:16px] pr-9 text-base sm:text-sm", className)} {...props}>
      {children}
    </select>
  );
}

/** Large numeric input with − / + buttons, for fast logging between sets. */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  label,
  suffix,
  size = "md",
  placeholder,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
  size?: "md" | "lg";
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    let next = Math.round((base + dir * step) * 100) / 100;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    setDraft(null);
    onChange(next);
  };
  const h = size === "lg" ? "h-14" : "h-12";
  const btn = "flex w-9 shrink-0 items-center justify-center text-muted hover:bg-surface-3 hover:text-text active:bg-line-strong sm:w-11";
  return (
    <div className={cn("flex items-stretch overflow-hidden rounded-xl border border-line-strong bg-surface-2", h)}>
      <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label}`} className={btn}>
        <Minus size={18} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-label={label}
          placeholder={placeholder ?? "—"}
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value);
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          onFocus={(e) => e.target.select()}
          className="h-7 w-full min-w-0 bg-transparent text-center text-lg font-semibold leading-none tabular text-text focus:outline-none"
        />
        {suffix && <span className="pointer-events-none text-[10px] leading-none text-subtle">{suffix}</span>}
      </div>
      <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label}`} className={btn}>
        <Plus size={18} />
      </button>
    </div>
  );
}

/** Segmented single-choice control (radio group semantics). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (idx + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    btns?.[next]?.focus();
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cn("flex min-w-0 gap-0.5 rounded-xl bg-surface-2 p-1 sm:gap-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (value === null && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap rounded-lg font-medium transition-colors",
              size === "sm" ? "h-8 px-2 text-xs" : options.length > 5 ? "h-10 px-0 text-sm" : "h-10 px-3 text-sm",
              active ? "bg-accent text-accent-ink" : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 1–5 (or 1–10) rating as a segmented control. */
export function Rating({ value, onChange, label, max = 5, lowLabel, highLabel }: { value: number | null; onChange: (v: number) => void; label: string; max?: number; lowLabel?: string; highLabel?: string }) {
  return (
    <div>
      <Segmented label={label} value={value} onChange={onChange} options={Array.from({ length: max }, (_, i) => ({ value: i + 1, label: i + 1 }))} />
      {(lowLabel || highLabel) && (
        <div className="mt-1 flex justify-between text-[11px] text-subtle">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
    </label>
  );
}

/* ----------------------------------- Modal ----------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-line-strong bg-surface p-0 text-text backdrop:bg-black/70 sm:m-auto sm:rounded-3xl",
        size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{message}</div>
    </Modal>
  );
}

/* ----------------------------------- Toasts ---------------------------------- */

type Toast = { id: number; tone: "good" | "bad" | "info"; message: string };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "good") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl",
              t.tone === "bad" ? "border-bad/40 bg-surface-2 text-bad" : "border-line-strong bg-surface-2 text-text",
            )}
          >
            {t.tone === "good" && <CheckCircle2 size={16} className="text-good" />}
            {t.tone === "bad" && <XCircle size={16} />}
            {t.tone === "info" && <Info size={16} className="text-muted" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ---------------------------------- Loading ---------------------------------- */

export function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      <p className="text-sm">Loading your training data…</p>
    </div>
  );
}

/** Warns before leaving the page while a form has unsaved input. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
