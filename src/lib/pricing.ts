import type { Config, Offer, Pricing } from "@/lib/types";

/** Prix mensuel équivalent d'une offre (un paiement unique est réparti sur 12 mois). */
export const monthlyPrice = (o: Offer) => (o.periode === "mois" ? o.prix : o.prix / 12);

/** Prix mensuel moyen des offres payantes. */
export function averagePaid(offres: Offer[]): number {
  const paid = offres.filter((o) => o.prix > 0);
  if (!paid.length) return 0;
  return paid.reduce((s, o) => s + monthlyPrice(o), 0) / paid.length;
}

export type Scenario = { brut: number; fraisPaiement: number; fraisFixes: number; resultat: number; marge: number };

/**
 * Scénario mensuel, pas une prévision.
 * Revenu brut = clients payants × prix mensuel moyen.
 * Frais de paiement = brut × % + clients × frais fixe par transaction.
 */
export function scenario(clients: number, prixMoyen: number, c: Pricing["calc"]): Scenario {
  const n = Math.max(0, Math.floor(clients));
  const brut = round(n * prixMoyen);
  const fraisPaiement = round(brut * (c.fraisPct / 100) + n * c.fraisFixe);
  const fraisFixes = round(c.hebergement + c.autres);
  const resultat = round(brut - fraisPaiement - fraisFixes);
  return { brut, fraisPaiement, fraisFixes, resultat, marge: brut > 0 ? Math.round((resultat / brut) * 100) : 0 };
}

/** Nombre de clients payants nécessaires pour couvrir les frais fixes (null si impossible). */
export function breakEven(prixMoyen: number, c: Pricing["calc"]): number | null {
  const parClient = prixMoyen * (1 - c.fraisPct / 100) - c.fraisFixe;
  if (parClient <= 0) return null;
  return Math.ceil((c.hebergement + c.autres) / parClient);
}

const round = (x: number) => Math.round(x * 100) / 100;

let n = 0;
export const offerId = () => `o${Date.now().toString(36)}${(n++).toString(36)}`;

/** Offres de départ selon le modèle de revenus choisi dans le constructeur. */
export function defaultPricing(cfg: Config): Pricing {
  const p = cfg.prix || 9;
  const offres: Offer[] =
    cfg.revenu === "gratuit"
      ? [{ id: "gratuit", nom: "Gratuit", prix: 0, periode: "mois", features: ["Toutes les fonctionnalités"] }]
      : cfg.revenu === "paiement-unique"
        ? [{ id: "essentiel", nom: "Essentiel", prix: p, periode: "unique", features: ["Accès à vie", "Mises à jour"] }]
        : cfg.revenu === "commission"
          ? [{ id: "standard", nom: "Standard", prix: 0, periode: "mois", features: ["Inscription gratuite", "Commission sur chaque transaction"] }, { id: "pro", nom: "Pro", prix: p, periode: "mois", features: ["Commission réduite", "Mise en avant"] }]
          : [
              ...(cfg.revenu === "freemium" ? [{ id: "gratuit", nom: "Gratuit", prix: 0, periode: "mois" as const, features: ["Fonctionnalités de base"] }] : []),
              { id: "pro", nom: "Pro", prix: p, periode: "mois", features: ["Toutes les fonctionnalités", "Support par email"] },
              { id: "equipe", nom: "Équipe", prix: Math.round(p * 2.5), periode: "mois", features: ["Tout Pro", "Plusieurs utilisateurs", "Support prioritaire"] },
            ];
  return { modele: cfg.revenu, offres, calc: { clients: 50, fraisPct: 1.5, fraisFixe: 0.25, hebergement: 20, autres: 0 } };
}
