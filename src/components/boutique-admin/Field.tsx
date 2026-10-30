"use client";

import { useId } from "react";

/** Champ de formulaire accessible : label relié, erreur annoncée (aria-invalid + aria-describedby). */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode }) {
  const id = useId();
  const desc = error || hint ? `${id}-d` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": desc })}
      {(error || hint) && <small id={desc} role={error ? "alert" : undefined} style={{ color: error ? "var(--bad)" : "var(--mut)" }}>{error || hint}</small>}
    </div>
  );
}
