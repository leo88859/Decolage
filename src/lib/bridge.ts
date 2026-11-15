import { cleanAppData } from "@/lib/appdata";
import type { AppState } from "@/lib/types";

// Pont entre les aperçus (iframes isolés) et l'application : logique pure, sans effet de bord.
// Un message n'est accepté que si TOUT concorde : fenêtre source réelle, origine, projet, forme et taille.

export type BridgeMessage =
  | { type: "hello" }
  | { type: "data"; data: AppState }
  | { type: "page"; id: string };

export type BridgeRefusal = "source" | "origine" | "origine-null" | "projet" | "format" | "taille" | "donnees";
export type BridgeResult = { ok: true; message: BridgeMessage } | { ok: false; reason: BridgeRefusal };

export type BridgeContext = {
  /** Identifiant du projet attendu. */
  projectId: string;
  /** Fenêtres réellement créées par l'application (contentWindow de ses iframes). */
  expectedWindows: ReadonlyArray<unknown>;
  /** Origines autorisées, liste explicite (jamais de joker). */
  allowedOrigins: ReadonlyArray<string>;
  /**
   * Les aperçus sont des iframes `sandbox` sans `allow-same-origin` : leur origine est forcément « null ».
   * Une origine « null » n'est JAMAIS acceptée par défaut ; elle ne l'est que si l'appelant déclare ces iframes isolés
   * ET que la fenêtre source est l'une des fenêtres attendues (c'est l'identité de la fenêtre qui fait foi, pas l'origine).
   */
  sandboxedFrames?: boolean;
};

export const MAX_BRIDGE_JSON = 1_500_000;
const MAX_ROWS = 5000;
const MAX_COLS = 12;
const PAGE_ID = /^[\w-]{1,64}$/;
/** Liste fermée des clés de message reconnues. */
export const BRIDGE_KEYS = ["decollageHello", "decollageData", "decollagePage"] as const;

const isPlain = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

function jsonSize(x: unknown): number {
  try { return JSON.stringify(x)?.length ?? 0; } catch { return Infinity; }
}

/** Contrôle de la source, de l'origine et du projet, sans lire les données. */
export function checkSender(e: { source: unknown; origin: string }, ctx: Pick<BridgeContext, "expectedWindows" | "allowedOrigins" | "sandboxedFrames">): BridgeRefusal | null {
  if (!e.source || !ctx.expectedWindows.some((w) => w && w === e.source)) return "source";
  if (e.origin === "null") {
    if (!ctx.sandboxedFrames) return "origine-null";
    return null;
  }
  if (typeof e.origin !== "string" || e.origin === "*" || !ctx.allowedOrigins.includes(e.origin) || ctx.allowedOrigins.includes("*")) return "origine";
  return null;
}

export function validateBridgeMessage(e: { source: unknown; origin: string; data: unknown }, ctx: BridgeContext): BridgeResult {
  const bad = checkSender(e, ctx);
  if (bad) return { ok: false, reason: bad };
  const d = e.data;
  if (!isPlain(d)) return { ok: false, reason: "format" };
  const present = BRIDGE_KEYS.filter((k) => k in d);
  if (present.length !== 1) return { ok: false, reason: "format" };
  const keys = Object.keys(d);
  if (keys.length !== 2 || !keys.includes("key")) return { ok: false, reason: "format" };
  if (typeof d.key !== "string") return { ok: false, reason: "format" };
  if (d.key !== ctx.projectId) return { ok: false, reason: "projet" };

  if (present[0] === "decollageHello") {
    return d.decollageHello === true ? { ok: true, message: { type: "hello" } } : { ok: false, reason: "format" };
  }
  if (present[0] === "decollagePage") {
    return typeof d.decollagePage === "string" && PAGE_ID.test(d.decollagePage)
      ? { ok: true, message: { type: "page", id: d.decollagePage } }
      : { ok: false, reason: "format" };
  }
  // decollageData : forme stricte, puis nettoyage.
  const raw = d.decollageData;
  if (!isPlain(raw) || !Array.isArray(raw.rows)) return { ok: false, reason: "donnees" };
  if (raw.rows.length > MAX_ROWS) return { ok: false, reason: "taille" };
  if (jsonSize(raw) > MAX_BRIDGE_JSON) return { ok: false, reason: "taille" };
  for (const r of raw.rows) {
    if (!isPlain(r) || typeof r.id !== "number" || !Number.isFinite(r.id) || !Array.isArray(r.v)) return { ok: false, reason: "donnees" };
    if (r.v.length > MAX_COLS || !r.v.every((c) => typeof c === "string")) return { ok: false, reason: "donnees" };
  }
  const clean = cleanAppData(raw);
  return clean ? { ok: true, message: { type: "data", data: clean } } : { ok: false, reason: "donnees" };
}
