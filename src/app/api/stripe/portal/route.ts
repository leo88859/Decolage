import { appUrl, isPaymentConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/** Portail client Stripe : moyen de paiement, factures, résiliation. */
export async function POST() {
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401 });
  const { data } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) return Response.json({ error: "Aucun abonnement associé à ton compte." }, { status: 400 });
  const session = await getStripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${appUrl()}/parametres` });
  return Response.json({ url: session.url });
}
