import { NextResponse, type NextRequest } from "next/server";
import { isCloudConfigured } from "@/lib/env";
import { EMAIL_RE } from "@/lib/publish";
import { createPublicClient } from "@/lib/supabase/server";

// Limite simple par adresse IP (au mieux : la mémoire n'est pas partagée entre instances).
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

/** Inscription à la liste d'attente d'un site publié (formulaire HTML classique). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/waitlist/[slug]">) {
  const { slug } = await ctx.params;
  const back = (ok: boolean) => NextResponse.redirect(new URL(`/s/${slug}?${ok ? "merci" : "erreur"}=1#inscription`, req.url), 303);
  if (!isCloudConfigured() || !/^[a-z0-9-]{3,40}$/.test(slug)) return back(false);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
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

  const { error } = await createPublicClient().from("waitlist").insert({ slug, email });
  // Déjà inscrit (doublon) : on confirme quand même, sans révéler que l'adresse existait.
  return back(!error || error.code === "23505");
}
