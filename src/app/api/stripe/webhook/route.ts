import type Stripe from "stripe";
import { HANDLED_EVENTS, isActiveStatus, planFromSubscription, subscriptionIdOf } from "@/lib/billing";
import { isPaymentConfigured, stripePrices, stripeWebhookSecret } from "@/lib/env";
import { syncSitesWithPlan } from "@/lib/site-lifecycle";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Webhooks Stripe. La signature est vérifiée sur le corps BRUT. Stripe est la source de vérité :
 * on relit l'abonnement auprès de Stripe puis on met à jour la formule. Rejouer un événement
 * donne le même résultat (idempotent).
 */
export async function POST(req: Request) {
  if (!isPaymentConfigured()) return Response.json({ error: "Webhook non configuré" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Signature manquante" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, stripeWebhookSecret());
  } catch {
    return Response.json({ error: "Signature invalide" }, { status: 400 });
  }
  if (!HANDLED_EVENTS.has(event.type)) return Response.json({ received: true, ignored: true });

  const subId = subscriptionIdOf(event);
  if (!subId) return Response.json({ received: true, ignored: true });

  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const admin = createAdminClient();
    // L'utilisateur est retrouvé grâce au lien enregistré par NOTRE serveur au moment du paiement.
    const { data: profile } = await admin.from("profiles").select("id, stripe_subscription_id").eq("stripe_customer_id", customerId).maybeSingle();
    // Client inconnu : compte supprimé entre-temps (la suppression résilie l'abonnement, ce qui déclenche
    // cet événement après l'effacement du profil). Ce n'est pas une erreur : on répond 200 pour que Stripe
    // n'insiste pas. Journal sans donnée personnelle (ni identifiant client, ni e-mail).
    if (!profile) {
      console.warn(`[stripe] événement ${event.type} ignoré : aucun compte associé (compte supprimé ?)`);
      return Response.json({ received: true, ignored: true });
    }
    // Un ancien abonnement qui se termine ne doit pas retirer l'accès donné par un abonnement plus récent.
    if (profile.stripe_subscription_id && profile.stripe_subscription_id !== sub.id && !isActiveStatus(sub.status)) {
      return Response.json({ received: true, ignored: true });
    }
    if (sub.metadata?.user_id && sub.metadata.user_id !== profile.id) {
      console.error(`[stripe] user_id incohérent pour ${sub.id} : ignoré`);
      return Response.json({ received: true, ignored: true });
    }
    const newPlan = planFromSubscription(sub.status, sub.items.data[0]?.price.id, stripePrices());
    const { error } = await admin
      .from("profiles")
      .update({ plan: newPlan, stripe_subscription_id: sub.id, subscription_status: sub.status, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);
    // Résiliation / changement de formule : suspend (ou réactive) les sites selon la nouvelle limite. Sans effet bloquant.
    await syncSitesWithPlan(admin, profile.id, newPlan);
    return Response.json({ received: true });
  } catch (e) {
    console.error(`[stripe] échec du traitement de ${event.id} (${event.type}) : ${(e as Error).message}`);
    // 500 : Stripe renverra l'événement plus tard.
    return Response.json({ error: "Traitement impossible" }, { status: 500 });
  }
}
