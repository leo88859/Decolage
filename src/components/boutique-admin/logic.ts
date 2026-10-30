import { eurosEnCentimes } from "@/lib/boutique/money";
import { suggestSlug } from "@/lib/publish";
import { validateBoutique, validateCategorie, validateProduit, validateVariante, type Errors } from "@/lib/boutique/validate";
import { TRANSITIONS, type Mode, type StatutCommande, type Variante } from "@/lib/boutique/types";

// Logique pure de l'espace commerçant (testée) : appels API, erreurs, formulaires, stock.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string; errors?: Errors };

/** Transforme une réponse serveur en message clair. Sans corps lisible, on le dit au lieu d'inventer. */
export function mapApiError(status: number, body: unknown): { code: string; message: string; errors?: Errors } {
  const b = (typeof body === "object" && body !== null ? body : {}) as { error?: unknown; code?: unknown; errors?: unknown };
  const code = typeof b.code === "string" ? b.code : status === 401 ? "auth" : status === 404 ? "not_found" : "server";
  const errors = typeof b.errors === "object" && b.errors !== null ? (b.errors as Errors) : undefined;
  const fromServer = typeof b.error === "string" && b.error ? b.error : "";
  const known: Record<string, string> = {
    auth: "Connecte-toi pour gérer ta boutique.",
    demo: "La boutique n'est pas disponible en mode démonstration (compte en ligne requis).",
    limite_boutiques: "Ta formule ne permet pas de créer une boutique. Passe à une formule supérieure.",
    limite_sites: "Ta formule ne permet pas de publier un site de plus. Passe à une formule supérieure ou dépublie un site.",
    duplicate: "Ce nom ou cette adresse est déjà utilisé.",
    statut_invalide: "Ce changement de statut n'est pas possible.",
    not_found: "Élément introuvable (il a peut-être été supprimé).",
    origin: "Requête refusée par le serveur (origine inattendue). Recharge la page.",
  };
  const message = known[code] ?? (fromServer || (status >= 500 ? "Le serveur a rencontré un problème. Réessaie dans un instant." : `Erreur ${status}.`));
  return { code, message, errors };
}

export const isPlanLimit = (code: string) => code === "limite_boutiques" || code === "limite_sites";

/** Appel d'API : n'annonce un succès que si le serveur répond 2xx avec un JSON lisible. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }, f: typeof fetch = fetch): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await f(`/api/boutique${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: "network", message: "Impossible de joindre le serveur. Vérifie ta connexion." };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, ...mapApiError(res.status, body) };
  if (body === null) return { ok: false, status: res.status, code: "server", message: "Réponse illisible du serveur." };
  return { ok: true, data: body as T };
}

// ─── Stock ───
export const STOCK_BAS = 3;
export type Dispo = "disponible" | "stock_bas" | "indisponible";
export function stockEtat(variantes: readonly Pick<Variante, "stock" | "actif">[]): Dispo {
  const actives = variantes.filter((v) => v.actif);
  if (actives.reduce((s, v) => s + v.stock, 0) <= 0) return "indisponible";
  return actives.some((v) => v.stock > 0 && v.stock <= STOCK_BAS) ? "stock_bas" : "disponible";
}
export const DISPO_LABEL: Record<Dispo, string> = { disponible: "Disponible", stock_bas: "Stock bas", indisponible: "Indisponible" };

// ─── Commandes ───
export const prochainsStatuts = (s: StatutCommande): readonly StatutCommande[] => TRANSITIONS[s];
export const ACTION_LABEL: Record<StatutCommande, string> = {
  nouvelle: "Nouvelle", confirmee: "Confirmer la commande", prete: "Marquer prête", terminee: "Marquer terminée", annulee: "Annuler la commande",
};

// ─── Formulaire boutique ───
export type BoutiqueForm = {
  nom: string; slug: string; description: string; couleur_principale: string; couleur_accent: string; logo: string;
  adresse: string; whatsapp: string; email: string; telephone: string; modes: Mode[];
};
export const BOUTIQUE_VIDE: BoutiqueForm = {
  nom: "", slug: "", description: "", couleur_principale: "#0a1433", couleur_accent: "#ff6b4a", logo: "",
  adresse: "", whatsapp: "", email: "", telephone: "", modes: ["retrait"],
};
export const slugDepuisNom = (nom: string) => (nom.trim() ? suggestSlug(nom) : "");

/** Corps envoyé à l'API (les vides deviennent null) + erreurs de saisie côté navigateur (le serveur reste l'autorité). */
export function boutiquePayload(f: BoutiqueForm): { ok: true; body: Record<string, unknown> } | { ok: false; errors: Errors } {
  const body: Record<string, unknown> = {
    slug: f.slug.trim().toLowerCase(), nom: f.nom, description: f.description, couleur_principale: f.couleur_principale,
    couleur_accent: f.couleur_accent, logo: f.logo.trim() || null, adresse: f.adresse, whatsapp: f.whatsapp.trim() || null,
    email: f.email.trim() || null, telephone: f.telephone.trim() || null, modes: f.modes,
  };
  const v = validateBoutique(body);
  return v.ok ? { ok: true, body } : { ok: false, errors: v.errors };
}
/** Champs du formulaire concernés par chaque étape de l'assistant. */
export const ETAPES: { titre: string; champs: (keyof BoutiqueForm)[] }[] = [
  { titre: "Nom et adresse", champs: ["nom", "slug", "description"] },
  { titre: "Look", champs: ["couleur_principale", "couleur_accent", "logo"] },
  { titre: "Contact", champs: ["adresse", "whatsapp", "email", "telephone"] },
  { titre: "Commande", champs: ["modes"] },
];
export function erreursEtape(etape: number, errors: Errors): Errors {
  const champs: string[] = ETAPES[etape]?.champs ?? [];
  return Object.fromEntries(Object.entries(errors).filter(([k]) => champs.includes(k)));
}

