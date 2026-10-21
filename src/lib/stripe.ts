import "server-only";
import Stripe from "stripe";
import { stripeSecretKey } from "@/lib/env";

let client: Stripe | null = null;

/** Client Stripe côté serveur uniquement : la clé secrète ne quitte jamais le serveur. */
export function getStripe(): Stripe {
  client ??= new Stripe(stripeSecretKey(), { maxNetworkRetries: 2, appInfo: { name: "Décollage" } });
  return client;
}
