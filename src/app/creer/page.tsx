"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useMemo, useRef, useState } from "react";
import { DesignThumb, showcasePage, type IdeeInput } from "@/components/DesignThumb";
import { toast } from "@/components/ui";
import { DESIGN_BY_ID, designFor, DESIGNS, type DesignDef } from "@/data/designs";
import { FONCTIONS } from "@/lib/fonctions";
import { SECTEUR_BY_ID, SECTEUR_GENERAL, SECTEURS } from "@/data/secteurs";
import { TEMPLATE_BY_ID, TEMPLATES } from "@/data/templates";
import { slug } from "@/lib/export";
import { renderLanding } from "@/lib/landing";
import { canCreateProject, PLANS, planForProjects } from "@/lib/plans";
import { newProjectFromIdee } from "@/lib/project";
import { renderPrototype } from "@/lib/prototype";
import { analyse } from "@/lib/remplissage";
import { createProjectFromIdee, useData } from "@/lib/store";
import type { TemplateId } from "@/lib/types";

const EXEMPLES = [
  "Une appli pour que les clients d'un coiffeur réservent en ligne",
  "Je vends des bougies faites main et je veux une boutique",
  "Suivre mon budget et mes dépenses d'étudiant",
  "Des cours de guitare en ligne pour débutants",
  "Un outil pour que les artisans fassent leurs devis vite",
  "Une carte de fidélité pour les snacks et cafés",
];

const EPOCH = new Date("2026-01-01T09:00:00Z");
const MIN = 8;

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Creer />
    </Suspense>
  );
}

