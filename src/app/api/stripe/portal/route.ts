import { appUrl, isPaymentConfigured } from "@/lib/env";
import { originGuard } from "@/lib/origin";
import { getStripe } from "@/lib/stripe";
import { stripeErrorMessage } from "@/lib/stripe-errors";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/** Portail client Stripe : moyen de paiement, factures, résiliation. */
export async function POST(req: Request) {
  const refused = originGuard(req);
  if (refused) return refused;
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401 });
  const { data } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) return Response.json({ error: "Aucun abonnement associé à ton compte." }, { status: 400 });
  // Le client Stripe est enregistré à l'ouverture du paiement : le portail s'ouvre même si l'abonnement n'est pas (encore) reconnu.
  // Ce que le portail permet pour un statut donné dépend de sa configuration Stripe : à vérifier en mode test.
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${appUrl()}/parametres` });
    return Response.json({ url: session.url });
  } catch (err) {
    const e = err as { type?: string; code?: string };
    console.error("[stripe/portal]", e.type, e.code);
    const { status, error } = stripeErrorMessage(err);
    return Response.json({ error: `${error} Si le problème continue, utilise la page Contact.` }, { status });
  }
}
