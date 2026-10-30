import type Stripe from "stripe";
import { analyzeSubscription, HANDLED_EVENTS, isActiveStatus, resolvePlan, subscriptionIdOf } from "@/lib/billing";
import { isPaymentConfigured, stripeBrandPrice, stripePrices, stripeWebhookSecret } from "@/lib/env";
import { normalizePlan } from "@/lib/plans";
import { syncPublicationsWithPlan } from "@/lib/site-lifecycle";
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
    const { data: profile } = await admin.from("profiles").select("id, plan, stripe_subscription_id").eq("stripe_customer_id", customerId).maybeSingle();
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
    // TOUS les éléments de l’abonnement sont analysés (formule principale + option marque blanche + inconnus).
    const analysis = analyzeSubscription(sub.status, sub.items.data.map((i) => i.price?.id), stripePrices(), stripeBrandPrice());
    if (analysis.unknownPrices.length) {
      // Aucun identifiant client ni e-mail dans le journal : seulement l’abonnement et les prix inconnus.
      console.error(`[stripe] prix inconnu(s) sur ${sub.id} : ${analysis.unknownPrices.join(", ")} (aucune formule accordée pour eux)`);
    }
    if (analysis.ambiguous) console.error(`[stripe] plusieurs formules sur ${sub.id} : la moins chère est retenue`);
    const newPlan = resolvePlan(analysis, { plan: normalizePlan(profile.plan), subscriptionId: (profile.stripe_subscription_id as string | null) ?? null }, sub.id);
    if (!analysis.plan && isActiveStatus(sub.status)) {
      console.error(`[stripe] aucune formule reconnue sur ${sub.id} : formule conservée si déjà connue, sinon Gratuit (${newPlan})`);
    }
    const { error } = await admin
      .from("profiles")
      .update({ plan: newPlan, stripe_subscription_id: sub.id, subscription_status: sub.status, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);
    // Option marque blanche : droit SÉPARÉ de la formule (ne modifie jamais profiles.plan).
    await syncBrandOption(admin, profile.id, analysis.brandOption && isActiveStatus(sub.status));
    // Résiliation / changement de formule : suspend (ou réactive) sites ET boutiques selon la nouvelle limite. Rien n’est supprimé.
    await syncPublicationsWithPlan(admin, profile.id, newPlan);
    return Response.json({ received: true });
  } catch (e) {
    console.error(`[stripe] échec du traitement de ${event.id} (${event.type}) : ${(e as Error).message}`);
    // 500 : Stripe renverra l'événement plus tard.
    return Response.json({ error: "Traitement impossible" }, { status: 500 });
  }
}

/**
 * Reflète l’option marque blanche Solo dans brand_entitlements. Ne touche JAMAIS un droit accordé à la main
 * (source « manuel », valeur par défaut) ; ne gère que ses propres lignes (source « stripe », migration 0006).
 * Sans effet bloquant : si la migration manque, on journalise et on continue.
 */
async function syncBrandOption(admin: ReturnType<typeof createAdminClient>, userId: string, present: boolean) {
  try {
    const { data, error } = await admin.from("brand_entitlements").select("enabled, source").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (present) {
      if (!data) {
        const r = await admin.from("brand_entitlements").insert({ user_id: userId, enabled: true, source: "stripe" });
        if (r.error) throw new Error(r.error.message);
      } else if (data.source === "stripe" && !data.enabled) {
        const r = await admin.from("brand_entitlements").update({ enabled: true }).eq("user_id", userId);
        if (r.error) throw new Error(r.error.message);
      }
    } else if (data && data.source === "stripe" && data.enabled) {
      const r = await admin.from("brand_entitlements").update({ enabled: false }).eq("user_id", userId);
      if (r.error) throw new Error(r.error.message);
    }
  } catch (e) {
    console.error(`[stripe] option marque blanche non synchronisée (migration 0006 exécutée ?) : ${(e as Error).message}`);
  }
}
