"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandPreview, type Device } from "@/components/brand/BrandPreview";
import { useFeatures } from "@/components/CloudSync";
import { Confirm, toast } from "@/components/ui";
import { useCloud } from "@/lib/cloud";
import { brandContrast } from "@/lib/brand/contrast";
import { COLOR_KEYS, DEFAULT_BRAND, FAVICON_MAX_BYTES, LOGO_MAX_BYTES, NAME_MAX, type Brand, type BrandState, type ColorKey } from "@/lib/brand/types";
import { COLOR_LABELS, validateBrand, validateColor, validateFavicon, validateLogo, type FieldErrors } from "@/lib/brand/validate";

type Access = "loading" | "demo" | "anon" | "denied" | "error" | "ready";

const COLOR_FIELDS: Record<ColorKey, { label: string; help: string }> = {
  primary: { label: "Couleur principale", help: "Boutons et éléments importants." },
  secondary: { label: "Couleur secondaire", help: "Barre d'en-tête (le texte y est blanc)." },
  accent: { label: "Couleur d'accent", help: "Petits repères et pastilles." },
  surface: { label: "Couleur de fond", help: "Fond des pages." },
  text: { label: "Couleur du texte", help: "Titres et paragraphes." },
};

const sameBrand = (a: Brand, b: Brand) => JSON.stringify(a) === JSON.stringify(b);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture impossible"));
    r.readAsDataURL(file);
  });
}

