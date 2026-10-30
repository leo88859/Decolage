import { CANCEL_FAILED_MESSAGE, cancelSubscriptionForDeletion } from "@/lib/account-deletion";
import { isCloudConfigured, isPaymentConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/**
 * Suppression définitive du compte : abonnement résilié, puis données effacées (cascade : profil, projets,
 * sites publiés, listes d'attente, preuves d'acceptation). Conservés volontairement : le client Stripe et
 * ses factures (obligation comptable) et les éventuelles sauvegardes de l'hébergeur.
 */
export async function DELETE() {
  if (!isCloudConfigured()) return Response.json({ error: "Non disponible." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401 });
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ error: "La suppression de compte n'est pas encore configurée (clé service_role manquante)." }, { status: 503 });
  }
  const { data: profile } = await admin.from("profiles").select("stripe_subscription_id, subscription_status").eq("id", user.id).maybeSingle();
  if (isPaymentConfigured() && profile?.stripe_subscription_id) {
    const stripe = getStripe();
    const result = await cancelSubscriptionForDeletion(stripe.subscriptions, profile.stripe_subscription_id, profile.subscription_status);
    if (result === "echec") {
      // Ordre sûr : rien n'est supprimé tant que l'abonnement n'est pas résilié.
      console.error("[account] suppression interrompue : résiliation de l'abonnement impossible");
      return Response.json({ error: CANCEL_FAILED_MESSAGE, code: "stripe_cancel_failed" }, { status: 502 });
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: "Suppression impossible pour le moment. Ton abonnement éventuel a déjà été résilié : réessaie dans quelques minutes." }, { status: 500 });
  return Response.json({ ok: true });
}
