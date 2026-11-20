import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { computeEffectiveBrand, getEffectiveBrand, readEntitlement, sanitizeStoredBrand } from "./effective";
import { brandToCssVars } from "./css";
import { dataUrl, pngBytes } from "./test-utils";
import { DEFAULT_BRAND, LOGO_MAX_BYTES } from "./types";

type Row = Record<string, unknown>;
type Db = { brand_configs: Row[]; brand_entitlements: Row[]; profiles: Row[] };

// Faux client supabase en mémoire (select / eq / maybeSingle uniquement), avec erreur de lecture possible.
function fakeClient(db: Db, failTable?: keyof Db): SupabaseClient {
  const from = (t: keyof Db) => {
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (filters.push([c, v]), q),
      maybeSingle: async () => {
        if (t === failTable) return { data: null, error: { message: "boom" } };
        const r = db[t].find((x) => filters.every(([c, v]) => x[c] === v));
        return { data: r ? { ...r } : null, error: null };
      },
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const row = (user_id: string, over: Row = {}): Row => ({
  user_id, name: "Marque", color_primary: "#112233", color_secondary: "#223344", color_accent: "#334455",
  color_surface: "#f0f0f0", color_text: "#101010", logo_data: null, favicon_data: null, version: 3, updated_at: "2026-11-15T10:00:00Z", ...over,
});
const newDb = (): Db => ({ brand_configs: [], brand_entitlements: [], profiles: [] });

describe("droit : formule ET option, calculé côté serveur", () => {
  const cases: [string, string, boolean, boolean][] = [
    ["gratuit", "gratuit", false, false],
    ["solo sans option", "solo", false, false],
    ["solo avec option", "solo", true, true],
    ["pro", "pro", false, true],
    ["illimite", "illimite", false, true],
    ["formule inconnue", "platine", true, false],
  ];
  for (const [label, plan, option, expected] of cases) {
    it(`${label} : ${expected ? "accord" : "refus"}`, async () => {
      const db = newDb();
      db.profiles.push({ id: A, plan });
      db.brand_entitlements.push({ user_id: A, enabled: option });
      expect(computeEffectiveBrand({ plan, optionActive: option, row: null }).entitled).toBe(expected);
      expect(await readEntitlement(fakeClient(db), A)).toEqual({ ok: true, entitled: expected });
      expect((await getEffectiveBrand(fakeClient(db), A))?.entitled).toBe(expected);
    });
  }
  it("aucune ligne (ni profil, ni option) : refus", async () => {
    expect(await readEntitlement(fakeClient(newDb()), A)).toEqual({ ok: true, entitled: false });
  });
  it("option stockée autrement que true (chaîne, 1) : refus", () => {
    expect(computeEffectiveBrand({ plan: "solo", optionActive: "true", row: null }).entitled).toBe(false);
    expect(computeEffectiveBrand({ plan: "solo", optionActive: 1, row: null }).entitled).toBe(false);
  });
  it("erreur de lecture : fail-closed (null / ok:false)", async () => {
    const db = newDb();
    for (const t of ["brand_configs", "brand_entitlements", "profiles"] as const) {
      expect(await getEffectiveBrand(fakeClient(db, t), A)).toBeNull();
    }
    expect(await readEntitlement(fakeClient(db, "profiles"), A)).toEqual({ ok: false });
  });
});

describe("perte puis réactivation du droit : l'identité est conservée", () => {
  it("les paramètres restent en base à chaque étape, seul `entitled` change", async () => {
    const db = newDb();
    db.profiles.push({ id: A, plan: "solo" });
    db.brand_entitlements.push({ user_id: A, enabled: true });
    db.brand_configs.push(row(A, { name: "Acme" }));
    const c = fakeClient(db);
    const e1 = (await getEffectiveBrand(c, A))!;
    expect(e1.entitled).toBe(true);
    expect(e1.brand.name).toBe("Acme");
    // L'option est retirée (résiliation) : rien n'est supprimé.
    db.brand_entitlements[0]!.enabled = false;
    const e2 = (await getEffectiveBrand(c, A))!;
    expect(e2.entitled).toBe(false);
    expect(e2.brand).toEqual(e1.brand);
    expect(db.brand_configs).toHaveLength(1);
    // Passage à Pro : accord sans option.
    db.profiles[0]!.plan = "pro";
    expect((await getEffectiveBrand(c, A))!.entitled).toBe(true);
    // Retour à Solo sans option, puis réactivation.
    db.profiles[0]!.plan = "solo";
    expect((await getEffectiveBrand(c, A))!.entitled).toBe(false);
    db.brand_entitlements[0]!.enabled = true;
    const e4 = (await getEffectiveBrand(c, A))!;
    expect(e4.entitled).toBe(true);
    expect(e4.brand).toEqual(e1.brand);
    expect(e4.version).toBe(3);
  });
});

describe("isolation entre comptes", () => {
  it("deux utilisateurs, deux identités : chacun ne voit que la sienne", async () => {
    const db = newDb();
    db.profiles.push({ id: A, plan: "pro" }, { id: B, plan: "illimite" });
    db.brand_configs.push(row(A, { name: "Alpha", color_primary: "#aa0000" }), row(B, { name: "Beta", color_primary: "#0000bb" }));
    const c = fakeClient(db);
    const a = (await getEffectiveBrand(c, A))!;
    const b = (await getEffectiveBrand(c, B))!;
    expect([a.brand.name, a.brand.primary]).toEqual(["Alpha", "#aa0000"]);
    expect([b.brand.name, b.brand.primary]).toEqual(["Beta", "#0000bb"]);
    expect(JSON.stringify(a)).not.toContain("Beta");
    expect(JSON.stringify(b)).not.toContain("Alpha");
  });
  it("le droit d'un autre compte ne se transmet pas", async () => {
    const db = newDb();
    db.profiles.push({ id: A, plan: "pro" }, { id: B, plan: "solo" });
    db.brand_entitlements.push({ user_id: A, enabled: true });
    expect((await getEffectiveBrand(fakeClient(db), B))!.entitled).toBe(false);
  });
  it("la fonction n'accepte qu'un identifiant : un compte inconnu n'obtient ni droit ni identité d'autrui", async () => {
    const db = newDb();
    db.profiles.push({ id: A, plan: "pro" });
    db.brand_configs.push(row(A, { name: "Alpha" }));
    const e = (await getEffectiveBrand(fakeClient(db), B))!;
    expect(e).toMatchObject({ entitled: false, saved: false });
    expect(e.brand).toEqual(DEFAULT_BRAND);
  });
  it("localStorage / corps de requête : aucun paramètre de droit possible", () => {
    // La signature ne prend ni requête ni stockage : une prétention externe ne peut qu'être ignorée.
    expect(getEffectiveBrand.length).toBe(2);
    expect(computeEffectiveBrand.length).toBe(1);
    const claim = { entitled: true, whiteLabel: true, plan: "pro" };
    const e = computeEffectiveBrand({ plan: "solo", optionActive: false, row: { ...row(A), ...claim } });
    expect(e.entitled).toBe(false);
  });
});

describe("valeurs de remplacement et validation à la lecture", () => {
  it("configuration vide : valeurs par défaut neutres", () => {
    const e = computeEffectiveBrand({ plan: "pro", optionActive: false, row: null });
    expect(e).toMatchObject({ saved: false, version: 0, updatedAt: null, entitled: true });
    expect(e.brand).toEqual(DEFAULT_BRAND);
    expect(sanitizeStoredBrand({})).toEqual(DEFAULT_BRAND);
  });
  it("nom vide ou balisé -> nom par défaut ; couleur absente -> couleur par défaut", () => {
    expect(sanitizeStoredBrand(row(A, { name: "  " })).name).toBe(DEFAULT_BRAND.name);
    expect(sanitizeStoredBrand(row(A, { name: "<b>x</b>" })).name).toBe(DEFAULT_BRAND.name);
    const b = sanitizeStoredBrand(row(A, { color_accent: null }));
    expect(b.accent).toBe(DEFAULT_BRAND.accent);
    expect(b.primary).toBe("#112233");
  });
  it("couleur invalide : refusée, jamais injectée dans le CSS", () => {
    const evil = "red; background:url(https://evil.test/x)";
    const b = sanitizeStoredBrand(row(A, { color_primary: evil, color_text: "#fff", color_accent: "url(x)" }));
    expect(b.primary).toBe(DEFAULT_BRAND.primary);
    expect(b.text).toBe(DEFAULT_BRAND.text);
    expect(b.accent).toBe(DEFAULT_BRAND.accent);
    const css = brandToCssVars({ ...b, primary: evil });
    expect(css).not.toMatch(/url|red|evil|background/);
  });
  it("logo : format, taille ou URL non autorisés -> aucun logo", () => {
    const good = dataUrl("image/png", pngBytes(80));
    expect(sanitizeStoredBrand(row(A, { logo_data: good })).logo).toBe(good);
    expect(sanitizeStoredBrand(row(A, { logo_data: "https://evil.test/logo.png" })).logo).toBeNull();
    expect(sanitizeStoredBrand(row(A, { logo_data: "javascript:alert(1)" })).logo).toBeNull();
    expect(sanitizeStoredBrand(row(A, { logo_data: `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)/>").toString("base64")}` })).logo).toBeNull();
    expect(sanitizeStoredBrand(row(A, { logo_data: dataUrl("image/png", pngBytes(LOGO_MAX_BYTES + 10)) })).logo).toBeNull();
    expect(sanitizeStoredBrand(row(A, { logo_data: dataUrl("image/png", new Uint8Array(64)) })).logo).toBeNull(); // faux PNG
    expect(sanitizeStoredBrand(row(A, { favicon_data: dataUrl("image/jpeg", pngBytes(64)) })).favicon).toBeNull();
  });
});