export default function Page() {
  const { cloud, loaded } = useFeatures();
  const { session, ready } = useCloud();
  const [remote, setRemote] = useState<Access | null>(null);
  const access: Access = !loaded ? "loading" : !cloud ? "demo" : !ready ? "loading" : !session ? "anon" : (remote ?? "loading");
  const [saved, setSaved] = useState<Brand>(DEFAULT_BRAND);
  const [draft, setDraft] = useState<Brand>(DEFAULT_BRAND);
  // Texte tapé dans les champs hexadécimaux (peut être invalide le temps de la saisie).
  const [hexText, setHexText] = useState<Record<ColorKey, string>>({ primary: DEFAULT_BRAND.primary, secondary: DEFAULT_BRAND.secondary, accent: DEFAULT_BRAND.accent, surface: DEFAULT_BRAND.surface, text: DEFAULT_BRAND.text });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [device, setDevice] = useState<Device>("desktop");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [canRestore, setCanRestore] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [over, setOver] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const apply = useCallback((s: BrandState) => {
    setSaved(s.brand);
    setDraft(s.brand);
    setHexText({ primary: s.brand.primary, secondary: s.brand.secondary, accent: s.brand.accent, surface: s.brand.surface, text: s.brand.text });
    setCanRestore(s.canRestore);
    setErrors({});
  }, []);

  // Détermine l'état d'accès puis charge la marque.
  useEffect(() => {
    if (!loaded || !cloud || !ready || !session) return;
    let alive = true;
    fetch("/api/brand", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) { apply(body as BrandState); setRemote("ready"); }
        else if (r.status === 403) setRemote("denied");
        else if (r.status === 503) setRemote("demo");
        else setRemote("error");
      })
      .catch(() => { if (alive) setRemote("error"); });
    return () => { alive = false; };
  }, [loaded, cloud, ready, session, apply]);

  const dirty = !sameBrand(draft, saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const contrast = useMemo(() => brandContrast(draft), [draft]);
  const canWrite = access === "ready";

  function setField<K extends keyof Brand>(key: K, value: Brand[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage(null);
  }

  function setColor(key: ColorKey, text: string) {
    setHexText((h) => ({ ...h, [key]: text }));
    const v = validateColor(text, COLOR_LABELS[key]);
    if (v.ok) {
      setErrors((e) => ({ ...e, [key]: undefined }));
      setField(key, v.value);
    } else setErrors((e) => ({ ...e, [key]: v.error }));
  }

  async function takeImage(file: File | undefined, kind: "logo" | "favicon") {
    if (!file) return;
    const check = kind === "logo" ? validateLogo : validateFavicon;
    if (file.size > (kind === "logo" ? LOGO_MAX_BYTES : FAVICON_MAX_BYTES)) {
      return setErrors((e) => ({ ...e, [kind]: `${kind === "logo" ? "Le logo" : "Le favicon"} trop lourd : ${Math.round((kind === "logo" ? LOGO_MAX_BYTES : FAVICON_MAX_BYTES) / 1000)} Ko maximum.` }));
    }
    try {
      const url = await readAsDataUrl(file);
      const v = check(url);
      if (!v.ok) return setErrors((e) => ({ ...e, [kind]: v.error }));
      setErrors((e) => ({ ...e, [kind]: undefined }));
      setField(kind, v.value);
    } catch {
      setErrors((e) => ({ ...e, [kind]: "Lecture du fichier impossible." }));
    }
  }

  async function call(method: "PUT" | "DELETE" | "POST", url: string, body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(url, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const res = (await r.json().catch(() => ({}))) as BrandState & { ok?: boolean; error?: string; errors?: FieldErrors };
      if (r.ok && res.ok === true) return res;
      if (res.errors) setErrors(res.errors);
      if (r.status === 403) setRemote("denied");
      setMessage({ kind: "bad", text: res.error ?? "Action impossible pour le moment." });
      return null;
    } catch {
      setMessage({ kind: "bad", text: "Connexion impossible : rien n'a été enregistré." });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const v = validateBrand(draft);
    if (!v.ok) { setErrors(v.errors); setMessage({ kind: "bad", text: "Corrige les champs signalés avant d'enregistrer." }); return; }
    const res = await call("PUT", "/api/brand", v.brand);
    if (res) { apply(res); setMessage({ kind: "ok", text: "Marque enregistrée." }); toast("Marque enregistrée"); }
  }
  async function reset() {
    const res = await call("DELETE", "/api/brand");
    if (res) { apply(res); setMessage({ kind: "ok", text: "Marque réinitialisée aux valeurs par défaut. Tu peux annuler avec « Restaurer la version précédente »." }); }
  }
  async function restore() {
    const res = await call("POST", "/api/brand/restore");
    if (res) { apply(res); setMessage({ kind: "ok", text: "Version précédente restaurée." }); }
  }

  if (access === "loading") return <main className="page"><div className="container narrow"><div className="skeleton" style={{ height: 300 }} /></div></main>;

  return (
    <main className="page">
      <div className="container stack" style={{ gap: 20, maxWidth: 1180 }}>
        <div>
          <Link href="/parametres" className="small mut">← Paramètres</Link>
          <span className="eyebrow" style={{ display: "flex", marginTop: 10 }}>Marque blanche</span>
          <h1 className="h-page" style={{ marginTop: 10 }}>Ta marque</h1>
          <p className="mut" style={{ maxWidth: 680, marginTop: 8 }}>Choisis un nom, un logo et des couleurs, puis vérifie le résultat dans l&apos;aperçu. Pour l&apos;instant, la marque est enregistrée sur ton compte ; elle n&apos;est pas encore appliquée aux sites publiés ni aux exports (voir « Ce qui est actif » en bas de page).</p>
        </div>

        {access === "anon" && <div className="alert alert-info bw-alert bw-alert-info" role="status"><span>Connecte-toi pour utiliser la marque blanche. <Link href="/connexion?next=/parametres/marque-blanche" style={{ textDecoration: "underline" }}>Se connecter</Link></span></div>}
        {access === "denied" && (
          <div className="alert alert-warn bw-alert bw-alert-warn" role="status">
            <span><b>Fonction non activée sur ton compte.</b> La marque blanche n&apos;est pas comprise dans les formules : elle est activée à la demande, par nous. Rien ne peut être enregistré tant qu&apos;elle n&apos;est pas activée.</span>
          </div>
        )}
        {access === "error" && <div className="alert alert-bad bw-alert bw-alert-bad" role="alert"><span>Impossible de charger ta marque pour le moment. Réessaie plus tard.</span></div>}
        {access === "demo" && (
          <div className="alert alert-warn bw-alert bw-alert-warn" role="status">
            <span><b>Mode démonstration.</b> Les comptes ne sont pas configurés sur ce site : tu peux essayer l&apos;éditeur et l&apos;aperçu, mais <b>rien n&apos;est enregistré</b> (tout disparaît en quittant la page).</span>
          </div>
        )}

        {(canWrite || access === "demo") && (
          <div className="bw-grid">
            <form className="panel stack bw-form" style={{ gap: 20 }} onSubmit={(e) => { e.preventDefault(); if (canWrite) void save(); }} noValidate aria-label="Réglages de la marque">
              <div className="row between">
                <h2 className="h-sec">Réglages</h2>
                {canWrite && (dirty ? <span className="badge badge-warn bw-badge" role="status">Modifications non enregistrées</span> : <span className="badge badge-ok bw-badge" role="status">À jour</span>)}
              </div>

              <div className="field">
                <label htmlFor="bw-name">Nom de la marque</label>
                <input id="bw-name" className="input" value={draft.name} maxLength={NAME_MAX + 20} autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={`bw-name-help${errors.name ? " bw-name-err" : ""}`}
                  onChange={(e) => { setField("name", e.target.value); setErrors((x) => ({ ...x, name: undefined })); }}
                  onBlur={() => { const v = validateBrand({ ...draft }); setErrors((x) => ({ ...x, name: v.ok ? undefined : v.errors.name })); }} />
                <p id="bw-name-help" className="hint">1 à {NAME_MAX} caractères, sans balises (&lt; ou &gt;). {[...draft.name].length}/{NAME_MAX}</p>
                {errors.name && <p id="bw-name-err" className="bw-err" role="alert">{errors.name}</p>}
              </div>

              <fieldset className="stack" style={{ gap: 12, border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Couleurs</legend>
                <div className="bw-colors">
                  {COLOR_KEYS.map((k) => (
                    <div className="field" key={k}>
                      <label htmlFor={`bw-${k}-hex`}>{COLOR_FIELDS[k].label}</label>
                      <div className="bw-colorrow">
                        <input type="color" className="bw-picker" aria-label={`${COLOR_FIELDS[k].label} : sélecteur`} value={validateColor(hexText[k]).ok ? hexText[k].toLowerCase() : draft[k]} onChange={(e) => setColor(k, e.target.value)} />
                        <input id={`bw-${k}-hex`} className="input" value={hexText[k]} spellCheck={false} autoComplete="off" maxLength={7} inputMode="text" aria-invalid={Boolean(errors[k])} aria-describedby={`bw-${k}-help${errors[k] ? ` bw-${k}-err` : ""}`} onChange={(e) => setColor(k, e.target.value)} />
                      </div>
                      <p id={`bw-${k}-help`} className="hint">{COLOR_FIELDS[k].help} Format #rrggbb.</p>
                      {errors[k] && <p id={`bw-${k}-err`} className="bw-err" role="alert">{errors[k]}</p>}
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="stack" style={{ gap: 8 }} aria-live="polite">
                <p className="label">Lisibilité</p>
                <ul className="small bw-contrast">
                  {contrast.pairs.map((p) => <li key={p.id}><span className={p.ok ? "bw-pass" : "bw-fail"} aria-hidden="true">{p.ok ? "✓" : "×"}</span><span>{p.label} : {p.ratio.toLocaleString("fr-FR")}:1 {p.ok ? "(suffisant)" : "(insuffisant, 4,5:1 attendu)"}</span></li>)}
                </ul>
                {contrast.warnings.map((w) => <div key={w} className="alert alert-warn bw-alert bw-alert-warn" role="status"><span>{w}</span></div>)}
                <p className="hint">Ces avertissements ne bloquent pas l&apos;enregistrement.</p>
              </div>

              <div className="field">
                <span className="label" id="bw-logo-label">Logo</span>
                <div className="bw-drop" data-over={over} role="group" aria-labelledby="bw-logo-label" aria-describedby={`bw-logo-help${errors.logo ? " bw-logo-err" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); void takeImage(e.dataTransfer.files?.[0], "logo"); }}>
                  {draft.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.logo} alt="Logo choisi" className="bw-thumb" />
                  ) : (
                    <span className="bw-drop-hint">
                      <svg className="bw-drop-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                      <span>{over ? "Relâche l'image pour l'importer." : "Glisse une image ici, ou utilise le bouton."}</span>
                    </span>
                  )}
                  <div className="row">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => logoInput.current?.click()}>{draft.logo ? "Changer le logo" : "Choisir un logo"}</button>
                    {draft.logo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setField("logo", null)}>Retirer le logo</button>}
                  </div>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void takeImage(e.target.files?.[0], "logo"); e.target.value = ""; }} />
                </div>
                <p id="bw-logo-help" className="hint">PNG, JPEG ou WebP, {Math.round(LOGO_MAX_BYTES / 1000)} Ko maximum. Le SVG est refusé (sécurité).</p>
                {errors.logo && <p id="bw-logo-err" className="bw-err" role="alert">{errors.logo}</p>}
              </div>

              <div className="field">
                <span className="label" id="bw-fav-label">Favicon (facultatif)</span>
                <div className="row" role="group" aria-labelledby="bw-fav-label" aria-describedby={`bw-fav-help${errors.favicon ? " bw-fav-err" : ""}`}>
                  {draft.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.favicon} alt="Favicon choisi" width={32} height={32} className="bw-thumb" style={{ width: 32, height: 32 }} />
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => faviconInput.current?.click()}>{draft.favicon ? "Changer le favicon" : "Choisir un favicon"}</button>
                  {draft.favicon && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setField("favicon", null)}>Retirer</button>}
                  <input ref={faviconInput} type="file" accept="image/png" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void takeImage(e.target.files?.[0], "favicon"); e.target.value = ""; }} />
                </div>
                <p id="bw-fav-help" className="hint">PNG uniquement, {Math.round(FAVICON_MAX_BYTES / 1000)} Ko maximum. Enregistré, mais pas encore utilisé sur un site.</p>
                {errors.favicon && <p id="bw-fav-err" className="bw-err" role="alert">{errors.favicon}</p>}
              </div>

              {message && <div className={`alert ${message.kind === "ok" ? "alert-ok bw-alert bw-alert-ok" : "alert-bad bw-alert bw-alert-bad"}`} role={message.kind === "ok" ? "status" : "alert"}><span>{message.text}</span></div>}

              <div className="bw-actions">
                {canWrite ? (
                  <>
                    <button type="submit" className="btn btn-coral" disabled={busy || !dirty}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirmReset(true)}>Réinitialiser</button>
                    {canRestore && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void restore()}>Restaurer la version précédente</button>}
                    {!dirty && !busy && <span className="hint">Aucune modification à enregistrer.</span>}
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-coral" disabled aria-describedby="bw-demo-note">Enregistrer</button>
                    <button type="button" className="btn btn-ghost" onClick={() => { apply({ entitled: true, brand: DEFAULT_BRAND, saved: false, version: 0, updatedAt: null, canRestore: false }); }}>Réinitialiser</button>
                    <span id="bw-demo-note" className="hint">Enregistrement indisponible en mode démonstration.</span>
                  </>
                )}
              </div>
            </form>

            <section className="panel stack bw-sticky" style={{ gap: 14 }} aria-labelledby="bw-prev-title">
              <div className="row between bw-preview-head">
                <h2 className="h-sec" id="bw-prev-title">Aperçu</h2>
                <div className="seg" role="group" aria-label="Taille de l'aperçu">
                  <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Ordinateur</button>
                  <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
                </div>
              </div>
              <BrandPreview brand={draft} device={device} />
              <p className="hint">Aperçu à titre d&apos;exemple, avec des données fictives.</p>
            </section>
          </div>
        )}

        <section className="panel stack" style={{ gap: 8 }} aria-labelledby="bw-actif">
          <h2 className="h-sec" id="bw-actif">Ce qui est actif</h2>
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Actif : enregistrement de ton nom, de tes couleurs, de ton logo et de ton favicon sur ton compte, avec retour à la version précédente.</li>
            <li>Non appliqué pour l&apos;instant : aux sites publiés (<code>/s/…</code>), aux exports ZIP, à l&apos;interface de Décollage et aux domaines personnalisés.</li>
          </ul>
        </section>
      </div>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={() => void reset()} title="Réinitialiser ta marque ?" text="Le nom, les couleurs, le logo et le favicon reviennent aux valeurs par défaut. Tu pourras annuler avec « Restaurer la version précédente »." cta="Réinitialiser" danger />
    </main>
  );
}
