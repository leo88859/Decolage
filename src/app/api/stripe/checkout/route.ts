import { appUrl, isPaymentConfigured, stripePrices } from "@/lib/env";
import { checkPurchaseConsent, recordAcceptances } from "@/lib/legal-acceptance";
import { isPaidPlan, normalizePlan, PLANS } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { stripeErrorMessage } from "@/lib/stripe-errors";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/**
 * Ouvre le paiement Stripe d'une formule. Le navigateur n'envoie que le nom de la formule :
 * le prix est choisi côté serveur dans la liste autorisée.
 */
export async function POST(req: Request) {
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi pour t'abonner." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; retour?: unknown; acceptCgv?: unknown; renonciation?: unknown; cgvVersion?: unknown };
  // Retour vers l'idée en cours après paiement : uniquement un chemin interne vers /creer.
  const retour = typeof body.retour === "string" && /^\/creer(\?|$)/.test(body.retour) && body.retour.length <= 600 ? `&retour=${encodeURIComponent(body.retour)}` : "";
  if (!isPaidPlan(body.plan)) return Response.json({ error: "Formule inconnue." }, { status: 400 });
  const priceId = stripePrices()[body.plan];
  if (!priceId) return Response.json({ error: `Le prix de la formule ${PLANS[body.plan].nom} n'est pas configuré.` }, { status: 503 });

  // Commande avec obligation de paiement : le serveur exige les confirmations (CGV lues, accès immédiat et
  // renonciation à la rétractation) et en garde la preuve AVANT d'ouvrir le paiement.
  const consent = checkPurchaseConsent(body);
  if (!consent.ok) return Response.json({ error: consent.error }, { status: consent.status });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan, stripe_customer_id").eq("id", user.id).maybeSingle();
  // Un seul abonnement à la fois : les changements de formule passent par le portail Stripe (prorata géré par Stripe).
  if (normalizePlan(profile?.plan) !== "gratuit") {
    return Response.json({ error: "Tu as déjà un abonnement : utilise « Changer d'offre » pour passer à une autre formule." }, { status: 400 });
  }

  const saved = await recordAcceptances(admin, [
    { user_id: user.id, document: "cgv", version: body.cgvVersion as string, contexte: "achat", renonciation_retractation: true, formule: body.plan },
  ]);
  if (!saved) return Response.json({ error: "Nous n'avons pas pu enregistrer ta confirmation de commande, donc le paiement n'a pas été ouvert. Rien n'a été débité : réessaie dans un instant." }, { status: 500 });

  try {
    return await openCheckout(user.id, user.email, profile?.stripe_customer_id as string | null, priceId, body.plan, retour, admin);
  } catch (err) {
    // Détail complet dans les journaux serveur (Vercel), message neutre pour le navigateur.
    const e = err as { type?: string; code?: string; message?: string };
    console.error("[stripe/checkout]", e.type, e.code, e.message);
    const { status, error } = stripeErrorMessage(err);
    return Response.json({ error }, { status });
  }
}

async function openCheckout(userId: string, email: string | undefined, customerId: string | null, priceId: string, plan: string, retour: string, admin: ReturnType<typeof createAdminClient>) {
  const stripe = getStripe();
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
    customerId = customer.id;
    // Le lien client Stripe → utilisateur est enregistré par le serveur : le webhook s'y fie.
    await admin.from("profiles").upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }

  const session = await stripe.checkout.sessions.create({
    // Décollage reste le vendeur : Managed Payments (Stripe vendeur à notre place, activé par défaut
    // sur les nouveaux comptes) exige une catégorie fiscale par produit et bloquerait le paiement.
    // Paramètre récent de l'API, absent des types du SDK : d'où la conversion de type ci-dessous.
    ...({ managed_payments: { enabled: false } } as object),
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { user_id: userId, plan } },
    // Les codes sont saisis et vérifiés sur la page Stripe : seuls les « codes promotionnels »
    // Stripe actifs sont acceptés (le nom d'un coupon ne suffit pas).
    allow_promotion_codes: true,
    success_url: `${appUrl()}/parametres?paiement=ok${retour}`,
    cancel_url: `${appUrl()}/parametres?paiement=annule${retour}`,
  });
  if (!session.url) return Response.json({ error: "Paiement indisponible pour le moment." }, { status: 502 });
  return Response.json({ url: session.url });
}
