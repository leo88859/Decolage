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

/** Seuls statuts qui prouvent qu'un abonnement est terminé. Tout autre statut, y compris inconnu ou absent, compte comme « abonnement existant ». */
const ENDED = new Set(["canceled", "incomplete_expired"]);
export const subscriptionBlocksCheckout = (status: string | null | undefined): boolean => !(typeof status === "string" && ENDED.has(status));

export const EXISTING_SUBSCRIPTION_MESSAGE =
  "Un abonnement existe déjà sur ton compte : pour changer d'offre ou le gérer, ouvre le portail de gestion (« Gérer mon abonnement »). Si tu ne le retrouves pas, contacte-nous : aucun second abonnement n'a été créé et rien n'a été débité.";

// ─── Refus du paiement : message clair + action sûre (voir docs/STRIPE-ABONNEMENT-PRUDENT.md) ───────────────────
export type RefusalAction = "portail" | "contact" | "reessayer";
export type CheckoutRefusal = {
  code: "abonnement_existant" | "verification_impossible";
  error: string;
  /** Action principale proposée à l'utilisateur. */
  action: RefusalAction;
  /** Statut Stripe qui a motivé le refus (null = inconnu ou lecture impossible). */
  statut: string | null;
};

const NO_DOUBLE = "Tu ne seras pas facturé deux fois : nous ne créons pas de second abonnement, et cette demande n'a rien débité.";
/** Du plus « vivant » au plus incertain : sert à choisir le message quand Stripe renvoie plusieurs abonnements. */
const SEVERITY = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

/** Statut le plus significatif parmi les abonnements non terminés (null = aucun ne bloque). Un statut inconnu ou absent bloque. */
export function blockingStatus(statuses: readonly (string | null | undefined)[]): string | null | undefined {
  const blocking = statuses.filter((s) => subscriptionBlocksCheckout(s));
  if (!blocking.length) return undefined;
  const known = SEVERITY.find((k) => blocking.includes(k));
  return known ?? null;
}

/**
 * Refus « abonnement existant » selon le statut. Le portail n'est proposé en action principale que s'il existe un client Stripe
 * ET que le statut s'y prête ; il n'est jamais présenté comme la solution garantie pour unpaid / paused / incomplete
 * (comportement exact du portail : à vérifier en mode test).
 */
export function existingSubscriptionRefusal(status: string | null | undefined, hasCustomer: boolean): CheckoutRefusal {
  const base = "Un abonnement existe déjà sur ton compte";
  const portal = (error: string, statut: string): CheckoutRefusal => ({ code: "abonnement_existant", error: `${error} ${NO_DOUBLE}`, action: hasCustomer ? "portail" : "contact", statut });
  switch (status) {
    case "active":
    case "trialing":
      return portal(`${base} et il est actif. Pour changer d'offre, mettre à jour ton moyen de paiement ou résilier, ouvre le portail de gestion.`, status);
    case "past_due":
      return portal(`${base}, mais son dernier paiement a échoué. Ouvre le portail de gestion pour vérifier ton moyen de paiement ; ne prends pas un nouvel abonnement.`, status);
    case "unpaid":
      return portal(`${base}, mais il est impayé. Le portail de gestion te montre tes factures et ton moyen de paiement ; s'il ne règle pas la situation, contacte-nous.`, status);
    case "paused":
      return portal(`${base}, mais il est en pause. Ouvre le portail de gestion pour le consulter ; si la reprise n'y est pas proposée, contacte-nous.`, status);
    case "incomplete":
      return { code: "abonnement_existant", error: `${base}, mais son premier paiement n'a pas été finalisé (par exemple une confirmation bancaire restée en attente). N'en prends pas un autre : patiente un peu, puis contacte-nous si cela ne se débloque pas. ${NO_DOUBLE}`, action: "contact", statut: status };
    default:
      return { code: "abonnement_existant", error: `${base}, mais nous ne reconnaissons pas son état. Par précaution nous bloquons un nouveau paiement : contacte-nous et nous l'examinerons. ${NO_DOUBLE}`, action: "contact", statut: null };
  }
}

export const verificationRefusal = (): CheckoutRefusal => ({
  code: "verification_impossible",
  error: `${SUBSCRIPTION_CHECK_FAILED_MESSAGE} ${NO_DOUBLE}`,
  action: "reessayer",
  statut: null,
});

/** Boutons à afficher dans la page Paramètres pour un refus (logique pure, testée). Le contact est toujours proposé en dernier recours. */
export function refusalButtons(r: { code?: string; action?: string }): { portail: boolean; reessayer: boolean; contact: boolean } {
  if (r.code === "verification_impossible") return { portail: true, reessayer: true, contact: false };
  return { portail: r.action === "portail", reessayer: false, contact: true };
}
export const SUBSCRIPTION_CHECK_FAILED_MESSAGE =
  "Nous n'avons pas pu vérifier ton abonnement actuel (Stripe ne répond pas). Par précaution, le paiement n'a pas été ouvert et rien n'a été débité : réessaie dans quelques minutes, ou ouvre le portail de gestion si tu as déjà un abonnement.";

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
