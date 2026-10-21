import "server-only";

// Variables d'environnement côté serveur. Les fonctions « en ligne » s'activent seulement
// quand leurs variables sont présentes : sans elles, Décollage reste utilisable en local.

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export class MissingConfigError extends Error {}

function required(name: string): string {
  const value = read(name);
  if (!value) throw new MissingConfigError(`Configuration manquante : ${name}`);
  return value;
}

export const supabaseEnv = () => ({ url: required("NEXT_PUBLIC_SUPABASE_URL"), anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY") });
export const supabaseServiceKey = () => required("SUPABASE_SERVICE_ROLE_KEY");
export const appUrl = () => (read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");

export const stripeSecretKey = () => required("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = () => required("STRIPE_WEBHOOK_SECRET");
/** Identifiants des prix Stripe de chaque formule payante (seule liste autorisée). */
export const stripePrices = () => ({ solo: read("STRIPE_PRICE_SOLO"), pro: read("STRIPE_PRICE_PRO"), illimite: read("STRIPE_PRICE_ILLIMITE") });

export const isCloudConfigured = () => Boolean(read("NEXT_PUBLIC_SUPABASE_URL") && read("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
export const isPaymentConfigured = () => {
  const p = stripePrices();
  return isCloudConfigured() && Boolean(read("SUPABASE_SERVICE_ROLE_KEY") && read("STRIPE_SECRET_KEY") && read("STRIPE_WEBHOOK_SECRET") && p.solo && p.pro && p.illimite);
};
