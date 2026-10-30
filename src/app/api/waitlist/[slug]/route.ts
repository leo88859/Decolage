import { NextResponse, type NextRequest } from "next/server";
import { isCloudConfigured } from "@/lib/env";
import { EMAIL_RE } from "@/lib/publish";
import { adminClient, clientIp, dbTooMany, fonctionAbsente } from "@/lib/boutique/api";

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
 * L'écriture se fait avec la clé service_role par la fonction SQL waitlist_inscrire (migration 0007) : le navigateur n'a
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
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254 || tooMany(ip)) return back(false);

  const admin = adminClient();
  if (!admin) return back(false);
  // Limites partagées en base : 8 par minute et 40 par heure et par adresse IP (au-delà : même réponse que l'échec).
  if ((await dbTooMany(admin, "wl-min", ip, 8, 60)) || (await dbTooMany(admin, "wl-h", ip, 40, 3600))) return back(false);

  const { data, error } = await admin.rpc("waitlist_inscrire", { p_slug: slug, p_email: email });
  if (!error) {
    // 'ok' = inscrit OU déjà inscrit (même réponse, rien n'est révélé). Les autres codes sont des refus sans lien avec l'adresse.
    return back(data === "ok");
  }
  if (fonctionAbsente(error)) {
    // Migration 0007 pas encore exécutée : ancien chemin (insertion par le serveur). Un doublon est confirmé sans le révéler.
    // (la politique d'insertion qui refusait les sites suspendus ne protège plus l'écriture par le serveur : on le vérifie ici)
    const site = await admin.from("sites").select("slug").eq("slug", slug).is("suspended_at", null).maybeSingle();
    if (site.error || !site.data) return back(false);
    const r = await admin.from("waitlist").insert({ slug, email });
    return back(!r.error || r.error.code === "23505");
  }
  return back(false);
}
