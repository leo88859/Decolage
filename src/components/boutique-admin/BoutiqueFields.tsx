"use client";

import type { Mode } from "@/lib/boutique/types";
import type { Errors } from "@/lib/boutique/validate";
import { THEMES } from "@/lib/boutique/themes";
import { ETAPES, type BoutiqueForm } from "./logic";
import { Field } from "./Field";

const MODE_LABEL: Record<Mode, [string, string]> = {
  retrait: ["Retrait sur place", "Le client vient chercher sa commande."],
  livraison: ["Livraison", "Le client donne son adresse."],
  contact: ["Sur contact", "Tu recontactes le client pour convenir de la suite."],
};

type P = { value: BoutiqueForm; onChange: (patch: Partial<BoutiqueForm>) => void; errors: Errors; etapes?: number[]; autoSlug?: boolean; onSlugEdited?: () => void };

/** Champs de la boutique, groupés par étape (l'assistant montre une étape, la modification les montre toutes). */
export function BoutiqueFields({ value: v, onChange, errors: e, etapes = [0, 1, 2, 3], onSlugEdited }: P) {
  return (
    <div className="stack">
      {etapes.includes(0) && (
        <>
          <Field label="Nom de la boutique" error={e.nom}>{(p) => <input {...p} className="input" maxLength={80} value={v.nom} onChange={(x) => onChange({ nom: x.target.value })} autoComplete="organization" />}</Field>
          <Field label="Adresse de ta boutique" error={e.slug} hint={`Ton lien public : /b/${v.slug || "ton-adresse"}`}>
            {(p) => <input {...p} className="input" maxLength={40} value={v.slug} onChange={(x) => { onSlugEdited?.(); onChange({ slug: x.target.value }); }} autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label="Description (facultatif)" error={e.description}>{(p) => <textarea {...p} className="input" rows={3} maxLength={1000} value={v.description} onChange={(x) => onChange({ description: x.target.value })} />}</Field>
        </>
      )}
      {etapes.includes(1) && (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={e.theme ? "theme-err" : undefined}>
            <legend className="label" style={{ marginBottom: 8 }}>Le style de ta vitrine</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {THEMES.map((t) => {
                const on = v.theme === t.id;
                return (
                  <label key={t.id} style={{ display: "grid", gap: 6, padding: 10, borderRadius: 12, cursor: "pointer", border: `2px solid ${on ? v.couleur_principale : "var(--line, #d6d6de)"}` }}>
                    <span aria-hidden="true" style={{ height: 46, borderRadius: 8, background: t.fond, border: "1px solid rgba(0,0,0,.12)", display: "flex", alignItems: "flex-end", gap: 6, padding: 8 }}>
                      <i style={{ width: 22, height: 8, borderRadius: 4, background: t.encre }} />
                      <i style={{ width: 14, height: 8, borderRadius: 4, background: v.couleur_principale }} />
                      <i style={{ width: 10, height: 8, borderRadius: 4, background: v.couleur_accent }} />
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                      <input type="radio" name="theme" value={t.id} checked={on} onChange={() => onChange({ theme: t.id })} />{t.nom}
                    </span>
                    <span className="tiny mut">{t.description}</span>
                  </label>
                );
              })}
            </div>
            {e.theme ? <p id="theme-err" className="err" role="alert">{e.theme}</p> : null}
          </fieldset>
          <div className="grid-2">
            <Field label="Couleur principale" error={e.couleur_principale}>{(p) => <input {...p} type="color" className="input" style={{ height: 46, padding: 4 }} value={v.couleur_principale} onChange={(x) => onChange({ couleur_principale: x.target.value })} />}</Field>
            <Field label="Couleur d'accent" error={e.couleur_accent}>{(p) => <input {...p} type="color" className="input" style={{ height: 46, padding: 4 }} value={v.couleur_accent} onChange={(x) => onChange({ couleur_accent: x.target.value })} />}</Field>
          </div>
          <Field label="Logo (adresse https://, facultatif)" error={e.logo} hint="Colle le lien d'une image hébergée en ligne. L'envoi de fichier n'existe pas encore.">
            {(p) => <input {...p} type="url" inputMode="url" className="input" placeholder="https://…" value={v.logo} onChange={(x) => onChange({ logo: x.target.value })} />}
          </Field>
        </>
      )}
      {etapes.includes(2) && (
        <>
          <Field label="Adresse (facultatif)" error={e.adresse}>{(p) => <input {...p} className="input" maxLength={200} value={v.adresse} onChange={(x) => onChange({ adresse: x.target.value })} autoComplete="street-address" />}</Field>
          <Field label="WhatsApp (facultatif)" error={e.whatsapp} hint="Chiffres, avec + éventuel. Ex. +221771234567">{(p) => <input {...p} type="tel" className="input" value={v.whatsapp} onChange={(x) => onChange({ whatsapp: x.target.value })} />}</Field>
          <Field label="E-mail (facultatif)" error={e.email}>{(p) => <input {...p} type="email" className="input" value={v.email} onChange={(x) => onChange({ email: x.target.value })} autoComplete="email" />}</Field>
          <Field label="Téléphone (facultatif)" error={e.telephone}>{(p) => <input {...p} type="tel" className="input" value={v.telephone} onChange={(x) => onChange({ telephone: x.target.value })} autoComplete="tel" />}</Field>
        </>
      )}
      {etapes.includes(3) && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={e.modes ? "modes-err" : undefined}>
          <legend className="label" style={{ marginBottom: 8 }}>Comment tes clients peuvent commander (au moins un)</legend>
          <div className="stack" style={{ gap: 10 }}>
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
              <label key={m} className="row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" style={{ width: 20, height: 20, marginTop: 2 }} checked={v.modes.includes(m)} onChange={(x) => onChange({ modes: x.target.checked ? [...v.modes, m] : v.modes.filter((y) => y !== m) })} />
                <span><strong>{MODE_LABEL[m][0]}</strong><br /><span className="mut">{MODE_LABEL[m][1]}</span></span>
              </label>
            ))}
          </div>
          {e.modes && <small id="modes-err" role="alert" style={{ color: "var(--bad)" }}>{e.modes}</small>}
        </fieldset>
      )}
    </div>
  );
}

export const ETAPE_TITRES = ETAPES.map((x) => x.titre);