function Creer() {
  const params = useSearchParams();
  const router = useRouter();
  const { plan, projects } = useData();
  const [text, setText] = useState(params.get("q") ?? "");
  const [typeChoice, setTypeChoice] = useState<TemplateId | "">("");
  const [secteurChoice, setSecteurChoice] = useState("");
  const [name, setName] = useState<string | null>(null);
  // Un design peut être choisi d'avance depuis la galerie (/creer?design=…).
  const [designChoice, setDesign] = useState<string | null>(() => { const d = params.get("design"); return d && DESIGN_BY_ID[d] ? d : null; });
  const [fx, setFx] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"app" | "landing">("app");
  const [busy, setBusy] = useState(false);
  const gallery = useRef<HTMLElement>(null);

  const idee = useDeferredValue(text.trim());
  const ready = idee.length >= MIN;
  const a = useMemo(() => analyse(idee), [idee]);
  const type = typeChoice || a.type;
  const secteur = secteurChoice ? (SECTEUR_BY_ID[secteurChoice] ?? SECTEUR_GENERAL) : a.secteur;
  const nom = (name ?? a.noms[0] ?? "Mon SaaS").slice(0, 40);
  const deferredNom = useDeferredValue(nom);

  const design = designChoice ?? designFor(type, secteur.id).id;
  // Fonctions : celles repérées dans le texte sont cochées d'office, chacune reste modifiable.
  const fonctions = FONCTIONS.filter((f) => fx[f.id] ?? a.fonctions.includes(f.id)).map((f) => f.id);
  const fkey = fonctions.join(",");
  const template = TEMPLATE_BY_ID[type];
  const chosen = DESIGNS.find((d) => d.id === design) ?? DESIGNS[0]!;
  // Tout s'essaie gratuitement ; générer (et garder) le SaaS demande une offre payante.
  const free = plan === "gratuit";
  const full = !free && !canCreateProject(plan, projects.length);
  const locked = free || full;
  const retour = `/parametres?retour=${encodeURIComponent(`/creer?q=${idee}`)}#formule`;

  const input = (d: string): IdeeInput => ({ idee: idee || "Mon SaaS", type, secteur: secteur.id, nom: deferredNom || "Mon SaaS", design: d, fonctions });
  const preview = useMemo(() => {
    if (!ready) return "";
    const p = newProjectFromIdee({ idee: idee || "Mon SaaS", type, secteur: secteur.id, nom: deferredNom || "Mon SaaS", design, fonctions: fkey ? fkey.split(",") : [] }, EPOCH);
    return view === "app"
      ? renderPrototype(p.config, showcasePage(p), p.contenu)
      : renderLanding(p.config, p.landing, p.pricing.offres.length ? p.pricing : null, { inlineCss: true, contenu: p.contenu });
  }, [ready, idee, type, secteur.id, deferredNom, design, view, fkey]); // eslint-disable-line react-hooks/preserve-manual-memoization

  function generate() {
    if (locked) return;
    setBusy(true);
    const r = createProjectFromIdee({ idee, type, secteur: secteur.id, nom, design, fonctions });
    if (!r.ok) {
      setBusy(false);
      toast(r.error, "error");
      return;
    }
    router.push(`/projets/${r.id}/site?nouveau=1`);
  }

  return (
    <main className="page">
      <div className="container">
        {/* 1 · L'idée */}
        <section className="cr-intro">
          <span className="eyebrow">Étape 1 · Ton idée</span>
          <h1 className="h-page" style={{ margin: "12px 0 10px" }}>Décris ton SaaS, <span className="serif" style={{ color: "var(--coral-ink)" }}>on remplit tout</span></h1>
          <p className="mut">Pour qui, quel problème il règle et les fonctions que tu veux (paiement, rappels, carte, messagerie…). Le moteur Décollage reconnaît le type de produit, le métier et les fonctions, puis assemble pages, données, textes et design.</p>
        </section>

        <div className="cr-box">
          <textarea
            className="cr-input"
            autoFocus
            value={text}
            maxLength={400}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex. : une appli pour que les clients d'un coiffeur réservent leur rendez-vous en ligne"
            aria-label="Décris ton idée"
          />
          <div className="row between" style={{ padding: "0 16px 12px" }}>
            <span className="tiny mut">{ready ? "Analyse faite sur ton texte, en direct." : `Encore ${Math.max(0, MIN - text.trim().length)} caractère${MIN - text.trim().length > 1 ? "s" : ""} au moins.`}</span>
            <span className="tiny mut">{text.length}/400</span>
          </div>
        </div>
        {!ready && (
          <div className="row cr-ex">
            {EXEMPLES.map((e) => <button key={e} className="chip" onClick={() => setText(e)}>{e}</button>)}
          </div>
        )}

        {ready && (
          <>
            {/* Ce qui a été compris, modifiable */}
            <section className="cr-found fade" aria-live="polite">
              <div className="cr-field">
                <span className="label">Type de SaaS</span>
                <select className="input" aria-label="Type de SaaS" value={typeChoice} onChange={(e) => setTypeChoice(e.target.value as TemplateId | "")}>
                  <option value="">Détecté : {TEMPLATE_BY_ID[a.type].nom}</option>
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.nom}{t.premium ? " · offre payante" : ""}</option>)}
                </select>
              </div>
              <div className="cr-field">
                <span className="label">Métier ou secteur</span>
                <select className="input" aria-label="Métier ou secteur" value={secteurChoice} onChange={(e) => setSecteurChoice(e.target.value)}>
                  <option value="">Détecté : {a.secteur.nom}</option>
                  {[...SECTEURS, SECTEUR_GENERAL].map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div className="cr-field cr-name">
                <span className="label">Nom du SaaS</span>
                <input className="input" value={nom} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Nom du SaaS" />
                <div className="row" style={{ gap: 6 }}>
                  {a.noms.map((n) => <button key={n} className={`chip ${n === nom ? "on" : ""}`} onClick={() => setName(n)}>{n}</button>)}
                </div>
              </div>
              <div className="cr-field cr-name">
                <span className="label">Fonctions {a.fonctions.length > 0 && <span className="tiny mut" style={{ fontWeight: 500 }}>· {a.fonctions.length} repérée{a.fonctions.length > 1 ? "s" : ""} dans ton texte</span>}</span>
                <div className="row" style={{ gap: 6 }}>
                  {FONCTIONS.map((f) => {
                    const on = fonctions.includes(f.id);
                    const found = a.fonctions.includes(f.id);
                    return (
                      <button key={f.id} className={`chip cr-fx ${on ? "on" : ""}`} aria-pressed={on} title={found ? "Repérée dans ton texte" : undefined} onClick={() => setFx({ ...fx, [f.id]: !on })}>
                        {on ? "✓ " : "+ "}{f.label}{found && <i className="cr-dot" aria-label="repérée" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!a.sure && !typeChoice && !secteurChoice && (
                <p className="tiny mut cr-hint">Pas sûr d&apos;avoir bien compris : vérifie le type et le secteur, ou ajoute un métier précis (coiffeur, coach, restaurant…).</p>
              )}
            </section>

            {/* 2 · Les designs */}
            <section ref={gallery} style={{ marginTop: 44 }}>
              <div className="row between" style={{ alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <span className="eyebrow">Étape 2 · Le design</span>
                  <h2 className="h-sec" style={{ marginTop: 8 }}>10 designs, chacun avec son tableau de bord et ses animations</h2>
                </div>
                <span className="mut small">{designChoice ? "Chaque aperçu montre ton SaaS, avec tes données." : <>Choisi d&apos;office pour ton métier : <b>{chosen.nom}</b>. Tu peux en changer.</>}</span>
              </div>
              <div className="cr-grid">
                {DESIGNS.map((d, i) => (
                  <DesignCard key={d.id} d={d} i={i} on={d.id === design} input={input(d.id)} onPick={() => setDesign(d.id)} />
                ))}
              </div>
            </section>

            {/* 3 · Aperçu interactif et génération */}
            <section className="cr-final">
              <div className="row between" style={{ marginBottom: 14, alignItems: "flex-end" }}>
                <div>
                  <span className="eyebrow">Étape 3 · Essaie-le</span>
                  <h2 className="h-sec" style={{ marginTop: 8 }}>{nom} · design {chosen.nom}</h2>
                  <p className="mut small" style={{ marginTop: 4 }}>{chosen.description}</p>
                </div>
                <div className="seg" role="group" aria-label="Vue">
                  <button aria-pressed={view === "app"} onClick={() => setView("app")}>Application</button>
                  <button aria-pressed={view === "landing"} onClick={() => setView("landing")}>Page de vente</button>
                </div>
              </div>
              <div className="device desktop cr-device">
                <div className="device-bar"><i /><i /><i /><span className="url">{slug(nom)}.exemple · aperçu</span></div>
                <iframe title="Aperçu interactif" srcDoc={preview} sandbox="allow-scripts allow-forms" />
              </div>
            </section>
            {/* Toujours visible en bas d'écran : un clic suffit, les étapes 2 et 3 sont facultatives. */}
              <div className="cr-go">
                <div>
                  <b>{free ? "Ton SaaS te plaît ? Garde-le." : full ? "Limite de projets atteinte" : "Tout est prêt à être généré"}</b>
                  <p className="tiny mut">
                    {free
                      ? `Dès ${PLANS.solo.prix.toLocaleString("fr-FR")} €/mois : ton SaaS généré, modifiable et publiable en ligne avec une vraie liste d'attente. Sans engagement.`
                      : full
                        ? `Ta formule ${PLANS[plan].nom} permet ${PLANS[plan].maxProjets} projet${PLANS[plan].maxProjets > 1 ? "s" : ""}. Supprime un projet ou passe à ${PLANS[planForProjects(projects.length + 1)].nom}.`
                        : `${template.nom} · ${secteur.nom} · design ${chosen.nom}${fonctions.length ? ` · ${fonctions.length} fonction${fonctions.length > 1 ? "s" : ""}` : ""}. Tout reste modifiable ensuite.`}
                  </p>
                </div>
                {locked ? (
                  <Link href={retour} className="btn btn-coral btn-lg">
                    {free ? "Choisir mon offre et générer" : `Passer à ${PLANS[planForProjects(projects.length + 1)].nom}`} <span className="arrow">→</span>
                  </Link>
                ) : (
                  <button className="btn btn-coral btn-lg" onClick={generate} disabled={busy}>
                    {busy ? "Génération…" : "Générer mon SaaS"} <span className="arrow">→</span>
                  </button>
                )}
              </div>
          </>
        )}

        <p className="center mut small" style={{ marginTop: 34 }}>
          Pas encore d&apos;idée ? <Link href="/idees" style={{ textDecoration: "underline" }}>Parcours les idées du catalogue</Link> ou <Link href="/nouveau" style={{ textDecoration: "underline" }}>pars d&apos;un type de SaaS</Link>.
        </p>
      </div>
      <style>{STYLE}</style>
    </main>
  );
}

function DesignCard({ d, i, on, input, onPick }: { d: DesignDef; i: number; on: boolean; input: IdeeInput; onPick: () => void }) {
  return (
    <button className={`cr-card ${on ? "on" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={onPick} aria-pressed={on}>
      <div className="cr-thumb">
        <DesignThumb input={input} />
        {on && <span className="cr-check">✓</span>}
      </div>
      <div className="cr-meta">
        <span className="cr-sw" style={{ background: `linear-gradient(135deg, ${d.couleurs.primaire}, ${d.couleurs.accent})` }} />
        <span style={{ minWidth: 0 }}>
          <b>{d.nom}</b>
          <span className="tiny mut cr-tags">{d.tags.join(" · ")}</span>
        </span>
      </div>
    </button>
  );
}

const STYLE = `
.cr-intro{max-width:760px;margin:0 auto 26px;text-align:center}
.cr-box{max-width:820px;margin:0 auto;background:var(--paper);border:1.5px solid var(--line-2);border-radius:22px;box-shadow:var(--shadow-lg);transition:border-color .2s,box-shadow .2s}
.cr-box:focus-within{border-color:var(--blue);box-shadow:0 0 0 5px rgba(47,91,255,.14),var(--shadow-lg)}
.cr-input{width:100%;min-height:110px;border:0;outline:0;resize:vertical;background:none;padding:20px 20px 8px;font:500 19px/1.5 var(--body);color:var(--ink)}
.cr-input::placeholder{color:#a3a8bd}
.cr-ex{gap:8px;margin:14px auto 0;justify-content:center;max-width:900px}
.cr-found{max-width:820px;margin:22px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px;box-shadow:var(--shadow)}
.cr-field{display:grid;gap:6px;align-content:start}.cr-name{grid-column:1/-1}.cr-hint{grid-column:1/-1;margin:0}
.chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.cr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.cr-card{all:unset;box-sizing:border-box;cursor:pointer;display:grid;gap:10px;padding:8px;border-radius:20px;background:var(--paper);border:1.5px solid var(--line);box-shadow:var(--shadow);transition:transform .3s var(--ease),box-shadow .3s,border-color .2s;animation:fade .5s var(--ease) both;animation-delay:calc(var(--i) * 55ms)}
.cr-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.cr-card:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.cr-card.on{border-color:var(--coral);box-shadow:0 0 0 4px rgba(255,107,74,.18),var(--shadow-lg)}
.cr-thumb{position:relative;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:var(--cream-2);isolation:isolate}
.cr-thumb .dthumb{position:absolute;inset:0;aspect-ratio:auto}
.cr-check{position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:50%;background:var(--coral);color:var(--navy);display:grid;place-items:center;font-weight:800;animation:pop .35s var(--ease)}
.cr-meta{display:flex;gap:10px;align-items:center;padding:2px 6px 4px}
.cr-sw{width:26px;height:26px;border-radius:8px;flex-shrink:0}
.cr-meta b{display:block;font-size:15px}.cr-tags{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-final{margin-top:48px}
.cr-fx{position:relative;font-size:13px;padding:6px 12px}.cr-fx.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.cr-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--coral);margin-left:7px;vertical-align:1px;box-shadow:0 0 0 3px rgba(255,107,74,.2)}
.cr-device{height:min(760px,calc(100vh - 160px))}
.cr-go{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:18px;padding:18px 20px;border-radius:var(--r-lg);background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow-lg);position:sticky;bottom:14px;z-index:5}
@media(max-width:640px){.cr-found{grid-template-columns:1fr}.cr-grid{grid-template-columns:1fr 1fr;gap:10px}.cr-card{padding:5px;border-radius:14px}.cr-thumb{border-radius:10px}.cr-tags{display:none}.cr-device{height:560px}.cr-go .btn{width:100%;justify-content:center}}
`;
