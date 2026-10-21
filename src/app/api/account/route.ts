import { isCloudConfigured, isPaymentConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/** Suppression définitive du compte : abonnement résilié, puis données effacées (cascade). */
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
  if (isPaymentConfigured() && profile?.stripe_subscription_id && profile.subscription_status !== "canceled") {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch {
      return Response.json({ error: "Impossible de résilier l'abonnement : réessaie ou résilie depuis « Gérer mon abonnement »." }, { status: 502 });
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: "Suppression impossible pour le moment." }, { status: 500 });
  return Response.json({ ok: true });
}
