// Résiliation de l'abonnement Stripe avant la suppression d'un compte (audit I-5).
// Règles : l'abonnement est résilié AVANT d'effacer le compte (on ne laisse jamais un client facturé sans compte) ;
// un abonnement déjà terminé ou inexistant chez Stripe ne bloque pas l'effacement ; une vraie panne Stripe bloque,
// avec un message clair. Les clients et les factures Stripe ne sont JAMAIS supprimés (obligations comptables).

/** Ce dont on a besoin de Stripe (permet de tester sans réseau). */
export type SubscriptionApi = {
  cancel(id: string): Promise<unknown>;
  retrieve(id: string): Promise<{ status?: string }>;
};

export type CancelResult = "annule" | "deja_termine" | "introuvable" | "echec";

const DEAD = new Set(["canceled", "incomplete_expired"]);
const isMissing = (e: unknown) => (e as { code?: string } | null)?.code === "resource_missing";

export async function cancelSubscriptionForDeletion(api: SubscriptionApi, subscriptionId: string, knownStatus?: string | null): Promise<CancelResult> {
  if (knownStatus && DEAD.has(knownStatus)) return "deja_termine";
  try {
    await api.cancel(subscriptionId);
    return "annule";
  } catch (e) {
    if (isMissing(e)) return "introuvable";
    // Échec : l'abonnement est-il en réalité déjà terminé (statut non annulable) ? On le vérifie auprès de Stripe.
    try {
      const sub = await api.retrieve(subscriptionId);
      return sub.status && DEAD.has(sub.status) ? "deja_termine" : "echec";
    } catch (e2) {
      return isMissing(e2) ? "introuvable" : "echec";
    }
  }
}

export const CANCEL_FAILED_MESSAGE =
  "Ton abonnement n'a pas pu être résilié (Stripe ne répond pas). Par sécurité, ton compte n'a PAS été supprimé et rien d'autre n'a été modifié. Réessaie dans quelques minutes, ou résilie d'abord depuis « Gérer mon abonnement ». Si le problème continue, écris-nous via la page Contact.";
