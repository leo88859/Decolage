import { IDEAS } from "@/data/ideas";
import { limiteLabel, PAID_PLANS, PLANS } from "@/lib/plans";
import type { Plan } from "@/lib/types";

const ALL: Plan[] = ["gratuit", ...PAID_PLANS];
const prix = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0 });

/** Ce que comprend chaque formule, calculé depuis plans.ts (aucun texte en dur sur les limites). */
function features(k: Plan): { ok: boolean; t: string }[] {
  const p = PLANS[k];
  return [
    ...(k === "gratuit" ? [{ ok: true, t: "Aperçu de ton SaaS dans les 10 designs" }] : []),
    { ok: true, t: `Catalogue de ${IDEAS.length} idées` },
    { ok: p.maxProjets > 0, t: p.maxProjets === 0 ? "Générer et garder ton SaaS" : p.maxProjets === Infinity ? "SaaS illimités" : limiteLabel(p.maxProjets, "SaaS généré", "SaaS générés") },
    { ok: p.maxSites > 0, t: p.maxSites === 0 ? "Mise en ligne" : `Mise en ligne : ${limiteLabel(p.maxSites, "site", "sites")}` },
    { ok: p.maxSites > 0, t: "Vraie liste d'attente" },
    { ok: p.modelesPremium, t: "Les 16 modèles" },
    { ok: p.personnalisationAvancee, t: "Thèmes, logo importé, mises en page" },
    { ok: p.exportFichiers, t: "Export des fichiers" },
    { ok: p.duplication, t: "Duplication de projets" },
  ];
}

/** Cartes des formules. `cta(plan)` fournit le bouton de chaque carte ; `current` met en avant la formule active. */
export function OfferCards({ cta, current, highlight = "pro", plans = ALL }: { cta: (plan: Plan) => React.ReactNode; current?: Plan; highlight?: Plan; plans?: readonly Plan[] }) {
  return (
    <div className={`offers4 n${plans.length}`}>
      {plans.map((k) => {
        const p = PLANS[k];
        const hl = k === highlight;
        return (
          <div key={k} className={`offer4 ${hl ? "hl" : ""} ${current === k ? "current" : ""}`}>
            {hl && <span className="offer4-pop">Recommandé</span>}
            <div className="row between"><h3>{p.nom}</h3>{current === k && <span className="badge badge-ok">Ta formule</span>}</div>
            <div className="offer4-price">{prix(p.prix)} €<span>{p.prix ? " / mois" : ""}</span></div>
            <p className="offer4-acc">{p.accroche}</p>
            <ul>{features(k).map((f) => <li key={f.t} className={f.ok ? "" : "off"}>{f.t}</li>)}</ul>
            <div style={{ marginTop: "auto" }}>{cta(k)}</div>
          </div>
        );
      })}
    </div>
  );
}
