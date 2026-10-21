import { PAID_PLANS, type PaidPlan } from "@/lib/plans";
import type { Plan } from "@/lib/types";

// Règles d'abonnement, sans dépendance (testées).

/** Statuts Stripe qui donnent accès à l'offre payée. « past_due » : on laisse le temps de régulariser. */
const ACTIVE = new Set(["active", "trialing", "past_due"]);
export const isActiveStatus = (status: string | null | undefined) => Boolean(status && ACTIVE.has(status));

/**
 * Formule accordée par un abonnement : celle dont le prix correspond. Un abonnement actif sur un
 * prix inconnu (ancien tarif, variable mal renseignée) donne Illimité : on ne retire jamais
 * l'accès d'un client qui paie.
 */
export function planFromSubscription(status: string | null | undefined, priceId: string | null | undefined, prices: Partial<Record<PaidPlan, string>>): Plan {
  if (!isActiveStatus(status)) return "gratuit";
  return PAID_PLANS.find((p) => prices[p] && prices[p] === priceId) ?? "illimite";
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
