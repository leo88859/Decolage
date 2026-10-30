import { authorize, json, loadRow, persist } from "@/lib/brand/api";
import { validateBrand } from "@/lib/brand/validate";

/** Revient à l'enregistrement précédent (annuler le dernier enregistrement). Aucun corps lu. */
export async function POST(req: Request) {
  const ctx = await authorize(req, true);
  if (ctx instanceof Response) return ctx;
  const { row, failed } = await loadRow(ctx.supabase, ctx.userId);
  if (failed) return json({ error: "Lecture impossible pour le moment." }, 500);
  // L'instantané est revalidé comme toute entrée : une valeur altérée en base ne passe pas.
  const prev = row?.previous ? validateBrand(row.previous) : null;
  if (!row || !prev || !prev.ok) return json({ error: "Aucun enregistrement précédent à restaurer.", code: "nothing" }, 409);
  return persist(ctx, prev.brand, row);
}
