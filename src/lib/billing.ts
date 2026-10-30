import { PAID_PLANS, type PaidPlan } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Règles d'abonnement, sans dépendance (testées).

/** Statuts Stripe qui donnent accès à l'offre payée. « past_due » : on laisse le temps de régulariser. */
const ACTIVE = new Set(["active", "trialing", "past_due"]);
export const isActiveStatus = (status: string | null | undefined) => Boolean(status && ACTIVE.has(status));

/**
 * Formule accordée par UN prix. Un prix inconnu (ancien tarif, variable mal renseignée, supplément) ne donne
 * JAMAIS une formule payante : « gratuit ». (Avant octobre 2026 il donnait Illimité : faille supprimée.)
 */
export function planFromSubscription(status: string | null | undefined, priceId: string | null | undefined, prices: Partial<Record<PaidPlan, string>>): Plan {
  if (!isActiveStatus(status)) return "gratuit";
  return PAID_PLANS.find((p) => prices[p] && prices[p] === priceId) ?? "gratuit";
}

export type SubscriptionAnalysis = {
  /** Formule principale reconnue ; null = aucune formule reconnue dans l'abonnement (on ne devine jamais). */
  plan: Plan | null;
  /** L'option marque blanche (prix STRIPE_PRICE_BRAND) figure sur l'abonnement. Distincte de la formule. */
  brandOption: boolean;
  /** Identifiants de prix non reconnus (à journaliser par le serveur, sans donnée personnelle). */
  unknownPrices: string[];
  /** Plusieurs formules principales sur un même abonnement : on retient la MOINS chère. */
  ambiguous: boolean;
};

/**
 * Analyse TOUS les éléments d'un abonnement Stripe. Règles :
 *  - abonnement inactif : Gratuit, sans option ;
 *  - un prix de formule connu donne cette formule ; l'option marque blanche et les prix inconnus n'accordent
 *    jamais une formule (l'option seule ou un prix inconnu seul : plan null) ;
 *  - plusieurs formules : la moins chère (jamais de cumul vers le haut).
 */
export function analyzeSubscription(
  status: string | null | undefined,
  priceIds: readonly (string | null | undefined)[],
  prices: Partial<Record<PaidPlan, string>>,
  brandPriceId?: string | null,
): SubscriptionAnalysis {
  if (!isActiveStatus(status)) return { plan: "gratuit", brandOption: false, unknownPrices: [], ambiguous: false };
  const found = new Set<PaidPlan>();
  const unknownPrices: string[] = [];
  let brandOption = false;
  for (const id of priceIds) {
    if (!id) continue;
    const plan = PAID_PLANS.find((p) => prices[p] && prices[p] === id);
    if (plan) found.add(plan);
    else if (brandPriceId && id === brandPriceId) brandOption = true;
    else unknownPrices.push(id);
  }
  const plan = PAID_PLANS.find((p) => found.has(p)) ?? null; // PAID_PLANS est trié du moins cher au plus cher
  return { plan, brandOption, unknownPrices, ambiguous: found.size > 1 };
}

/**
 * Formule à enregistrer. Formule reconnue : celle-là. Formule inconnue (aucune formule reconnue) : on conserve la
 * formule précédente SEULEMENT si c'est le même abonnement déjà connu ; sinon Gratuit. Jamais de montée en gamme.
 */
export function resolvePlan(a: SubscriptionAnalysis, previous: { plan: Plan; subscriptionId: string | null }, subscriptionId: string): Plan {
  if (a.plan) return a.plan;
  return previous.subscriptionId === subscriptionId ? previous.plan : "gratuit";
}

export const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** Identifiant de l'abonnement concerné par un événement Stripe (ou null). */
export function subscriptionIdOf(event: { type: string; data: { object: unknown } }): string | null {
  const o = event.data.object as { id?: string; mode?: string; subscription?: string | { id: string } | null };
  if (event.type.startsWith("customer.subscription.")) return o.id ?? null;
  if (event.type === "checkout.session.completed" && o.mode === "subscription") {
    return typeof o.subscription === "string" ? o.subscription : (o.subscription?.id ?? null);
  }
  return null;
}
