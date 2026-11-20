import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Garde-fous du lanceur de tests PostgreSQL réels (supabase/tests/run-tests.mjs). Aucune base n'est touchée :
// le lanceur sort AVANT toute connexion dans ces trois cas.
const script = resolve(process.cwd(), "supabase/tests/run-tests.mjs");
const lancer = (url: string) =>
  spawnSync(process.execPath, [script], { env: { ...process.env, TEST_PG_URL: url }, encoding: "utf8", timeout: 20_000 });

describe("lanceur de tests PostgreSQL réels : garde-fous", () => {
  it("sans TEST_PG_URL : rien n'est exécuté, sortie 0, message « non exécuté »", () => {
    const r = lancer("");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/non exécuté : TEST_PG_URL absent/);
  });

  it("URL Supabase (production ou projet) : refus, sortie 2, et le mot de passe n'est jamais affiché", () => {
    const secret = "MotDePasseSecretTresLong123";
    const r = lancer(`postgres://postgres.abcdef:${secret}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/REFUS : hôte Supabase/);
    expect(r.stdout + r.stderr).not.toContain(secret);
  });

  it("URL invalide : refus, sortie 2, sans connexion", () => {
    const r = lancer("pas une url");
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/TEST_PG_URL invalide/);
  });
});
