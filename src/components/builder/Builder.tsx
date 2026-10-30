"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppDataBridge } from "@/components/AppDataBridge";
import { useHistory } from "@/components/builder/useHistory";
import { LivePreview } from "@/components/LivePreview";
import { Confirm, download, LogoMark, toast } from "@/components/ui";
import { ANIM_LABEL, DASH_LABEL, DESIGN_BY_ID, DESIGNS, SHELL_LABEL } from "@/data/designs";
import { archOf } from "@/data/archetypes";
import { EXTRA_PAGES } from "@/data/extras";
import { IDEA_BY_ID } from "@/data/ideas";
import { MODULE_BY_ID, MODULES } from "@/data/modules";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { defaultConfig, initialsOf, POLICES, STYLE_PRESETS, validateConfig } from "@/lib/config";
import { LOGO_FORMES, logoFor, type LogoForme } from "@/lib/logo";
import { projectJson, slug } from "@/lib/export";
import { renderLanding, syncLanding } from "@/lib/landing";
import { activePages, dependencies, dependents, disableModule, enableModule, REVENUE_LABEL, setRevenue, type Result } from "@/lib/modules";
import { can } from "@/lib/plans";
import { renderPrototype } from "@/lib/prototype";
import { buildContenu } from "@/lib/remplissage";
import { duplicate, updateProject, useData } from "@/lib/store";
import { switchTemplate } from "@/lib/switch";
import type { Config, ExtraKind, Landing, ModuleDef, ModuleId, Police, Project, Revenue, TemplateId, VisualStyle } from "@/lib/types";
import "./builder.css";

