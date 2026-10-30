import { createHash, timingSafeEqual } from "node:crypto";
import { adminClient, fonctionAbsente, json } from "@/lib/boutique/api";
import { isCloudConfigured } from "@/lib/env";

// Expiration des commandes « nouvelle » trop anciennes (stock remis une seule fois par la base, migration 0007).
// Route NON planifiée par défaut. Elle n'existe que si la variable d'environnement OPTIONNELLE CRON_SECRET est définie
// (sans elle : 404, rien n'est exécutable). Appel : Authorization: Bearer <CRON_SECRET>. Paramètre facultatif ?heures=72
// (entier de 1 à 720, 72 par défaut). GET est accepté pour les planificateurs qui n'envoient que GET (Vercel Cron envoie
// automatiquement « Authorization: Bearer $CRON_SECRET »).

const digest = (s: string) => createHash("sha256").update(s).digest();

function authorized(req: Request, secret: string): boolean {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  return Boolean(m) && timingSafeEqual(digest(m![1]!), digest(secret));
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return json({ error: "Introuvable.", code: "not_found" }, 404);
  if (!authorized(req, secret)) return json({ error: "Non autorisé.", code: "auth" }, 401);
  if (!isCloudConfigured()) return json({ error: "Non disponible.", code: "demo" }, 503);

  const raw = new URL(req.url).searchParams.get("heures");
  const heures = raw === null ? 72 : /^[0-9]{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(heures) || heures < 1 || heures > 720) return json({ error: "heures : entier de 1 à 720.", code: "invalid" }, 400);

  const admin = adminClient();
  if (!admin) return json({ error: "Non configuré.", code: "server" }, 503);
  const { data, error } = await admin.rpc("boutique_expirer_commandes_nouvelles", { p_age: `${heures} hours` });
  if (error) {
    if (fonctionAbsente(error)) return json({ error: "Migration 0007 pas encore exécutée.", code: "migration" }, 503);
    return json({ error: "Expiration impossible pour le moment.", code: "server" }, 500);
  }
  return json({ annulees: typeof data === "number" ? data : 0, heures });
}

export const POST = run;
export const GET = run;
