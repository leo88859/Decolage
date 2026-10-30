"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="#0a1433" />
      <path d="M8 23 L16 7 L24 23" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="21" r="3.2" fill="#ff6b4a" />
    </svg>
  );
}

/** Apparition au défilement. Sans IntersectionObserver ou avec mouvement réduit, l'élément est visible. */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "", style, ...rest }: { children: React.ReactNode; delay?: number; as?: "div" | "section" | "li"; className?: string } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        el.classList.add("in");
        io.disconnect();
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>} className={`reveal ${className}`} style={{ "--d": delay, ...style } as React.CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

// ─── Notifications éphémères ───
type Toast = { id: number; text: string; kind: "ok" | "error"; out?: boolean };
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
const emit = () => toastListeners.forEach((l) => l());
let tid = 0;

export function toast(text: string, kind: Toast["kind"] = "ok") {
  const id = ++tid;
  toasts = [...toasts, { id, text, kind }].slice(-3);
  emit();
  setTimeout(() => { toasts = toasts.map((t) => (t.id === id ? { ...t, out: true } : t)); emit(); }, 2400);
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 2750);
}

const EMPTY_TOASTS: Toast[] = [];
export function Toasts() {
  const list = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toasts, () => EMPTY_TOASTS);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""} ${t.out ? "out" : ""}`}>
          <span className="t-ic" aria-hidden="true">{t.kind === "error" ? "!" : "✓"}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ─── Modale (élément <dialog> natif : focus et touche Échap gérés par le navigateur) ───
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      {open && (
        <>
          <div className="modal-head">
            <h2 style={{ fontSize: 20 }}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, cta = "Confirmer", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: string; cta?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className={`btn ${danger ? "btn-danger" : ""}`} onClick={() => { onConfirm(); onClose(); }}>{cta}</button></>}>
      <p className="mut">{text}</p>
    </Modal>
  );
}

export function Dots({ value, max = 3, label }: { value: number; max?: number; label: string }) {
  return (
    <span className="dots" role="img" aria-label={`${label} : ${value} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? "on" : ""} />)}
    </span>
  );
}

export function Meter({ value, coral, label }: { value: number; coral?: boolean; label: string }) {
  return (
    <div className={`meter ${coral ? "coral" : ""}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, label }: { value: number; label: string }) {
  const c = value >= 70 ? "var(--ok)" : value >= 40 ? "var(--blue)" : "var(--coral-graph)";
  return (
    <div className="ring" style={{ "--v": value, "--c": c } as React.CSSProperties} role="img" aria-label={`${label} : ${value} sur 100`}>
      <span>{value}</span>
    </div>
  );
}

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); toast("Texte copié"); setTimeout(() => setDone(false), 1500); }, () => toast("Copie impossible", "error"))}
    >
      {done ? "✓ Copié" : label}
    </button>
  );
}

export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
