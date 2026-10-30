import { describe, expect, it } from "vitest";
import { stripeErrorMessage } from "@/lib/stripe-errors";

describe("erreurs Stripe", () => {
  it("distingue configuration, panne et refus, sans détail technique", () => {
    expect(stripeErrorMessage({ type: "StripeAuthenticationError", message: "Invalid API Key provided: rk_live_xxx" })).toEqual({ status: 503, error: expect.stringContaining("mal configuré") });
    expect(stripeErrorMessage({ type: "StripePermissionError" }).status).toBe(503);
    expect(stripeErrorMessage({ type: "StripeConnectionError" }).status).toBe(502);
    expect(stripeErrorMessage({ type: "StripeInvalidRequestError", message: "No such price" }).error).toContain("Aucun montant");
    expect(stripeErrorMessage(new Error("boom")).status).toBe(500);
    expect(stripeErrorMessage(null).status).toBe(500);
    // Jamais la clé ni le message brut de Stripe.
    for (const t of ["StripeAuthenticationError", "StripeInvalidRequestError", undefined])
      expect(stripeErrorMessage({ type: t, message: "Invalid API Key provided: rk_live_xxx" }).error).not.toMatch(/rk_|sk_|Invalid API/);
    // Aucun message ne parle de code de réduction : ce n'est jamais le site qui refuse un code.
    for (const t of ["StripeAuthenticationError", "StripeConnectionError", "StripeInvalidRequestError", undefined])
      expect(stripeErrorMessage({ type: t }).error).not.toMatch(/code/i);
  });
});
