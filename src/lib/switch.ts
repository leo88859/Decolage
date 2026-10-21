import { MODULE_BY_ID } from "@/data/modules";
import { defaultConfig } from "@/lib/config";
import { enableModule, setRevenue } from "@/lib/modules";
import type { Config, TemplateId } from "@/lib/types";

/**
 * Change le type de SaaS sans perdre les personnalisations compatibles : identité, apparence,
 * domaine, pages ajoutées, briques optionnelles, modèle de revenus et réglages connus du nouveau type.
 * Renvoie aussi ce qui n'a pas pu être gardé, pour le dire à l'utilisateur.
 */
export function switchTemplate(cfg: Config, id: TemplateId): { config: Config; perdus: string[] } {
  if (cfg.templateId === id) return { config: cfg, perdus: [] };
  const base = defaultConfig(id);
  let next: Config = {
    ...base,
    nom: cfg.nom, description: cfg.description, cible: cfg.cible, couleurs: { ...cfg.couleurs }, initiales: cfg.initiales,
    logo: cfg.logo, style: cfg.style, police: cfg.police, design: cfg.design, domaine: cfg.domaine,
    ...(cfg.extras ? { extras: [...cfg.extras] } : {}),
  };
  const perdus: string[] = [];

  const rev = setRevenue(next, cfg.revenu);
  if (rev.ok) next = { ...rev.config, prix: cfg.revenu === "gratuit" ? 0 : cfg.prix };
  else perdus.push(`modèle de revenus actuel (le type « ${base.nom} » garde le sien)`);

  for (const m of cfg.modules) {
    if (next.modules.includes(m)) continue;
    const r = enableModule(next, m);
    if (r.ok) next = r.config;
    else perdus.push(`brique « ${MODULE_BY_ID[m].nom} »`);
  }

  // Réglages : valeurs par défaut des nouvelles briques, puis anciennes valeurs quand elles existent encore.
  const reglages: Record<string, string> = {};
  for (const m of next.modules) {
    for (const s of MODULE_BY_ID[m].reglages) {
      const old = cfg.reglages[s.id];
      reglages[s.id] = old && s.options.includes(old) ? old : next.reglages[s.id] ?? s.options[0]!;
    }
  }
  return { config: { ...next, reglages }, perdus };
}
