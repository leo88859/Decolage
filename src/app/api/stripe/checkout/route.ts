import { appUrl, isPaymentConfigured, stripePrices } from "@/lib/env";
import { isPaidPlan, normalizePlan, PLANS } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/**
 * Ouvre le paiement Stripe d'une formule. Le navigateur n'envoie que le nom de la formule :
 * le prix est choisi côté serveur dans la liste autorisée.
 */
export async function POST(req: Request) {
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi pour t'abonner." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; retour?: unknown };
  // Retour vers l'idée en cours après paiement : uniquement un chemin interne vers /creer.
  const retour = typeof body.retour === "string" && /^\/creer(\?|$)/.test(body.retour) && body.retour.length <= 600 ? `&retour=${encodeURIComponent(body.retour)}` : "";
  if (!isPaidPlan(body.plan)) return Response.json({ error: "Formule inconnue." }, { status: 400 });
  const priceId = stripePrices()[body.plan];
  if (!priceId) return Response.json({ error: `Le prix de la formule ${PLANS[body.plan].nom} n'est pas configuré.` }, { status: 503 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan, stripe_customer_id").eq("id", user.id).maybeSingle();
  // Un seul abonnement à la fois : les changements de formule passent par le portail Stripe (prorata géré par Stripe).
  if (normalizePlan(profile?.plan) !== "gratuit") {
    return Response.json({ error: "Tu as déjà un abonnement : utilise « Changer d'offre » pour passer à une autre formule." }, { status: 400 });
  }

  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
    // Le lien client Stripe → utilisateur est enregistré par le serveur : le webhook s'y fie.
    await admin.from("profiles").upsert({ id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id, plan: body.plan } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/parametres?paiement=ok${retour}`,
    cancel_url: `${appUrl()}/parametres?paiement=annule${retour}`,
  });
  if (!session.url) return Response.json({ error: "Paiement indisponible pour le moment." }, { status: 502 });
  return Response.json({ url: session.url });
}