// ─── Formulaire produit ───
export type VarianteForm = { id?: string; nom: string; stock: string; actif: boolean };
export type ProduitForm = { titre: string; description: string; prix: string; image: string; categorie_id: string; actif: boolean; variantes: VarianteForm[] };
export const PRODUIT_VIDE: ProduitForm = { titre: "", description: "", prix: "", image: "", categorie_id: "", actif: true, variantes: [{ nom: "Unique", stock: "0", actif: true }] };
export type VarianteOut = { id?: string; nom: string; stock: number; actif: boolean };

const stockEntier = (s: string) => (/^\d{1,7}$/.test(s.trim()) ? Number(s.trim()) : null);

/** Valide le formulaire produit. Le prix saisi en euros devient des centimes entiers (jamais de flottant). */
export function produitPayload(f: ProduitForm): { ok: true; produit: Record<string, unknown>; variantes: VarianteOut[] } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const centimes = eurosEnCentimes(f.prix);
  if (centimes === null) errors.prix = "Prix invalide : ex. 12,50 (2 décimales au plus, pas de négatif).";
  const produit: Record<string, unknown> = {
    titre: f.titre, description: f.description, prix_centimes: centimes ?? 0, images: f.image.trim() ? [f.image.trim()] : [],
    actif: f.actif, categorie_id: f.categorie_id || null,
  };
  const v = validateProduit(produit);
  if (!v.ok) for (const [k, m] of Object.entries(v.errors)) errors[k === "images" ? "image" : k === "prix_centimes" ? "prix" : k] ??= m;
  const variantes: VarianteOut[] = [];
  if (f.variantes.length === 0) errors.variantes = "Ajoute au moins une variante (ex. « Unique »).";
  f.variantes.forEach((x, i) => {
    const stock = stockEntier(x.stock);
    if (stock === null) { errors[`variante.${i}.stock`] = "Stock : nombre entier (0 = épuisé)."; return; }
    const r = validateVariante({ nom: x.nom, stock, actif: x.actif });
    if (!r.ok) { errors[`variante.${i}.nom`] = Object.values(r.errors)[0] ?? "Variante invalide."; return; }
    variantes.push({ ...(x.id ? { id: x.id } : {}), nom: r.value.nom ?? x.nom, stock, actif: x.actif });
  });
  if (new Set(variantes.map((x) => x.nom)).size !== variantes.length) errors.variantes = "Deux variantes ne peuvent pas avoir le même nom.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, produit, variantes };
}

export const categoriePayload = (nom: string) => validateCategorie({ nom });
