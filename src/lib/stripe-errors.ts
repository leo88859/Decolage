/** Message affichable pour une erreur Stripe, sans jamais renvoyer le détail technique au navigateur. */
export function stripeErrorMessage(err: unknown): { status: number; error: string } {
  const type = (err as { type?: string } | null)?.type;
  if (type === "StripeAuthenticationError" || type === "StripePermissionError")
    return { status: 503, error: "Le paiement est mal configuré côté serveur. Réessaie plus tard ou contacte le support." };
  if (type === "StripeRateLimitError" || type === "StripeConnectionError" || type === "StripeAPIError")
    return { status: 502, error: "Stripe ne répond pas pour le moment. Réessaie dans quelques minutes." };
  if (type === "StripeInvalidRequestError")
    return { status: 502, error: "Stripe a refusé la création du paiement. Aucun montant n'a été débité." };
  return { status: 500, error: "Paiement indisponible pour le moment. Aucun montant n'a été débité." };
}
