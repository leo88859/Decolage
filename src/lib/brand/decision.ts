import { normalizePlan, whiteLabelAllowed } from "@/lib/plans";

/**
 * Source de vérité UNIQUE du droit « marque blanche » (API /api/brand ET mention « Créé avec Décollage » des boutiques).
 * `plan` : profiles.plan (déjà abaissé par le webhook Stripe). `optionActive` : brand_entitlements.enabled.
 * Toute valeur inconnue ou absente donne `false` (fail-closed).
 */
export const decideWhiteLabel = (plan: unknown, optionActive: unknown): boolean =>
  whiteLabelAllowed(normalizePlan(typeof plan === "string" ? plan : null), optionActive === true);