export const STEPS = [
  { id: "type", label: "Type", hint: "Ce que fait ton SaaS" },
  { id: "design", label: "Design", hint: "Son apparence complète" },
  { id: "perso", label: "Personnalisation", hint: "Nom, textes, couleurs, pages" },
  { id: "fonctions", label: "Fonctions", hint: "Briques et pages en plus" },
  { id: "verif", label: "Vérification", hint: "Récapitulatif et sauvegarde" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];
export const isStep = (x: unknown): x is StepId => STEPS.some((s) => s.id === x);

const SWATCHES = ["#2f5bff", "#0a1433", "#ff6b4a", "#0f9d7a", "#7c3aed", "#e11d48", "#f59e0b", "#111827"];
const GROUPS: ModuleDef["groupe"][] = ["Comptes", "Données", "Revenus", "Pilotage"];

/** Ce qu'il faudra brancher pour que la brique fonctionne en vrai (dans l'aperçu, tout est simulé). */
const EXTERNE: Partial<Record<ModuleId, string>> = {
  auth: "comptes réels (Supabase ou équivalent)",
  "acces-libre": "",
  profil: "stockage des profils (base de données)",
  donnees: "base de données (Supabase ou équivalent)",
  formulaires: "enregistrement des envois (base de données)",
  favoris: "base de données",
  abonnement: "paiements réels (Stripe)",
  facturation: "factures réelles (Stripe)",
  notifications: "service d'e-mails ou de SMS",
  admin: "authentification réelle avec rôles",
  historique: "base de données",
};

type Texts = { titre: string; texte: string; bp: string; bs: string };
const textsOf = (l: Landing): Texts => {
  const hero = l.sections.find((s) => s.type === "hero");
  return { titre: hero?.titre ?? "", texte: hero?.texte ?? "", bp: l.boutonPrincipal, bs: l.boutonSecondaire };
};
const withTexts = (l: Landing, t: Texts): Landing => ({
  ...l, edited: true, boutonPrincipal: t.bp, boutonSecondaire: t.bs,
  sections: l.sections.map((s) => (s.type === "hero" ? { ...s, titre: t.titre, texte: t.texte } : s)),
});

export function Builder({ project, initialStep = "perso" }: { project: Project; initialStep?: StepId }) {
  const router = useRouter();
  const { plan } = useData();
  const h = useHistory<Config>(project.config);
  useAppDataBridge(project.id);
  const cfg = h.value;
  const [step, setStep] = useState<StepId>(initialStep);
  const [view, setView] = useState<"prototype" | "landing">("prototype");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [page, setPage] = useState("accueil");
  const [zone, setZone] = useState<"reglages" | "apercu">("reglages");
  const [notice, setNotice] = useState<{ kind: "bad" | "info"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pulse, setPulse] = useState(false);
  // Textes de la page de vente modifiés ici (null = ils suivent automatiquement le nom et la description).
  const [texts, setTexts] = useState<Texts | null>(null);

  const template = TEMPLATE_BY_ID[cfg.templateId];
  const errors = useMemo(() => validateConfig(cfg), [cfg]);
  const valid = Object.keys(errors).length === 0;
  const advanced = can(plan, "personnalisationAvancee");
  const pages = activePages(cfg);
  const arch = archOf(cfg.templateId);
  const currentPage = pages.some((p) => p.id === page) ? page : "accueil";

  // Le contenu rempli à partir de l'idée suit le type de SaaS : il est recalculé si le type change.
  const contenu = useMemo(() => {
    const c = project.contenu;
    if (!c) return undefined;
    return c.type === cfg.templateId ? c : buildContenu(c.idee, cfg.templateId, c.secteur);
  }, [project.contenu, cfg.templateId]);
  const baseLanding = syncLanding(cfg, project.landing, contenu);
  const landing = texts ? withTexts(baseLanding, texts) : baseLanding;
  const shownTexts = texts ?? textsOf(baseLanding);
  const dirty = texts !== null || JSON.stringify(cfg) !== JSON.stringify(project.config);

  const srcDoc = view === "prototype"
    ? renderPrototype(cfg, currentPage, contenu, { persist: true, storeKey: project.id })
    : renderLanding(cfg, landing, project.pricing.offres.length ? project.pricing : null, { inlineCss: true, contenu });

  const set = (patch: Partial<Config>, key?: string) => h.commit({ ...cfg, ...patch }, key);
  const setText = (patch: Partial<Texts>) => setTexts({ ...shownTexts, ...patch });

  function apply(r: Result) {
    if (!r.ok) {
      setNotice({ kind: "bad", text: r.raison });
      toast("Modification refusée", "error");
      return;
    }
    // Réglages par défaut des briques ajoutées.
    const reglages = { ...r.config.reglages };
    for (const m of r.config.modules) for (const s of MODULE_BY_ID[m].reglages) reglages[s.id] ??= s.options[0]!;
    h.commit({ ...r.config, reglages });
    setNotice(r.ajoutes.length ? { kind: "info", text: `Ajouté automatiquement : ${r.ajoutes.map((m) => MODULE_BY_ID[m].nom).join(", ")}.` } : null);
  }

  function changeType(id: TemplateId) {
    if (id === cfg.templateId) return;
    const r = switchTemplate(cfg, id);
    h.commit(r.config);
    setPage("accueil");
    setNotice({ kind: "info", text: r.perdus.length ? `Type « ${TEMPLATE_BY_ID[id].nom} » appliqué. Non conservé : ${r.perdus.join(", ")}. Tout le reste est gardé (annulable avec ↶).` : `Type « ${TEMPLATE_BY_ID[id].nom} » appliqué. Nom, design, couleurs, logo et fonctions compatibles sont gardés (annulable avec ↶).` });
  }

  function save() {
    if (!valid) {
      toast("Corrige les erreurs avant d'enregistrer", "error");
      setStep("verif");
      return;
    }
    updateProject(project.id, (p) => {
      const base = syncLanding(cfg, p.landing, contenu);
      return { ...p, config: cfg, contenu: contenu ?? p.contenu, landing: texts ? withTexts(base, texts) : base };
    }, "Constructeur : configuration enregistrée");
    setTexts(null);
    setPulse(true);
    setTimeout(() => setPulse(false), 1600);
    toast("Projet enregistré");
  }

  function onDuplicate() {
    const r = duplicate(project.id);
    if (!r.ok) return toast(r.error, "error");
    toast("Projet dupliqué (dernière version enregistrée)");
    router.push(`/projets/${r.id}/constructeur`);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choisis une image", "error");
    if (file.size > 300_000) return toast("Image trop lourde (300 Ko maximum)", "error");
    const reader = new FileReader();
    reader.onload = () => set({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  // Raccourcis clavier et protection des modifications non enregistrées.
  const keys = useRef({ save, undo: h.undo, redo: h.redo });
  useEffect(() => { keys.current = { save, undo: h.undo, redo: h.redo }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const typing = (e.target as HTMLElement).closest("input, textarea, select");
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); keys.current.save(); }
      else if (!typing && k === "z" && !e.shiftKey) { e.preventDefault(); keys.current.undo(); }
      else if (!typing && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); keys.current.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const goPage = (id: string) => {
    setView("prototype");
    setPage(id);
    setZone("apercu");
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const design = cfg.design ? DESIGN_BY_ID[cfg.design] : undefined;
  const errList = Object.entries(errors);

  return (
    <div className="bz" data-zone={zone}>
      {/* Barre d'outils */}
      <header className="bz-bar">
        <div className="row" style={{ gap: 10, flexWrap: "nowrap", minWidth: 0 }}>
          <Link href={`/projets/${project.id}`} className="icon-btn" aria-label="Retour au projet">←</Link>
          <LogoMark size={26} />
          <div style={{ minWidth: 0 }}>
            <b className="bz-name">{cfg.nom || "Sans nom"}</b>
            <span className={`tiny bz-status ${dirty ? "dirty" : ""}`}>{dirty ? "● Modifications non enregistrées" : "✓ Tout est enregistré"}</span>
          </div>
        </div>
        <div className="row bz-tools" style={{ gap: 6 }}>
          <button className="icon-btn" onClick={h.undo} disabled={!h.canUndo} aria-label="Annuler" title="Annuler (Ctrl+Z)">↶</button>
          <button className="icon-btn" onClick={h.redo} disabled={!h.canRedo} aria-label="Rétablir" title="Rétablir (Ctrl+Y)">↷</button>
          <span className="bz-sep" />
          <div className="seg" role="group" aria-label="Aperçu">
            <button aria-pressed={view === "prototype"} onClick={() => setView("prototype")}>Application</button>
            <button aria-pressed={view === "landing"} onClick={() => setView("landing")}>Page de vente</button>
          </div>
          <div className="seg bz-device" role="group" aria-label="Appareil">
            <button aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} aria-label="Ordinateur" title="Ordinateur">▭</button>
            <button aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} aria-label="Mobile" title="Mobile">▯</button>
          </div>
          <span className="bz-sep" />
          <details className="bz-more">
            <summary className="btn btn-ghost btn-sm">Plus</summary>
            <div className="bz-menu" onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
              <button onClick={() => setConfirmReset(true)}>Réinitialiser le type de SaaS</button>
              <button onClick={() => download(`${slug(cfg.nom)}.decollage.json`, projectJson({ ...project, config: cfg }), "application/json")}>Exporter la configuration (JSON)</button>
              <button onClick={onDuplicate} disabled={!can(plan, "duplication")}>Dupliquer le projet {can(plan, "duplication") ? "" : "· offre payante"}</button>
              <Link href={`/projets/${project.id}?onglet=landing`}>Toutes les sections de la page de vente</Link>
              <Link href={`/projets/${project.id}?onglet=export`}>Télécharger les fichiers</Link>
            </div>
          </details>
          <button className={`btn btn-sm ${pulse ? "bz-saved" : ""}`} onClick={save} disabled={!dirty && !pulse} title="Enregistrer (Ctrl+S)">
            {pulse ? <><span className="bz-check">✓</span> Enregistré</> : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="seg bz-zones" role="group" aria-label="Zone">
        <button aria-pressed={zone === "reglages"} onClick={() => setZone("reglages")}>Étapes</button>
        <button aria-pressed={zone === "apercu"} onClick={() => setZone("apercu")}>Aperçu</button>
      </div>

      <div className="bz-body">
        {/* Gauche : les 5 étapes */}
        <aside className="bz-left" aria-label="Étapes de construction">
          <nav className="bz-steps" aria-label="Étapes">
            <div className="bz-track" aria-hidden="true"><i style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }} /></div>
            {STEPS.map((s, i) => (
              <button key={s.id} className={`${step === s.id ? "on" : ""} ${i < stepIndex ? "done" : ""}`} onClick={() => setStep(s.id)} aria-current={step === s.id ? "step" : undefined} title={s.hint}>
                <span>{i < stepIndex ? "✓" : i + 1}</span>{s.label}
                {stepHasError(s.id, errors) && <i className="bz-err-dot" aria-label="Erreur" />}
              </button>
            ))}
          </nav>
          <div className="bz-step-head">
            <span className="eyebrow">Étape {stepIndex + 1} sur {STEPS.length}</span>
            <h2>{STEPS[stepIndex]!.label}</h2>
            <p className="hint">{STEPS[stepIndex]!.hint}</p>
          </div>

          {notice && (
            <div className={`alert flex ${notice.kind === "bad" ? "alert-bad" : "alert-info"} fade`} style={{ margin: "0 18px" }} role="alert">
              <span style={{ flex: 1 }}>{notice.text}</span>
              <button className="icon-btn" style={{ width: 26, height: 26, flexShrink: 0 }} onClick={() => setNotice(null)} aria-label="Fermer">✕</button>
            </div>
          )}

          <div className="bz-step-body" key={step}>
            {step === "type" && (
              <>
                <p className="hint">Le type définit les pages, les rôles et les briques de départ. En changeant de type, ton nom, ton design, tes couleurs, ton logo et tes fonctions compatibles sont gardés.</p>
                <div className="bz-types">
                  {TEMPLATES.map((t, i) => {
                    const locked = t.premium && !can(plan, "modelesPremium");
                    return (
                      <button key={t.id} aria-pressed={cfg.templateId === t.id} disabled={locked} onClick={() => changeType(t.id)} style={{ "--i": i } as React.CSSProperties}>
                        <span className="glyph" style={{ width: 36, height: 36, fontSize: 13 }}>{t.glyph}</span>
                        <span style={{ minWidth: 0 }}>
                          <b>{t.nom}</b>
                          <span className="tiny mut">{locked ? "🔒 Offre payante" : `${t.pages.length} pages · ${REVENUE_LABEL[t.revenu]}`}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="tile small"><b>{template.nom}</b> · {template.description}</div>
              </>
            )}

            {step === "design" && (
              <>
                <div className="bz-designs big">
                  {DESIGNS.map((d) => {
                    const locked = d.style !== "moderne" && !advanced;
                    return (
                      <button key={d.id} aria-pressed={cfg.design === d.id} disabled={locked} title={d.description}
                        onClick={() => { set({ design: d.id, style: d.style, couleurs: { ...d.couleurs }, police: d.police }); setView("prototype"); }}>
                        <span className="bz-design-sw" style={{ background: `linear-gradient(135deg, ${d.couleurs.primaire}, ${d.couleurs.accent})` }} />
                        <b>{d.nom}</b>
                        <span className="tiny mut">{locked ? "🔒 Offre payante" : `${SHELL_LABEL[d.shell]} · ${DASH_LABEL[d.dash]}`}</span>
                      </button>
                    );
                  })}
                </div>
                {design ? (
                  <div className="bz-spec fade" key={design.id}>
                    <b>{design.nom}</b>
                    <p className="tiny mut">{design.description}</p>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="badge badge-line">{SHELL_LABEL[design.shell]}</span>
                      <span className="badge badge-line">{DASH_LABEL[design.dash]}</span>
                      <span className="badge badge-line">{ANIM_LABEL[design.anim]}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => goPage(pages.find((p) => p.kind === "dashboard" || p.id === "app")?.id ?? "accueil")}>Voir son tableau de bord</button>
                  </div>
                ) : <p className="hint">Aucun design choisi : l&apos;apparence vient du style visuel. Choisis un design pour changer aussi le menu, le tableau de bord et les animations.</p>}
                <p className="hint">Changer de design garde tes textes, tes pages et tes fonctions. Les couleurs et la police reviennent à celles du design : tu peux les rajuster à l&apos;étape suivante. <a href="/modeles" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Comparer les designs en grand ↗</a></p>
              </>
            )}

            {step === "perso" && (
              <>
                <Section title="Identité" open>
                  <Field label="Nom du produit" error={errors.nom}>
                    <input className="input" value={cfg.nom} maxLength={40} onChange={(e) => set({ nom: e.target.value, initiales: cfg.initiales === initialsOf(cfg.nom) ? initialsOf(e.target.value) : cfg.initiales }, "nom")} aria-invalid={!!errors.nom} />
                  </Field>
                  <Field label="Description" error={errors.description} hint={`${cfg.description.length}/220`}>
                    <textarea className="input" value={cfg.description} maxLength={220} onChange={(e) => set({ description: e.target.value }, "description")} />
                  </Field>
                  <Field label="Public cible" error={errors.cible} hint="Utilisé dans les textes de la page de vente.">
                    <input className="input" value={cfg.cible} maxLength={120} placeholder="Ex. : coiffeurs indépendants" onChange={(e) => set({ cible: e.target.value }, "cible")} />
                  </Field>
                  <div className="row" style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
                    <Field label="Initiales" error={errors.initiales}>
                      <input className="input" value={cfg.initiales} maxLength={3} style={{ width: 90 }} onChange={(e) => set({ initiales: e.target.value.toUpperCase() }, "initiales")} />
                    </Field>
                    <div className="field" style={{ flex: 1 }}>
                      <span className="label">Logo {advanced ? "" : <span className="badge badge-coral">Offre payante</span>}</span>
                      <div className="row" style={{ gap: 8 }}>
                        <label className={`btn btn-ghost btn-sm ${advanced ? "" : "is-disabled"}`} aria-disabled={!advanced}>
                          Importer une image
                          <input type="file" accept="image/*" className="sr-only" disabled={!advanced} onChange={onLogo} />
                        </label>
                        {cfg.logo && <button className="btn btn-ghost btn-sm" onClick={() => set({ logo: "" })}>Retirer</button>}
                      </div>
                    </div>
                  </div>
                  {errors.logo && <span className="err" role="alert">{errors.logo}</span>}
                  <div className="field">
                    <span className="label">Générer un logo</span>
                    <div className="bz-logos">
                      {(Object.keys(LOGO_FORMES) as LogoForme[]).map((f) => {
                        const src = logoFor(cfg, f);
                        return (
                          <button key={f} onClick={() => { set({ logo: src }); toast("Logo appliqué"); }} aria-pressed={cfg.logo === src} title={LOGO_FORMES[f]} aria-label={`Logo ${LOGO_FORMES[f]}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" width={44} height={44} />
                          </button>
                        );
                      })}
                    </div>
                    <span className="hint">Créé à partir de tes initiales et de tes couleurs.</span>
                  </div>
                  <Field label="Nom de domaine souhaité" error={errors.domaine} hint="Décollage ne réserve aucun domaine : vérifie sa disponibilité auprès d'un registraire.">
                    <input className="input" value={cfg.domaine} placeholder="monprojet.fr" onChange={(e) => set({ domaine: e.target.value.trim().toLowerCase() }, "domaine")} aria-invalid={!!errors.domaine} />
                  </Field>
                </Section>

                <Section title="Couleurs et typographie">
                  <ColorField label="Couleur principale" value={cfg.couleurs.primaire} onChange={(c) => set({ couleurs: { ...cfg.couleurs, primaire: c } }, "c1")} />
                  <ColorField label="Couleur d'accent" value={cfg.couleurs.accent} onChange={(c) => set({ couleurs: { ...cfg.couleurs, accent: c } }, "c2")} />
                  {errors.couleurs && <span className="err" role="alert">{errors.couleurs}</span>}
                  <div className="field">
                    <span className="label">Police</span>
                    <div className="bz-fonts">
                      {(Object.keys(POLICES) as Police[]).map((k) => (
                        <button key={k} aria-pressed={(cfg.police ?? "systeme") === k} onClick={() => set({ police: k })} style={{ fontFamily: POLICES[k].famille }}>
                          <span style={{ fontSize: 20, fontWeight: 700 }}>Aa</span>
                          <span className="tiny">{POLICES[k].nom}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span className="label">Style des composants</span>
                    <div className="bz-styles">
                      {(Object.keys(STYLE_PRESETS) as VisualStyle[]).map((s) => {
                        const locked = s !== "moderne" && !advanced;
                        return (
                          <button key={s} className={`bz-style s-${s}`} aria-pressed={cfg.style === s} disabled={locked} onClick={() => set({ style: s })}>
                            <span className="bz-style-prev" style={{ "--p": cfg.couleurs.primaire, "--a": cfg.couleurs.accent } as React.CSSProperties}><i /><i /><i /></span>
                            <b>{STYLE_PRESETS[s].nom}</b>
                            {locked && <span className="tiny mut">🔒 Offre payante</span>}
                          </button>
                        );
                      })}
                    </div>
                    <span className="hint">{STYLE_PRESETS[cfg.style].description}</span>
                  </div>
                </Section>

                <Section title="Textes de la page de vente">
                  <Field label="Titre principal" hint={texts ? "Modifié à la main." : "Rédigé automatiquement : il suit le nom et la description."}>
                    <input className="input" value={shownTexts.titre} maxLength={200} onChange={(e) => { setText({ titre: e.target.value }); setView("landing"); }} />
                  </Field>
                  <Field label="Sous-titre">
                    <textarea className="input" value={shownTexts.texte} maxLength={600} onChange={(e) => { setText({ texte: e.target.value }); setView("landing"); }} />
                  </Field>
                  <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <Field label="Bouton principal"><input className="input" value={shownTexts.bp} maxLength={60} onChange={(e) => { setText({ bp: e.target.value }); setView("landing"); }} /></Field>
                    <Field label="Bouton secondaire"><input className="input" value={shownTexts.bs} maxLength={60} onChange={(e) => { setText({ bs: e.target.value }); setView("landing"); }} /></Field>
                  </div>
                  {texts && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setTexts(null)}>Annuler mes changements de textes</button>}
                </Section>

                <Section title="Pages et rôles">
                  {arch.id !== "classic" ? (
                    <div className="stack" style={{ gap: 8 }}>
                      <div className="alert alert-info small"><b>Architecture « {arch.nom} »</b> : {arch.description} Le site public et les écrans suivent le type de SaaS ; les briques actives ajoutent leurs pages.</div>
                      {pages.map((p) => (
                        <button key={p.id} className="bz-mod row between" style={{ flexWrap: "nowrap", textAlign: "left" }} onClick={() => goPage(p.id)}>
                          <span><b style={{ fontSize: 14.5 }}>{p.titre}</b> <span className="tiny mut">· {String(p.kind).startsWith("site-") ? "site public" : "espace utilisateur"}</span></span>
                          <span className="tiny mut">Voir →</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    {template.pages.map((p) => {
                      const on = p.id === "accueil" || cfg.pages[p.id] !== false;
                      return (
                        <label key={p.id} className="bz-mod row between" style={{ flexWrap: "nowrap", cursor: "pointer" }}>
                          <span><b style={{ fontSize: 14.5 }}>{p.titre}</b>{p.id === "accueil" && <span className="tiny mut"> · toujours présente</span>}</span>
                          <input type="checkbox" className="switch" checked={on} disabled={p.id === "accueil"} onChange={() => set({ pages: { ...cfg.pages, [p.id]: !on } })} aria-label={p.titre} />
                        </label>
                      );
                    })}
                  </div>
                  )}
                  <div className="stack" style={{ gap: 8 }}>
                    <span className="label">Types d&apos;utilisateurs</span>
                    {cfg.roles.map((r, i) => (
                      <div key={i} className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                        <input className="input" value={r} maxLength={30} aria-label={`Rôle ${i + 1}`} onChange={(e) => set({ roles: cfg.roles.map((x, j) => (j === i ? e.target.value : x)) }, `role${i}`)} />
                        <button className="icon-btn" disabled={cfg.roles.length <= 1} onClick={() => set({ roles: cfg.roles.filter((_, j) => j !== i) })} aria-label={`Supprimer le rôle ${r}`}>✕</button>
                      </div>
                    ))}
                    {errors.roles && <span className="err" role="alert">{errors.roles}</span>}
                    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={cfg.roles.length >= 6} onClick={() => set({ roles: [...cfg.roles, "Nouveau rôle"] })}>+ Ajouter un rôle</button>
                  </div>
                </Section>

                <Section title="Revenus">
                  <Field label="Modèle de revenus" hint="Certaines briques imposent un modèle compatible.">
                    <select className="input" value={cfg.revenu} onChange={(e) => apply(setRevenue(cfg, e.target.value as Revenue))}>
                      {(Object.keys(REVENUE_LABEL) as Revenue[]).map((r) => <option key={r} value={r}>{REVENUE_LABEL[r]}</option>)}
                    </select>
                  </Field>
                  <Field label={cfg.revenu === "paiement-unique" ? "Prix (paiement unique, €)" : cfg.revenu === "commission" ? "Prix de l'offre Pro (€ / mois)" : "Prix envisagé (€ / mois)"} error={errors.prix}>
                    <input className="input" type="number" min={0} max={10000} step="0.5" value={cfg.prix} disabled={cfg.revenu === "gratuit"} onChange={(e) => set({ prix: Number(e.target.value) }, "prix")} aria-invalid={!!errors.prix} />
                  </Field>
                  <p className="hint">Le détail des offres et les scénarios de revenus sont dans le <Link href={`/projets/${project.id}?onglet=prix`} style={{ textDecoration: "underline" }}>laboratoire des prix</Link>.</p>
                </Section>
              </>
            )}

            {step === "fonctions" && (
              <>
                <div className="alert alert-info small">Dans l&apos;aperçu, chaque brique fonctionne avec des données d&apos;exemple. Pour un vrai SaaS en ligne, certaines demandent un service externe : c&apos;est indiqué sur chacune.</div>
                {GROUPS.map((g) => (
                  <div key={g} className="stack" style={{ gap: 8 }}>
                    <span className="label">{g}</span>
                    {MODULES.filter((m) => m.groupe === g).map((m) => {
                      const on = cfg.modules.includes(m.id);
                      const required = template.modules.requis.includes(m.id);
                      const usedBy = on ? dependents(cfg.modules, m.id) : [];
                      const deps = dependencies(m.id);
                      const conflit = m.conflits.find((c) => cfg.modules.includes(c));
                      const badRev = m.revenusIncompatibles.includes(cfg.revenu);
                      const ext = EXTERNE[m.id];
                      return (
                        <div key={m.id} className={`bz-mod ${on ? "on" : ""}`}>
                          <label className="row between" style={{ flexWrap: "nowrap", cursor: required ? "not-allowed" : "pointer" }}>
                            <span>
                              <b style={{ fontSize: 14.5 }}>{m.nom}</b>
                              {required && <span className="badge badge-dark" style={{ marginLeft: 6 }}>Requis</span>}
                              <span className="tiny mut" style={{ display: "block" }}>{m.description}</span>
                              {deps.length > 0 && <span className="tiny mut" style={{ display: "block" }}>Nécessite : {deps.map((d) => MODULE_BY_ID[d].nom).join(", ")}</span>}
                              {usedBy.length > 0 && <span className="tiny" style={{ display: "block", color: "var(--blue-ink)" }}>Utilisée par : {usedBy.map((d) => MODULE_BY_ID[d].nom).join(", ")}</span>}
                              {!on && conflit && <span className="tiny" style={{ display: "block", color: "var(--bad)" }}>Incompatible avec « {MODULE_BY_ID[conflit].nom} »</span>}
                              {!on && badRev && <span className="tiny" style={{ display: "block", color: "var(--bad)" }}>Incompatible avec le modèle « {REVENUE_LABEL[cfg.revenu]} »</span>}
                              <span className="bz-state">
                                <span className="badge badge-ok">Aperçu : simulé</span>
                                {ext ? <span className="badge badge-warn" title="À brancher pour la mise en ligne">En vrai : {ext}</span> : <span className="badge badge-line">Rien à brancher</span>}
                              </span>
                            </span>
                            <input type="checkbox" className="switch" checked={on} disabled={required} onChange={() => apply(on ? disableModule(cfg, m.id) : enableModule(cfg, m.id))} aria-label={m.nom} />
                          </label>
                          {on && m.reglages.map((r) => (
                            <div key={r.id} className="field fade" style={{ marginTop: 10 }}>
                              <label htmlFor={r.id} className="tiny">{r.label}</label>
                              <select id={r.id} className="input" value={cfg.reglages[r.id] ?? r.options[0]} onChange={(e) => set({ reglages: { ...cfg.reglages, [r.id]: e.target.value } })}>
                                {r.options.map((o) => <option key={o}>{o}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {arch.id === "classic" && <div className="stack" style={{ gap: 8 }}>
                  <span className="label">Pages en plus</span>
                  {(Object.keys(EXTRA_PAGES) as ExtraKind[]).map((k) => {
                    const on = (cfg.extras ?? []).includes(k);
                    return (
                      <label key={k} className={`bz-mod row between ${on ? "on" : ""}`} style={{ flexWrap: "nowrap", cursor: "pointer" }}>
                        <span><b style={{ fontSize: 14.5 }}>{EXTRA_PAGES[k].titre}</b><span className="tiny mut" style={{ display: "block" }}>Page ajoutée au menu, avec les données de ton SaaS.</span></span>
                        <input type="checkbox" className="switch" checked={on} onChange={() => { set({ extras: on ? (cfg.extras ?? []).filter((x) => x !== k) : [...(cfg.extras ?? []), k] }); if (!on) goPage(EXTRA_PAGES[k].id); }} aria-label={EXTRA_PAGES[k].titre} />
                      </label>
                    );
                  })}
                </div>}
                {errors.modules && <div className="alert alert-bad">{errors.modules}</div>}
              </>
            )}

            {step === "verif" && (
              <>
                {errList.length ? (
                  <div className="alert alert-bad">
                    <b>{errList.length} point{errList.length > 1 ? "s" : ""} à corriger avant d&apos;enregistrer</b>
                    <ul className="list" style={{ marginTop: 8 }}>{errList.map(([k, v]) => <li key={k}><span>{v} <button className="bz-link" onClick={() => setStep(stepOfError(k))}>Corriger →</button></span></li>)}</ul>
                  </div>
                ) : <div className="alert alert-ok">✓ Configuration valide : tout est prêt à être enregistré.</div>}
                <dl className="bz-recap">
                  <RecapRow label="Type" value={template.nom} go={() => setStep("type")} />
                  <RecapRow label="Design" value={design ? `${design.nom} · ${SHELL_LABEL[design.shell]}` : "Style seul"} go={() => setStep("design")} />
                  <RecapRow label="Nom" value={cfg.nom || "—"} go={() => setStep("perso")} />
                  <RecapRow label="Couleurs" value={<span className="row" style={{ gap: 6 }}><i className="bz-dot" style={{ background: cfg.couleurs.primaire }} /><i className="bz-dot" style={{ background: cfg.couleurs.accent }} />{POLICES[cfg.police ?? "systeme"].nom}</span>} go={() => setStep("perso")} />
                  <RecapRow label="Revenus" value={`${REVENUE_LABEL[cfg.revenu]}${cfg.revenu === "gratuit" ? "" : ` · ${cfg.prix} €`}`} go={() => setStep("perso")} />
                  <RecapRow label={`Pages (${pages.length})`} value={pages.map((p) => p.titre).join(", ")} go={() => setStep("perso")} />
                  <RecapRow label={`Briques (${cfg.modules.length})`} value={cfg.modules.map((m) => MODULE_BY_ID[m].nom).join(", ")} go={() => setStep("fonctions")} />
                </dl>
                <div className="tile small">
                  <b>Ce que tu as réellement</b>
                  <div className="kv"><span>1 · Prototype interactif</span><span className="badge badge-ok">Oui</span></div>
                  <div className="kv"><span>2 · Projet exportable</span><span className="badge badge-ok">Oui</span></div>
                  <div className="kv"><span>3 · Application déployée</span><span className="badge badge-line">À faire</span></div>
                  <p className="tiny mut" style={{ marginTop: 8 }}>
                    À brancher pour un vrai SaaS : {[...new Set(cfg.modules.map((m) => EXTERNE[m]).filter(Boolean))].join(" ; ") || "rien de plus que l'hébergement"}.{" "}
                    <Link href={`/projets/${project.id}?onglet=production`} style={{ textDecoration: "underline" }}>Guide de mise en production</Link>
                  </p>
                </div>
                <button className="btn btn-coral btn-lg" onClick={save} disabled={!dirty || !valid}>{dirty ? "Enregistrer le projet" : "✓ Projet enregistré"}</button>
                {!dirty && <Link href={`/projets/${project.id}/site`} className="btn btn-ghost">Voir mon SaaS en grand <span className="arrow">→</span></Link>}
              </>
            )}
          </div>

          <div className="bz-step-nav">
            <button className="btn btn-ghost btn-sm" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1]!.id)}>← Précédent</button>
            {stepIndex < STEPS.length - 1
              ? <button className="btn btn-sm" onClick={() => setStep(STEPS[stepIndex + 1]!.id)}>{STEPS[stepIndex + 1]!.label} →</button>
              : <button className="btn btn-sm btn-coral" onClick={save} disabled={!dirty}>Enregistrer</button>}
          </div>
        </aside>

        {/* Centre : aperçu sans clignotement */}
        <section className="bz-center" aria-label="Aperçu">
          <div className="bz-pages" role="tablist" aria-label="Pages du prototype">
            {pages.map((p) => (
              <button key={p.id} role="tab" aria-selected={currentPage === p.id && view === "prototype"} onClick={() => goPage(p.id)}>{p.titre}</button>
            ))}
          </div>
          <div className={`device ${device}`} style={{ height: device === "mobile" ? "min(760px, calc(100vh - 200px))" : "calc(100vh - 186px)" }}>
            <div className="device-bar"><i /><i /><i /><span className="url">{cfg.domaine || `${slug(cfg.nom)}.exemple`} · {view === "prototype" ? `application / ${pages.find((p) => p.id === currentPage)?.titre ?? ""}` : "page de vente"}</span></div>
            <LivePreview html={srcDoc} title={view === "prototype" ? "Aperçu de l'application" : "Aperçu de la page de vente"} onPage={setPage} />
          </div>
        </section>
      </div>

      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { h.commit(defaultConfig(cfg.templateId, project.ideaId ? IDEA_BY_ID[project.ideaId] : undefined)); setNotice(null); toast("Type réinitialisé — annulable avec ↶"); }}
        title="Réinitialiser le type de SaaS ?"
        text={`Toutes les personnalisations reviennent aux valeurs du type « ${template.nom} ». Tu pourras annuler avec le bouton ↶ tant que tu n'as pas quitté la page.`}
        cta="Réinitialiser"
        danger
      />
    </div>
  );
}

const ERR_STEP: Record<string, StepId> = { templateId: "type", design: "design", style: "design", police: "perso", modules: "fonctions", extras: "fonctions" };
const stepOfError = (k: string): StepId => ERR_STEP[k] ?? "perso";

function stepHasError(step: StepId, e: Record<string, string>) {
  return Object.keys(e).some((k) => stepOfError(k) === step);
}

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="bz-sec" open={open}>
      <summary>{title}</summary>
      <div className="bz-sec-body">{children}</div>
    </details>
  );
}

function RecapRow({ label, value, go }: { label: string; value: React.ReactNode; go: () => void }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <button className="bz-link" onClick={go} aria-label={`Modifier : ${label}`}>Modifier</button>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  // Le libellé est relié au champ (htmlFor/id), et l'erreur ou l'aide est lue avec lui (aria-describedby).
  const id = useId();
  const noteId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const isControl = isValidElement(children) && (children.type === "input" || children.type === "select" || children.type === "textarea");
  const control = isControl ? cloneElement(children as React.ReactElement<Record<string, unknown>>, { id, "aria-describedby": noteId, ...(error ? { "aria-invalid": true } : {}) }) : children;
  return (
    <div className="field" style={{ flex: 1 }}>
      <label htmlFor={isControl ? id : undefined}>{label}</label>
      {control}
      {error ? <span id={noteId} className="err" role="alert">{error}</span> : hint ? <span id={noteId} className="hint">{hint}</span> : null}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="row" style={{ gap: 10 }}>
        <div className="swatches" role="group" aria-label={label}>
          {SWATCHES.map((c) => <button key={c} className="swatch" style={{ background: c }} aria-pressed={value.toLowerCase() === c} aria-label={c} onClick={() => onChange(c)} />)}
        </div>
        <label className="bz-color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} personnalisée`} />
          <span className="tiny">{value}</span>
        </label>
      </div>
    </div>
  );
}
