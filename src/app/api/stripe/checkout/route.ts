import { blockingStatus, buildCheckoutLines, existingSubscriptionRefusal, subscriptionBlocksCheckout, verificationRefusal } from "@/lib/billing";
import { appUrl, isPaymentConfigured, stripeBrandPrice, stripePrices } from "@/lib/env";
import { checkPurchaseConsent, recordAcceptances } from "@/lib/legal-acceptance";
import { originGuard } from "@/lib/origin";
import { isPaidPlan, normalizePlan } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { stripeErrorMessage } from "@/lib/stripe-errors";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/**
 * Ouvre le paiement Stripe d'une formule. Le navigateur n'envoie que le nom de la formule (et, pour Solo seulement, le choix de l'option
 * marque blanche) : les prix sont choisis côté serveur dans la liste autorisée. Toujours UN SEUL abonnement (l'option est une 2e ligne).
 */
export async function POST(req: Request) {
  const refused = originGuard(req);
  if (refused) return refused;
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi pour t'abonner." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; retour?: unknown; acceptCgv?: unknown; renonciation?: unknown; cgvVersion?: unknown; brandOption?: unknown };
  // Retour vers l'idée en cours après paiement : uniquement un chemin interne vers /creer.
  const retour = typeof body.retour === "string" && /^\/creer(\?|$)/.test(body.retour) && body.retour.length <= 600 ? `&retour=${encodeURIComponent(body.retour)}` : "";
  if (!isPaidPlan(body.plan)) return Response.json({ error: "Formule inconnue." }, { status: 400 });
  const built = buildCheckoutLines(body.plan, body.brandOption, stripePrices(), stripeBrandPrice());
  if (!built.ok) return Response.json({ error: built.error }, { status: built.status });

  // Commande avec obligation de paiement : le serveur exige les confirmations (CGV lues, accès immédiat et
  // renonciation à la rétractation) et en garde la preuve AVANT d'ouvrir le paiement.
  const consent = checkPurchaseConsent(body);
  if (!consent.ok) return Response.json({ error: consent.error }, { status: consent.status });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("plan, stripe_customer_id, stripe_subscription_id, subscription_status").eq("id", user.id).maybeSingle();
  if (profileError) return Response.json(verificationRefusal(), { status: 503 });
  // Un seul abonnement à la fois : les changements de formule passent par le portail Stripe (prorata géré par Stripe).
  // Refus dans le doute : seul un abonnement PROUVÉ terminé (canceled / incomplete_expired) autorise un nouveau paiement.
  // Le message et l'action dépendent du statut (docs/STRIPE-ABONNEMENT-PRUDENT.md) ; le refus reste identique : jamais de second abonnement.
  const knownCustomer = (profile?.stripe_customer_id as string | null) ?? null;
  const existing = (status: string | null | undefined) => Response.json(existingSubscriptionRefusal(status, Boolean(knownCustomer)), { status: 409 });
  const storedStatus = (profile?.subscription_status as string | null) ?? null;
  if (normalizePlan(profile?.plan) !== "gratuit") return existing(storedStatus);
  if (profile?.stripe_subscription_id && subscriptionBlocksCheckout(storedStatus)) return existing(storedStatus);
  if (knownCustomer) {
    // Stripe est la source de vérité : la base peut être en retard sur un webhook. Une erreur de lecture ne prouve jamais l'absence.
    let subs: { data?: { status?: string }[]; has_more?: boolean };
    try {
      subs = await getStripe().subscriptions.list({ customer: knownCustomer, status: "all", limit: 100 });
    } catch (err) {
      console.error("[stripe/checkout] lecture des abonnements impossible", (err as { type?: string }).type);
      return Response.json(verificationRefusal(), { status: 503 });
    }
    if (!Array.isArray(subs?.data) || subs.has_more) return Response.json(verificationRefusal(), { status: 503 });
    const worst = blockingStatus(subs.data.map((s) => s.status));
    if (worst !== undefined) return existing(worst);
  }

  const saved = await recordAcceptances(admin, [
    { user_id: user.id, document: "cgv", version: body.cgvVersion as string, contexte: "achat", renonciation_retractation: true, formule: body.plan },
  ]);
  if (!saved) return Response.json({ error: "Nous n'avons pas pu enregistrer ta confirmation de commande, donc le paiement n'a pas été ouvert. Rien n'a été débité : réessaie dans un instant." }, { status: 500 });

  try {
    return await openCheckout(user.id, user.email, knownCustomer, built.lines, built.brandOption, body.plan, retour, admin);
  } catch (err) {
    // Détail complet dans les journaux serveur (Vercel), message neutre pour le navigateur.
    const e = err as { type?: string; code?: string; message?: string };
    console.error("[stripe/checkout]", e.type, e.code, e.message);
    const { status, error } = stripeErrorMessage(err);
    return Response.json({ error }, { status });
  }
}

/** Empreinte courte (non secrète) : une même clé d'idempotence ne doit jamais servir avec des paramètres différents (retour). */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function openCheckout(userId: string, email: string | undefined, customerId: string | null, lines: { price: string; quantity: 1 }[], brandOption: boolean, plan: string, retour: string, admin: ReturnType<typeof createAdminClient>) {
  const stripe = getStripe();
  if (!customerId) {
    // Clé d'idempotence Stripe : deux demandes simultanées sans client connu obtiennent le MÊME client (pas de client orphelin).
    const customer = await stripe.customers.create({ email, metadata: { user_id: userId } }, { idempotencyKey: `decollage-customer-${userId}` });
    customerId = customer.id;
    // Le lien client Stripe → utilisateur est enregistré par le serveur : le webhook s'y fie.
    await admin.from("profiles").upsert({ id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }

  // Clé d'idempotence : deux clics (ou deux onglets) sur la même formule dans les mêmes 10 minutes obtiennent LA MÊME session
  // de paiement, qui ne peut être payée qu'une fois. Formules ou fenêtres différentes : sessions distinctes (voir la doc).
  const window10 = Math.floor(Date.now() / 600_000);
  const session = await stripe.checkout.sessions.create({
    // Décollage reste le vendeur : Managed Payments (Stripe vendeur à notre place, activé par défaut
    // sur les nouveaux comptes) exige une catégorie fiscale par produit et bloquerait le paiement.
    // Paramètre récent de l'API, absent des types du SDK : d'où la conversion de type ci-dessous.
    ...({ managed_payments: { enabled: false } } as object),
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: lines,
    subscription_data: { metadata: { user_id: userId, plan, brand_option: brandOption ? "1" : "0" } },
    // Les codes sont saisis et vérifiés sur la page Stripe : seuls les « codes promotionnels »
    // Stripe actifs sont acceptés (le nom d'un coupon ne suffit pas).
    allow_promotion_codes: true,
    success_url: `${appUrl()}/parametres?paiement=ok${retour}`,
    cancel_url: `${appUrl()}/parametres?paiement=annule${retour}`,
  }, { idempotencyKey: `decollage-checkout-${userId}-${plan}${brandOption ? "+brand" : ""}-${lines.map((l) => l.price).join("+")}-${shortHash(retour)}-${window10}` });
  if (!session.url) return Response.json({ error: "Paiement indisponible pour le moment." }, { status: 502 });
  return Response.json({ url: session.url });
}
