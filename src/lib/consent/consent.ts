// Consentement aux traceurs facultatifs (cookies, pixels, mesure d'audience, médias tiers, publicité).
//
// Principes (recherche CNIL / art. 82 loi Informatique et Libertés) :
// - les catégories facultatives sont DÉSACTIVÉES par défaut ;
// - refuser est aussi simple qu'accepter, et le choix peut être retiré à tout moment ;
// - le choix est mémorisé 6 mois (version, date, expiration), puis on redemande ;
// - le consentement n'est JAMAIS lié à l'acceptation des CGU ou des CGV ;
// - aujourd'hui AUCUN traceur facultatif n'existe : OPTIONAL_TRACKERS est vide.
//   Tout futur script facultatif doit être déclaré dans OPTIONAL_TRACKERS ET chargé via loadIfConsented.
//
// Le choix est mémorisé dans le localStorage du domaine (clé CONSENT_KEY) : aucun cookie n'est posé,
// rien n'est envoyé au serveur. Ce stockage est strictement nécessaire (il sert à mémoriser le choix).

export const CATEGORIES = ["necessaire", "audience", "medias", "publicite"] as const;
export type Category = (typeof CATEGORIES)[number];
export type OptionalCategory = Exclude<Category, "necessaire">;
export const OPTIONAL_CATEGORIES = ["audience", "medias", "publicite"] as const satisfies readonly OptionalCategory[];

export const CATEGORY_INFO: Record<Category, { nom: string; texte: string }> = {
  necessaire: { nom: "Strictement nécessaires", texte: "Connexion, mémorisation de tes projets et de ton choix. Toujours actifs : ils font fonctionner le service." },
  audience: { nom: "Mesure d'audience", texte: "Statistiques de fréquentation. Aucun outil de ce type n'est utilisé aujourd'hui." },
  medias: { nom: "Contenus de tiers", texte: "Vidéos ou contenus intégrés depuis d'autres sites. Aucun n'est utilisé aujourd'hui." },
  publicite: { nom: "Publicité", texte: "Ciblage publicitaire. Aucun n'est utilisé aujourd'hui, et il n'y en aura pas sans ton accord." },
};

/** Version du texte et des catégories : si elle change, le choix mémorisé n'est plus valable. */
export const CONSENT_VERSION = 1;
/** Durée de validité d'un choix, en mois. */
export const CONSENT_MONTHS = 6;
export const CONSENT_KEY = "decollage.consent";
export const CONSENT_EVENT = "decollage:consent-change";
export const CONSENT_OPEN_EVENT = "decollage:consent-open";

export type TrackerDef = {
  id: string;
  nom: string;
  fournisseur: string;
  categorie: OptionalCategory;
  /** Noms de domaine contactés par ce traceur (le test du code source ne les autorise que s'ils sont déclarés ici). */
  domaines: readonly string[];
  finalite: string;
  /** Durée de vie du traceur / des données. */
  duree: string;
};

/**
 * Registre des traceurs facultatifs RÉELLEMENT présents dans le code. Aujourd'hui : aucun.
 * Ajouter un traceur ici avant de l'ajouter au code (un test parcourt le code source et échoue
 * si un domaine de suivi apparaît sans être déclaré ici).
 */
export const OPTIONAL_TRACKERS: readonly TrackerDef[] = [];

export type ConsentChoices = Record<OptionalCategory, boolean>;
export type ConsentRecord = { v: number; date: string; expires: string; choices: ConsentChoices };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let storageOverride: StorageLike | null = null;
/** Pour les tests : remplace le stockage du navigateur. */
export function __setStorage(s: StorageLike | null) { storageOverride = s; }

function storage(): StorageLike | null {
  if (storageOverride) return storageOverride;
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

const none = (): ConsentChoices => ({ audience: false, medias: false, publicite: false });

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Choix valide en ce moment (bonne version, non expiré, bien formé) ; sinon null : on n'a pas de choix. */
export function getConsent(now: Date = new Date()): ConsentRecord | null {
  const s = storage();
  if (!s) return null;
  let rec: unknown;
  try { rec = JSON.parse(s.getItem(CONSENT_KEY) ?? "null"); } catch { return null; }
  if (!rec || typeof rec !== "object") return null;
  const r = rec as Partial<ConsentRecord>;
  if (r.v !== CONSENT_VERSION || typeof r.date !== "string" || typeof r.expires !== "string" || !r.choices) return null;
  const exp = Date.parse(r.expires);
  if (Number.isNaN(exp) || exp <= now.getTime()) return null;
  const choices = none();
  for (const c of OPTIONAL_CATEGORIES) choices[c] = r.choices[c] === true;
  return { v: r.v, date: r.date, expires: r.expires, choices };
}

type Listener = (rec: ConsentRecord | null) => void;
const listeners = new Set<Listener>();

/** S'abonner aux changements de choix. Renvoie la fonction pour se désabonner. */
export function onConsentChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function emit(rec: ConsentRecord | null) {
  for (const l of [...listeners]) l(rec);
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: rec }));
}

/** Enregistre un choix. Les catégories non citées restent refusées (désactivées par défaut). */
export function setConsent(choices: Partial<ConsentChoices>, now: Date = new Date()): ConsentRecord {
  const full = none();
  for (const c of OPTIONAL_CATEGORIES) full[c] = choices[c] === true;
  const rec: ConsentRecord = { v: CONSENT_VERSION, date: now.toISOString(), expires: addMonths(now, CONSENT_MONTHS).toISOString(), choices: full };
  try { storage()?.setItem(CONSENT_KEY, JSON.stringify(rec)); } catch { /* stockage indisponible : le choix vaut pour cette page seulement */ }
  emit(rec);
  return rec;
}

export const acceptAll = (now?: Date) => setConsent({ audience: true, medias: true, publicite: true }, now);
export const refuseAll = (now?: Date) => setConsent({}, now);

/** Le consentement est-il donné pour cette catégorie ? « necessaire » : toujours vrai. Sans choix : faux. */
export function hasConsent(category: Category, now: Date = new Date()): boolean {
  if (category === "necessaire") return true;
  return getConsent(now)?.choices[category] === true;
}

/** Retirer son consentement : toutes les catégories facultatives repassent à « refusé » (le retrait est mémorisé). */
export function withdraw(now?: Date): ConsentRecord {
  return refuseAll(now);
}

/** Faut-il demander un choix ? Seulement s'il existe un traceur facultatif et qu'aucun choix valide n'existe. */
export function needsPrompt(now: Date = new Date(), trackers: readonly TrackerDef[] = OPTIONAL_TRACKERS): boolean {
  return trackers.length > 0 && getConsent(now) === null;
}

/**
 * Seule façon autorisée de charger un script, pixel ou iframe facultatif.
 * Le chargeur ne s'exécute QUE si la catégorie est consentie : tout de suite si c'est déjà le cas,
 * sinon dès qu'elle l'est. Il s'exécute au plus une fois ; s'il renvoie une fonction, elle est appelée
 * quand le consentement est retiré. Renvoie une fonction pour annuler l'attente.
 */
export function loadIfConsented(category: Category, loader: () => void | (() => void)): () => void {
  let done = false;
  let cleanup: void | (() => void);
  const attempt = () => {
    if (done || !hasConsent(category)) return;
    done = true;
    cleanup = loader();
  };
  const off = onConsentChange(() => {
    if (done && !hasConsent(category)) { try { if (typeof cleanup === "function") cleanup(); } finally { cleanup = undefined; } off(); return; }
    attempt();
  });
  attempt();
  if (done && category === "necessaire") off();
  return () => off();
}
