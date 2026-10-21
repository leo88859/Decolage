import { archOf, screensFor, sitePagesFor } from "@/data/archetypes";
import { EXTRA_PAGES } from "@/data/extras";
import { MODULE_BY_ID, MODULES } from "@/data/modules";
import { TEMPLATE_BY_ID } from "@/data/templates";
import type { ArchPageKind, Config, ModuleId, PageDef, Revenue } from "@/lib/types";

export type Result = { ok: true; config: Config; ajoutes: ModuleId[]; retires: ModuleId[] } | { ok: false; raison: string };

const nom = (id: ModuleId) => MODULE_BY_ID[id].nom;
const liste = (ids: ModuleId[]) => ids.map((i) => `« ${nom(i)} »`).join(", ");

/** Dépendances d'un module, dans l'ordre (dépendances profondes d'abord), sans le module lui-même. */
export function dependencies(id: ModuleId, seen = new Set<ModuleId>()): ModuleId[] {
  const out: ModuleId[] = [];
  for (const d of MODULE_BY_ID[id].deps) {
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(...dependencies(d, seen), d);
  }
  return [...new Set(out)];
}

/** Modules actifs qui dépendent (directement ou non) de `id`. */
export function dependents(active: ModuleId[], id: ModuleId): ModuleId[] {
  return active.filter((m) => m !== id && dependencies(m).includes(id));
}

export function enableModule(cfg: Config, id: ModuleId): Result {
  if (cfg.modules.includes(id)) return { ok: true, config: cfg, ajoutes: [], retires: [] };
  const toAdd = [...dependencies(id).filter((d) => !cfg.modules.includes(d)), id];

  for (const m of toAdd) {
    const conflit = MODULE_BY_ID[m].conflits.find((c) => cfg.modules.includes(c));
    if (conflit) {
      const via = m === id ? "" : ` (nécessaire pour « ${nom(id)} »)`;
      return { ok: false, raison: `« ${nom(m)} »${via} est incompatible avec « ${nom(conflit)} ». Désactive d'abord « ${nom(conflit)} ».` };
    }
    if (MODULE_BY_ID[m].revenusIncompatibles.includes(cfg.revenu)) {
      return { ok: false, raison: `« ${nom(m)} » n'a pas de sens avec le modèle de revenus « ${REVENUE_LABEL[cfg.revenu]} ». Change d'abord le modèle de revenus.` };
    }
  }
  return { ok: true, config: { ...cfg, modules: [...cfg.modules, ...toAdd] }, ajoutes: toAdd.filter((m) => m !== id), retires: [] };
}

export function disableModule(cfg: Config, id: ModuleId): Result {
  if (!cfg.modules.includes(id)) return { ok: true, config: cfg, ajoutes: [], retires: [] };
  if (TEMPLATE_BY_ID[cfg.templateId].modules.requis.includes(id)) {
    return { ok: false, raison: `« ${nom(id)} » est indispensable au modèle « ${TEMPLATE_BY_ID[cfg.templateId].nom} ».` };
  }
  const using = dependents(cfg.modules, id);
  if (using.length) return { ok: false, raison: `« ${nom(id)} » est utilisé par ${liste(using)}. Désactive-les d'abord.` };
  return { ok: true, config: { ...cfg, modules: cfg.modules.filter((m) => m !== id) }, ajoutes: [], retires: [id] };
}

export function setRevenue(cfg: Config, revenu: Revenue): Result {
  const bloquants = cfg.modules.filter((m) => MODULE_BY_ID[m].revenusIncompatibles.includes(revenu));
  if (bloquants.length) return { ok: false, raison: `Le modèle « ${REVENUE_LABEL[revenu]} » est incompatible avec ${liste(bloquants)}.` };
  return { ok: true, config: { ...cfg, revenu, prix: revenu === "gratuit" ? 0 : cfg.prix }, ajoutes: [], retires: [] };
}

/** Problèmes de cohérence d'une configuration (utile après un import). */
export function moduleIssues(cfg: Config): string[] {
  const issues: string[] = [];
  const t = TEMPLATE_BY_ID[cfg.templateId];
  for (const r of t.modules.requis) if (!cfg.modules.includes(r)) issues.push(`Le module requis « ${nom(r)} » est absent.`);
  for (const m of cfg.modules) {
    const def = MODULE_BY_ID[m];
    if (!def) { issues.push(`Module inconnu : ${m}.`); continue; }
    for (const d of def.deps) if (!cfg.modules.includes(d)) issues.push(`« ${def.nom} » nécessite « ${nom(d)} ».`);
    for (const c of def.conflits) if (cfg.modules.includes(c) && m < c) issues.push(`« ${def.nom} » et « ${nom(c)} » sont incompatibles.`);
    if (def.revenusIncompatibles.includes(cfg.revenu)) issues.push(`« ${def.nom} » est incompatible avec le modèle « ${REVENUE_LABEL[cfg.revenu]} ».`);
  }
  return issues;
}

/** Pages d'un SaaS à architecture dédiée : site public utile au projet, puis écrans de l'espace utilisateur. */
export function archPages(cfg: Config): PageDef[] | null {
  if (archOf(cfg.templateId).id === "classic") return null;
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const site = sitePagesFor(cfg.revenu, cfg.modules.includes("auth")).map((p): PageDef => ({ id: p.id, titre: p.titre, kind: `site-${p.view}` as ArchPageKind, nav: true }));
  const pages = [...site, ...screensFor(cfg.templateId, t.entite).map((s): PageDef => ({ id: s.id, titre: s.titre, kind: s.view, nav: true }))];
  // Pages des briques qui ajoutent un vrai écran (l'architecture couvre déjà connexion, tarifs, ajout, détail, tableau de bord, paramètres).
  for (const m of MODULES) {
    if (!cfg.modules.includes(m.id)) continue;
    for (const p of m.pages) if (!ARCH_COVERED.has(p.kind) && !pages.some((x) => x.id === p.id)) pages.push(p);
  }
  return pages;
}
const ARCH_COVERED = new Set<string>(["connexion", "tarifs", "formulaire", "detail", "dashboard", "parametres"]);

/** Pages actives : architecture dédiée si le type en a une ; sinon pages du modèle (sauf désactivées) puis pages ajoutées par les modules. */
export function activePages(cfg: Config): PageDef[] {
  const arch = archPages(cfg);
  if (arch) return arch;
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const pages = t.pages.filter((p) => p.id === "accueil" || cfg.pages[p.id] !== false);
  for (const k of cfg.extras ?? []) if (EXTRA_PAGES[k] && !pages.some((x) => x.id === EXTRA_PAGES[k].id)) pages.push(EXTRA_PAGES[k]);
  for (const m of MODULES) {
    if (!cfg.modules.includes(m.id)) continue;
    for (const p of m.pages) if (!pages.some((x) => x.id === p.id)) pages.push(p);
  }
  return pages;
}

export const REVENUE_LABEL: Record<Revenue, string> = {
  gratuit: "Gratuit",
  abonnement: "Abonnement",
  "paiement-unique": "Paiement unique",
  freemium: "Freemium",
  commission: "Commission",
};
