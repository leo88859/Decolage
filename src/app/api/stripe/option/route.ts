import { analyzeSubscription, isModifiableStatus } from "@/lib/billing";
import { isPaymentConfigured, stripeBrandPrice, stripeLegacyPrices, stripePrices } from "@/lib/env";
import { checkPurchaseConsent, recordAcceptances } from "@/lib/legal-acceptance";
import { originGuard } from "@/lib/origin";
import { getStripe } from "@/lib/stripe";
import { stripeErrorMessage } from "@/lib/stripe-errors";
import { createAdminClient, getUser } from "@/lib/supabase/server";

/**
 * Ajout / retrait de l'option marque blanche sur l'abonnement SOLO EXISTANT (jamais un second abonnement).
 * Seulement après une action explicite de l'utilisateur. L'abonnement est identifié en base PUIS relu chez Stripe ; le droit
 * (brand_entitlements) n'est écrit que par le webhook, après relecture de l'abonnement : cette route ne l'écrit jamais.
 *  - ajout : ligne « option » ajoutée au même abonnement, facturée tout de suite au prorata du mois en cours (always_invoice) ;
 *    si le paiement échoue, Stripe refuse la modification (error_if_incomplete) : rien n'est changé, pas d'accès offert ;
 *  - retrait : ligne retirée, crédit au prorata sur la prochaine facture ; le droit est retiré par le webhook.
 * Idempotent : option déjà présente (ajout) ou absente (retrait) = succès sans rien modifier ; clé d'idempotence par fenêtre de 10 minutes.
 */
export async function POST(req: Request) {
  const refused = originGuard(req);
  if (refused) return refused;
  if (!isPaymentConfigured()) return Response.json({ error: "Le paiement n'est pas encore activé." }, { status: 503 });
  const brandPrice = stripeBrandPrice();
  if (!brandPrice) return Response.json({ error: "L'option marque blanche n'est pas disponible à l'achat pour le moment. Rien n'a été modifié." }, { status: 503 });
  const { user } = await getUser();
  if (!user) return Response.json({ error: "Connecte-toi." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; acceptCgv?: unknown; renonciation?: unknown; cgvVersion?: unknown };
  if (body.action !== "add" && body.action !== "remove") return Response.json({ error: "Action inconnue." }, { status: 400 });
  if (body.action === "add") {
    const consent = checkPurchaseConsent(body);
    if (!consent.ok) return Response.json({ error: consent.error }, { status: consent.status });
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("plan, stripe_customer_id, stripe_subscription_id, subscription_status").eq("id", user.id).maybeSingle();
  if (error) return Response.json({ error: "Vérification de ton abonnement impossible pour le moment. Rien n'a été modifié : réessaie dans un instant." }, { status: 503 });
  const subId = (profile?.stripe_subscription_id as string | null) ?? null;
  const customerId = (profile?.stripe_customer_id as string | null) ?? null;
  if (profile?.plan !== "solo" || !subId || !customerId) {
    return Response.json({ error: "L'option marque blanche s'ajoute à un abonnement Solo actif. Avec Pro ou Illimité, elle est déjà incluse ; sans abonnement, choisis Solo avec l'option dans « Formule ». Rien n'a été modifié." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    // Stripe est la source de vérité : même client que celui du profil, abonnement actif, formule Solo reconnue, aucun élément inconnu.
    const analysis = analyzeSubscription(sub.status, sub.items.data.map((i) => i.price?.id), stripePrices(), brandPrice, stripeLegacyPrices());
    if (subCustomer !== customerId || !isModifiableStatus(sub.status) || analysis.plan !== "solo" || analysis.ambiguous || analysis.unknownPrices.length) {
      return Response.json({ error: "Ton abonnement n'est pas dans un état qui permet de modifier l'option (il doit être actif, en formule Solo). Ouvre le portail de gestion ou contacte-nous. Rien n'a été modifié." }, { status: 409 });
    }
    const optionItem = sub.items.data.find((i) => i.price?.id === brandPrice);
    const window10 = Math.floor(Date.now() / 600_000);

    if (body.action === "add") {
      if (optionItem) return Response.json({ ok: true, already: true }); // idempotent
      if (sub.cancel_at_period_end) return Response.json({ error: "Ton abonnement est programmé pour se terminer : l'option ne peut pas être ajoutée. Rien n'a été modifié." }, { status: 409 });
      const saved = await recordAcceptances(admin, [{ user_id: user.id, document: "cgv", version: body.cgvVersion as string, contexte: "achat", renonciation_retractation: true, formule: "solo" }]);
      if (!saved) return Response.json({ error: "Nous n'avons pas pu enregistrer ta confirmation de commande : l'option n'a pas été ajoutée et rien n'a été débité. Réessaie dans un instant." }, { status: 500 });
      await stripe.subscriptions.update(sub.id, {
        items: [{ price: brandPrice, quantity: 1 }],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      }, { idempotencyKey: `decollage-option-add-${sub.id}-${window10}` });
      return Response.json({ ok: true });
    }

    if (!optionItem) return Response.json({ ok: true, already: true }); // idempotent
    await stripe.subscriptionItems.del(optionItem.id, { proration_behavior: "create_prorations" }, { idempotencyKey: `decollage-option-remove-${optionItem.id}` });
    return Response.json({ ok: true });
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string };
    console.error("[stripe/option]", e.type, e.code);
    const { status, error: message } = stripeErrorMessage(err);
    return Response.json({ error: `${message} L'option n'a pas été modifiée.` }, { status });
  }
}

/** État affiché dans Paramètres : option vendable ? droit actuel ? (lecture de son propre droit, soumise à la RLS). */
export async function GET() {
  const purchasable = isPaymentConfigured() && Boolean(stripeBrandPrice());
  const { supabase, user } = await getUser();
  if (!user) return Response.json({ purchasable, enabled: false, source: null }, { headers: { "cache-control": "no-store" } });
  const { data } = await supabase.from("brand_entitlements").select("enabled, source").eq("user_id", user.id).maybeSingle();
  return Response.json({ purchasable, enabled: data?.enabled === true, source: (data?.source as string | null) ?? null }, { headers: { "cache-control": "no-store" } });
}
