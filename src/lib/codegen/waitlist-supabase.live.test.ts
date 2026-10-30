import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test réel de la liste d'attente sur un projet Supabase DE TEST (jamais celui de Décollage).
// Ne tourne que si .env.test.local contient SUPABASE_TEST_URL et SUPABASE_TEST_ANON_KEY (valeurs publiques).
// Prérequis côté projet de test : migration 0001_liste_attente.sql exécutée, confirmation d'e-mail désactivée.
const env = (f: string) => existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)).filter((m) => !!m).map((m) => [m[1], m[2]])) : {};
const T = env(".env.test.local");
const PROD = env(".env.local").NEXT_PUBLIC_SUPABASE_URL;
const URL = T.SUPABASE_TEST_URL ?? "";
const KEY = T.SUPABASE_TEST_ANON_KEY ?? "";
const ready = !!URL && !!KEY;

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now().toString(36);
let A: SupabaseClient, B: SupabaseClient, anon: SupabaseClient;
let LA = "", LB = "";

async function compte(nom: string) {
  const c = client();
  const { data, error } = await c.auth.signUp({ email: `decollage-test-${nom}-${stamp}@example.com`, password: `Test-${stamp}-${nom}!` });
  if (error) throw new Error(`Création du compte de test ${nom} refusée : ${error.message}`);
  if (!data.session) throw new Error("Pas de session : désactive « Confirm email » dans le projet de test (Authentication → Sign In / Providers → Email).");
  return c;
}
const liste = async (c: SupabaseClient, nom: string) => {
  const { data, error } = await c.from("listes").insert({ nom }).select("id").single();
  if (error) throw new Error(`Création de liste refusée (migration exécutée ?) : ${error.message}`);
  return data.id as string;
};
const inscrire = async (l: string, email: string, donnees: unknown = {}) => {
  const { data, error } = await anon.rpc("inscrire", { p_liste: l, p_email: email, p_donnees: donnees });
  if (error) throw new Error(error.message);
  return data as string;
};
const lus = async (c: SupabaseClient, l?: string) => {
  let q = c.from("inscriptions").select("id, liste_id, email");
  if (l) q = q.eq("liste_id", l);
  const { data, error } = await q;
  return error ? { error: error.message } : data;
};

describe.runIf(ready)("liste d'attente sur un vrai projet Supabase de test", () => {
  beforeAll(async () => {
    if (PROD && URL.replace(/\/$/, "") === PROD.replace(/\/$/, "")) throw new Error("SUPABASE_TEST_URL pointe vers la base de production de Décollage : test refusé.");
    anon = client();
    A = await compte("a");
    B = await compte("b");
    LA = await liste(A, "Test A " + stamp);
    LB = await liste(B, "Test B " + stamp);
  }, 30000);
  afterAll(async () => {
    // Les données de test sont supprimées par leurs propriétaires (les inscriptions suivent en cascade).
    if (LA) await A.from("listes").delete().eq("id", LA);
    if (LB) await B.from("listes").delete().eq("id", LB);
  });

  it("un visiteur s'inscrit ; les doublons et les adresses invalides sont gérés par la base", async () => {
    expect(await inscrire(LA, " Marie@Exemple.fr ", { Source: "Instagram" })).toBe("ok");
    expect(await inscrire(LA, "marie@exemple.fr")).toBe("ok");
    expect(await inscrire(LA, "pas-un-email")).toBe("email_invalide");
    expect(await inscrire("00000000-0000-4000-8000-000000000000", "x@exemple.fr")).toBe("liste_inconnue");
    expect(await lus(A, LA)).toEqual([expect.objectContaining({ liste_id: LA, email: "marie@exemple.fr" })]);
  });

  it("un visiteur ne peut rien lire ni écrire directement", async () => {
    expect(await lus(anon)).toHaveProperty("error");
    const { error } = await anon.from("inscriptions").insert({ liste_id: LA, email: "pirate@exemple.fr" });
    expect(error).not.toBeNull();
    expect((await anon.from("listes").select("id")).error).not.toBeNull();
  });

  it("un autre propriétaire ne voit ni ne modifie rien de la liste A", async () => {
    expect(await lus(B, LA)).toEqual([]);
    expect((await B.from("listes").select("id")).data).toEqual([{ id: LB }]);
    expect((await B.from("inscriptions").delete().eq("liste_id", LA).select("id")).data ?? []).toEqual([]);
    expect((await B.from("listes").update({ nom: "volée" }).eq("id", LA).select("id")).data ?? []).toEqual([]);
    expect((await B.from("inscriptions").insert({ liste_id: LB, email: "x@exemple.fr" })).error).not.toBeNull();
    expect(await lus(A, LA)).toHaveLength(1);
  });

  it("le propriétaire supprime ses inscriptions", async () => {
    const { data } = await A.from("inscriptions").delete().eq("liste_id", LA).select("id");
    expect(data).toHaveLength(1);
    expect(await lus(A, LA)).toEqual([]);
  });
});
