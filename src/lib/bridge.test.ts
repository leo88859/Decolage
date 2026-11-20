import { describe, expect, it } from "vitest";
import { validateBridgeMessage, type BridgeContext } from "./bridge";

// Simulations en mémoire (pas de navigateur, pas de production) : on vérifie la logique de contrôle du pont.
const frame = { id: "iframe-attendue" };
const intruse = { id: "autre-fenetre" };
const ORIGIN = "https://decollage.vercel.app";
const ctx: BridgeContext = { projectId: "p1", expectedWindows: [frame], allowedOrigins: [ORIGIN], sandboxedFrames: true };
const row = { id: 1, v: ["a", "b"] };
const data = (extra: object = {}) => ({ decollageData: { v: 1, rows: [row] }, key: "p1", ...extra });
const ev = (over: Partial<{ source: unknown; origin: string; data: unknown }> = {}) => ({ source: frame, origin: "null", data: data(), ...over });

describe("pont des aperçus : expéditeur", () => {
  it("refuse une source qui n'est pas la fenêtre attendue", () => {
    expect(validateBridgeMessage(ev({ source: intruse }), ctx)).toEqual({ ok: false, reason: "source" });
    expect(validateBridgeMessage(ev({ source: null }), ctx)).toEqual({ ok: false, reason: "source" });
    expect(validateBridgeMessage(ev({ source: undefined }), { ...ctx, expectedWindows: [null] })).toEqual({ ok: false, reason: "source" });
  });
  it("refuse une origine incorrecte ou un joker", () => {
    expect(validateBridgeMessage(ev({ origin: "https://evil.example" }), ctx)).toEqual({ ok: false, reason: "origine" });
    expect(validateBridgeMessage(ev({ origin: "*" }), ctx)).toEqual({ ok: false, reason: "origine" });
    expect(validateBridgeMessage(ev({ origin: "https://evil.example" }), { ...ctx, allowedOrigins: ["*"] }).ok).toBe(false);
  });
  it("refuse l'origine null par défaut, même si la fenêtre est la bonne", () => {
    expect(validateBridgeMessage(ev(), { ...ctx, sandboxedFrames: false })).toEqual({ ok: false, reason: "origine-null" });
    expect(validateBridgeMessage(ev(), { projectId: "p1", expectedWindows: [frame], allowedOrigins: [ORIGIN] })).toEqual({ ok: false, reason: "origine-null" });
  });
  it("refuse l'origine null venant d'une fenêtre non autorisée", () => {
    expect(validateBridgeMessage(ev({ source: intruse, origin: "null" }), ctx)).toEqual({ ok: false, reason: "source" });
  });
  it("accepte une origine de la liste explicite quand la fenêtre est la bonne", () => {
    expect(validateBridgeMessage(ev({ origin: ORIGIN }), ctx).ok).toBe(true);
  });
});

describe("pont des aperçus : projet et format", () => {
  it("refuse un mauvais identifiant de projet", () => {
    expect(validateBridgeMessage(ev({ data: data({ key: "p2" }) }), ctx)).toEqual({ ok: false, reason: "projet" });
    expect(validateBridgeMessage(ev({ data: { decollageHello: true } }), ctx).ok).toBe(false);
    expect(validateBridgeMessage(ev({ data: { decollageHello: true, key: 1 } }), ctx).ok).toBe(false);
  });
  it("refuse les types de message hors liste fermée", () => {
    for (const d of [null, "texte", 42, [], { go: "x", key: "p1" }, { decollageLoad: null, key: "p1" }, { decollageHello: true, decollagePage: "a", key: "p1" }, { decollageHello: true, key: "p1", extra: 1 }]) {
      expect(validateBridgeMessage(ev({ data: d }), ctx).ok).toBe(false);
    }
  });
  it("refuse des données malformées", () => {
    const bad = [
      { decollageData: null, key: "p1" },
      { decollageData: { rows: "x" }, key: "p1" },
      { decollageData: {}, key: "p1" },
      { decollageData: { rows: [{ id: "1", v: [] }] }, key: "p1" },
      { decollageData: { rows: [{ v: ["a"] }] }, key: "p1" },
      { decollageData: { rows: [{ id: 1, v: [1] }] }, key: "p1" },
      { decollageData: { rows: [{ id: Infinity, v: [] }] }, key: "p1" },
      { decollageData: { rows: [null] }, key: "p1" },
      { decollagePage: 12, key: "p1" },
      { decollagePage: "../../x", key: "p1" },
      { decollageHello: "oui", key: "p1" },
    ];
    for (const d of bad) expect(validateBridgeMessage(ev({ data: d }), ctx).ok).toBe(false);
  });
  it("refuse les tailles excessives", () => {
    const tooManyRows = { decollageData: { rows: Array.from({ length: 5001 }, (_, i) => ({ id: i, v: [] })) }, key: "p1" };
    expect(validateBridgeMessage(ev({ data: tooManyRows }), ctx)).toEqual({ ok: false, reason: "taille" });
    const huge = { decollageData: { rows: [{ id: 1, v: ["x".repeat(1_600_000)] }] }, key: "p1" };
    expect(validateBridgeMessage(ev({ data: huge }), ctx)).toEqual({ ok: false, reason: "taille" });
    const tooManyCols = { decollageData: { rows: [{ id: 1, v: Array(13).fill("a") }] }, key: "p1" };
    expect(validateBridgeMessage(ev({ data: tooManyCols }), ctx).ok).toBe(false);
    expect(validateBridgeMessage(ev({ data: { decollagePage: "a".repeat(65), key: "p1" } }), ctx).ok).toBe(false);
  });
  it("refuse sans erreur une donnée circulaire", () => {
    const o: Record<string, unknown> = { rows: [] };
    o.self = o;
    expect(validateBridgeMessage(ev({ data: { decollageData: o, key: "p1" } }), ctx).ok).toBe(false);
  });
});

describe("pont des aperçus : messages valides", () => {
  it("accepte hello", () => {
    expect(validateBridgeMessage(ev({ data: { decollageHello: true, key: "p1" } }), ctx)).toEqual({ ok: true, message: { type: "hello" } });
  });
  it("accepte une page", () => {
    expect(validateBridgeMessage(ev({ data: { decollagePage: "clients", key: "p1" } }), ctx)).toEqual({ ok: true, message: { type: "page", id: "clients" } });
  });
  it("accepte des données valides, nettoyées", () => {
    const r = validateBridgeMessage(ev({ data: data({ decollageData: { v: 1, rows: [{ id: 1, v: ["x".repeat(900)] }] } }) }), ctx);
    expect(r.ok).toBe(true);
    if (r.ok && r.message.type === "data") expect(r.message.data.rows[0].v[0]).toHaveLength(500);
  });
  it("ne modifie pas le contexte ni le message (aucun effet de bord)", () => {
    const m = ev();
    const before = JSON.stringify(m.data);
    validateBridgeMessage(m, ctx);
    expect(JSON.stringify(m.data)).toBe(before);
  });
});
