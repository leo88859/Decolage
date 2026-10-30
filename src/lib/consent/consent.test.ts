import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __setStorage, acceptAll, addMonths, CONSENT_KEY, CONSENT_MONTHS, CONSENT_VERSION, getConsent, hasConsent, loadIfConsented,
  needsPrompt, OPTIONAL_TRACKERS, refuseAll, setConsent, withdraw, type StorageLike, type TrackerDef,
} from "./consent";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const T0 = new Date("2026-10-29T10:00:00Z");
const fakeTracker: TrackerDef = { id: "x", nom: "Test", fournisseur: "Test", categorie: "audience", finalite: "test", duree: "13 mois", domaines: ["example.test"] };

let mem: ReturnType<typeof memoryStorage>;
beforeEach(() => { mem = memoryStorage(); __setStorage(mem); });
afterEach(() => __setStorage(null));

describe("consentement : valeurs par défaut", () => {
  it("sans choix : aucune catégorie facultative, seul le nécessaire est vrai", () => {
    expect(getConsent(T0)).toBeNull();
    expect(hasConsent("necessaire", T0)).toBe(true);
    for (const c of ["audience", "medias", "publicite"] as const) expect(hasConsent(c, T0)).toBe(false);
  });
  it("il n'existe aujourd'hui aucun traceur facultatif, donc aucune bannière automatique", () => {
    expect(OPTIONAL_TRACKERS).toHaveLength(0);
    expect(needsPrompt(T0)).toBe(false);
  });
  it("la bannière automatique s'afficherait seulement avec un traceur et sans choix valide", () => {
    expect(needsPrompt(T0, [fakeTracker])).toBe(true);
    setConsent({}, T0);
    expect(needsPrompt(T0, [fakeTracker])).toBe(false);
  });
});

describe("consentement : choix", () => {
  it("refuser tout", () => {
    refuseAll(T0);
    expect(hasConsent("audience", T0)).toBe(false);
    expect(getConsent(T0)?.choices).toEqual({ audience: false, medias: false, publicite: false });
  });
  it("accepter tout", () => {
    acceptAll(T0);
    for (const c of ["audience", "medias", "publicite"] as const) expect(hasConsent(c, T0)).toBe(true);
  });
  it("choix partiel : une catégorie non citée reste refusée", () => {
    setConsent({ medias: true }, T0);
    expect(hasConsent("medias", T0)).toBe(true);
    expect(hasConsent("audience", T0)).toBe(false);
    expect(hasConsent("publicite", T0)).toBe(false);
  });
  it("modifier un choix remplace le précédent", () => {
    acceptAll(T0);
    setConsent({ audience: true }, T0);
    expect(hasConsent("publicite", T0)).toBe(false);
    expect(hasConsent("audience", T0)).toBe(true);
  });
  it("retrait : tout repasse à refusé, et le retrait est mémorisé (pas de nouvelle demande immédiate)", () => {
    acceptAll(T0);
    const t1 = new Date("2026-11-02T10:00:00Z");
    const rec = withdraw(t1);
    expect(hasConsent("audience", t1)).toBe(false);
    expect(rec.choices.publicite).toBe(false);
    expect(getConsent(new Date("2026-11-03T10:00:00Z"))).not.toBeNull();
  });
  it("le choix garde version, date et expiration à 6 mois", () => {
    const rec = setConsent({ audience: true }, T0);
    expect(rec.v).toBe(CONSENT_VERSION);
    expect(rec.date).toBe(T0.toISOString());
    expect(CONSENT_MONTHS).toBe(6);
    expect(rec.expires).toBe(addMonths(T0, 6).toISOString());
    expect(rec.expires).toBe("2027-04-29T10:00:00.000Z");
  });
});

describe("consentement : expiration et robustesse", () => {
  it("valable jusqu'à 6 mois, puis nouvelle demande", () => {
    acceptAll(T0);
    expect(hasConsent("audience", new Date("2027-04-29T09:59:59Z"))).toBe(true);
    expect(hasConsent("audience", new Date("2027-04-29T10:00:00Z"))).toBe(false);
    expect(getConsent(new Date("2027-05-01T00:00:00Z"))).toBeNull();
    expect(needsPrompt(new Date("2027-05-01T00:00:00Z"), [fakeTracker])).toBe(true);
  });
  it("une autre version du texte invalide le choix", () => {
    acceptAll(T0);
    const rec = JSON.parse(mem.data.get(CONSENT_KEY)!);
    mem.data.set(CONSENT_KEY, JSON.stringify({ ...rec, v: CONSENT_VERSION + 1 }));
    expect(getConsent(T0)).toBeNull();
  });
  it("un stockage corrompu ou absent vaut « pas de choix »", () => {
    mem.data.set(CONSENT_KEY, "{pas du json");
    expect(getConsent(T0)).toBeNull();
    mem.data.set(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, date: "x", expires: "n'importe quoi", choices: {} }));
    expect(hasConsent("audience", T0)).toBe(false);
    __setStorage(null);
    expect(hasConsent("audience", T0)).toBe(false);
  });
  it("seul un vrai « true » compte comme accord", () => {
    acceptAll(T0);
    const rec = JSON.parse(mem.data.get(CONSENT_KEY)!);
    mem.data.set(CONSENT_KEY, JSON.stringify({ ...rec, choices: { audience: "oui", medias: 1, publicite: true } }));
    expect(hasConsent("audience", T0)).toBe(false);
    expect(hasConsent("medias", T0)).toBe(false);
    expect(hasConsent("publicite", T0)).toBe(true);
  });
});

describe("loadIfConsented : filtre de chargement", () => {
  it("ne charge rien sans choix ni après un refus", () => {
    let n = 0;
    const off = loadIfConsented("audience", () => { n++; });
    expect(n).toBe(0);
    refuseAll();
    expect(n).toBe(0);
    off();
  });
  it("charge immédiatement si l'accord existe déjà, une seule fois", () => {
    setConsent({ audience: true });
    let n = 0;
    const off = loadIfConsented("audience", () => { n++; });
    expect(n).toBe(1);
    setConsent({ audience: true });
    expect(n).toBe(1);
    off();
  });
  it("charge dès que la catégorie est acceptée, pas pour une autre catégorie", () => {
    let audience = 0, pub = 0;
    const o1 = loadIfConsented("audience", () => { audience++; });
    const o2 = loadIfConsented("publicite", () => { pub++; });
    setConsent({ audience: true });
    expect(audience).toBe(1);
    expect(pub).toBe(0);
    o1(); o2();
  });
  it("appelle le nettoyage quand le consentement est retiré", () => {
    let cleaned = 0;
    loadIfConsented("medias", () => () => { cleaned++; });
    acceptAll();
    expect(cleaned).toBe(0);
    withdraw();
    expect(cleaned).toBe(1);
  });
  it("une attente annulée ne charge jamais", () => {
    let n = 0;
    loadIfConsented("audience", () => { n++; })();
    acceptAll();
    expect(n).toBe(0);
  });
  it("la catégorie nécessaire se charge toujours", () => {
    let n = 0;
    loadIfConsented("necessaire", () => { n++; });
    expect(n).toBe(1);
  });
});
