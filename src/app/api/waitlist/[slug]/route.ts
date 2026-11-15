import { NextResponse, type NextRequest } from "next/server";
import { isCloudConfigured } from "@/lib/env";
import { EMAIL_RE } from "@/lib/publish";
import { adminClient, clientIp, dbTooMany } from "@/lib/boutique/api";
import { WAITLIST_CONSENT_FIELD, WAITLIST_CONSENT_VERSION, hasConsent } from "@/lib/waitlist-consent";

// Limite en mémoire par adresse IP (au mieux : la mémoire n'est pas partagée entre instances). Elle est complétée plus bas
// par une limite PARTAGÉE en base (migration 0007, fonction limite_debit) qui, elle, tient entre plusieurs instances.
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

/**
 * Inscription à la liste d'attente d'un site publié (formulaire HTML classique).
 * Consentement OBLIGATOIRE : contrôlé ici (400 sans la case cochée), puis par la fonction SQL. Tant que la migration 0011 n'est
 * pas exécutée, aucune inscription n'est enregistrée (jamais d'inscription sans preuve de consentement).
 * L'écriture se fait avec la clé service_role par la fonction SQL waitlist_inscrire_consent (migration 0011) : le navigateur n'a
 * plus le droit d'insérer directement. Un doublon reçoit exactement la même réponse qu'une nouvelle inscription.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/waitlist/[slug]">) {
  const { slug } = await ctx.params;
  const back = (ok: boolean) => NextResponse.redirect(new URL(`/s/${slug}?${ok ? "merci" : "erreur"}=1#inscription`, req.url), 303);
  if (!isCloudConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return back(false);

  const ip = clientIp(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(false);
  }
  // Champ piège invisible : un humain ne le remplit jamais.
  if (String(form.get("site") ?? "")) return back(true);
  // Consentement obligatoire : refus côté serveur, quel que soit le navigateur ou l'outil qui envoie la requête.
  if (!hasConsent(form.get(WAITLIST_CONSENT_FIELD))) return consentRequired(slug);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254 || tooMany(ip)) return back(false);

  const admin = adminClient();
  if (!admin) return back(false);
  // Limites partagées en base : 8 par minute et 40 par heure et par adresse IP (au-delà : même réponse que l'échec).
  if ((await dbTooMany(admin, "wl-min", ip, 8, 60)) || (await dbTooMany(admin, "wl-h", ip, 40, 3600))) return back(false);

  const { data, error } = await admin.rpc("waitlist_inscrire_consent", { p_slug: slug, p_email: email, p_consentement: true, p_texte_version: WAITLIST_CONSENT_VERSION });
  if (!error) {
    if (data === "consentement_requis") return consentRequired(slug);
    // 'ok' = inscrit OU déjà inscrit (même réponse, rien n'est révélé). Les autres codes sont des refus sans lien avec l'adresse.
    return back(data === "ok");
  }
  // Fonction absente (migration 0011 pas encore exécutée) ou autre erreur : on n'enregistre RIEN, faute de preuve de consentement.
  return back(false);
}

function consentRequired(slug: string) {
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consentement nécessaire</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;line-height:1.5"><h1 style="font-size:22px">Consentement nécessaire</h1><p>Ton inscription n’a pas été enregistrée : il faut cocher la case qui explique à qui est transmise ton adresse e-mail et pourquoi.</p><p><a href="/s/${slug}#inscription">Revenir au formulaire</a></p></body></html>`;
  return new Response(html, { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
