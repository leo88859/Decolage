import { isCloudConfigured } from "@/lib/env";
import { checkAcceptance, hasAcceptedSignupDocs, recordAcceptances, SIGNUP_DOCS, type AcceptanceRow, type LegalReader } from "@/lib/legal-acceptance";
import { createAdminClient, getUser } from "@/lib/supabase/server";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Le compte connecté a-t-il accepté les versions en vigueur ? (`accepted: null` = impossible à savoir, ne pas bloquer.) */
export async function GET() {
  if (!isCloudConfigured()) return json({ accepted: null });
  const { supabase, user } = await getUser();
  if (!user) return json({ error: "Connecte-toi." }, 401);
  return json({ accepted: await hasAcceptedSignupDocs(supabase as unknown as LegalReader, user.id) });
}

/**
 * Enregistre l'acceptation des CGU et de la politique de confidentialité (inscription / première connexion).
 * L'acceptation des CGV se fait au moment de l'achat, dans /api/stripe/checkout.
 * Le serveur vérifie que les versions envoyées sont celles en vigueur ; l'identité vient de la session, jamais du corps.
 */
export async function POST(req: Request) {
  if (!isCloudConfigured()) return json({ error: "Non disponible." }, 503);
  const { user } = await getUser();
  if (!user) return json({ error: "Connecte-toi." }, 401);
  const body = await req.json().catch(() => null);
  const check = checkAcceptance(body, SIGNUP_DOCS);
  if (!check.ok) return json({ error: check.error }, check.status);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return json({ error: "Enregistrement indisponible pour le moment (configuration serveur)." }, 503);
  }
  const rows: AcceptanceRow[] = check.documents.map((d) => ({ user_id: user.id, document: d.document, version: d.version, contexte: "inscription", renonciation_retractation: false, formule: null }));
  if (!(await recordAcceptances(admin, rows))) return json({ error: "Enregistrement impossible pour le moment. Réessaie dans un instant." }, 500);
  return json({ ok: true });
}
