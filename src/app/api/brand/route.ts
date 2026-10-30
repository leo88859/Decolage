import { authorize, json, loadRow, persist, readJson, stateOf } from "@/lib/brand/api";
import { DEFAULT_BRAND } from "@/lib/brand/types";
import { validateBrand } from "@/lib/brand/validate";

// Marque blanche : la marque de l'utilisateur CONNECTÉ (identifiant toujours pris de la session).

/** Lit sa marque (ou les valeurs par défaut si rien n'est enregistré). */
export async function GET(req: Request) {
  const ctx = await authorize(req, false);
  if (ctx instanceof Response) return ctx;
  const { row, failed } = await loadRow(ctx.supabase, ctx.userId);
  if (failed) return json({ error: "Lecture impossible pour le moment." }, 500);
  return json(stateOf(row));
}

/** Enregistre la marque (remplacement complet). Le corps ne peut jamais désigner un autre utilisateur. */
export async function PUT(req: Request) {
  const ctx = await authorize(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  if (!body.ok) return body.res;
  const v = validateBrand(body.body);
  if (!v.ok) return json({ error: "Certains champs sont invalides.", errors: v.errors }, 400);
  const { row, failed } = await loadRow(ctx.supabase, ctx.userId);
  if (failed) return json({ error: "Lecture impossible pour le moment." }, 500);
  return persist(ctx, v.brand, row);
}

/** Réinitialise aux valeurs par défaut (l'ancienne marque reste récupérable via /api/brand/restore). */
export async function DELETE(req: Request) {
  const ctx = await authorize(req, true);
  if (ctx instanceof Response) return ctx;
  const { row, failed } = await loadRow(ctx.supabase, ctx.userId);
  if (failed) return json({ error: "Lecture impossible pour le moment." }, 500);
  if (!row) return json({ ok: true, ...stateOf(null) }); // rien d'enregistré : déjà aux valeurs par défaut
  return persist(ctx, { ...DEFAULT_BRAND }, row);
}
