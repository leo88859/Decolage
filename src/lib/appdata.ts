import type { AppState } from "@/lib/types";

// Vérification des données envoyées par une application (iframe isolé, import, synchronisation).
// Tout ce qui n'a pas la forme attendue est écarté ; les tailles sont plafonnées.

const MAX_ROWS = 5000;
const MAX_CELL = 500;
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function cleanAppData(raw: unknown): AppState | null {
  const d = raw as Partial<AppState> | null;
  if (!d || typeof d !== "object" || !Array.isArray(d.rows)) return null;
  const rows = d.rows
    .filter((r) => r && num(r.id) && Array.isArray(r.v) && r.v.length <= 12 && r.v.every((c) => typeof c === "string"))
    .slice(0, MAX_ROWS)
    .map((r) => ({ id: Math.floor(r.id), v: r.v.map((c) => c.slice(0, MAX_CELL)), ...(r.fav ? { fav: true } : {}), ...(num(r.day) ? { day: Math.floor(r.day) } : {}) }));
  const out: AppState = { v: 1, rows };
  if (num(d.next)) out.next = Math.floor(d.next);
  if (Array.isArray(d.lessons)) out.lessons = d.lessons.slice(0, MAX_ROWS).map((x) => x === true);
  if (Array.isArray(d.goals)) out.goals = d.goals.filter((g) => g && typeof g.nom === "string" && num(g.cible) && num(g.actuel)).slice(0, 50).map((g) => ({ nom: g.nom.slice(0, 120), cible: g.cible, actuel: g.actuel }));
  if (Array.isArray(d.doneRel)) out.doneRel = d.doneRel.filter(num).slice(0, MAX_ROWS);
  if (d.cart && typeof d.cart === "object") {
    const cart: Record<string, number> = {};
    for (const [k, q] of Object.entries(d.cart).slice(0, 500)) if (/^\d{1,9}$/.test(k) && num(q) && q > 0) cart[k] = Math.min(999, Math.floor(q));
    out.cart = cart;
  }
  if (Array.isArray(d.msgs)) out.msgs = d.msgs.filter((m) => m && typeof m.t === "string").slice(-50).map((m) => ({ me: !!m.me, t: m.t.slice(0, 1000), at: String(m.at ?? "").slice(0, 20) }));
  if (d.notes && typeof d.notes === "object") {
    const notes: Record<string, string> = {};
    for (const [k, t] of Object.entries(d.notes).slice(0, 2000)) if (/^[\w-]{1,40}$/.test(k) && typeof t === "string") notes[k] = t.slice(0, 20000);
    out.notes = notes;
  }
  if (Array.isArray(d.orders)) out.orders = d.orders.filter((o) => o && num(o.id) && num(o.pid) && num(o.qte) && num(o.total)).slice(0, 500)
    .map((o) => ({ id: Math.floor(o.id), pid: Math.floor(o.pid), nom: String(o.nom ?? "").slice(0, MAX_CELL), qte: Math.floor(o.qte), total: o.total, client: String(o.client ?? "").slice(0, MAX_CELL), statut: String(o.statut ?? "").slice(0, 60), date: String(o.date ?? "").slice(0, 30) }));
  if (num(d.nextOrder)) out.nextOrder = Math.floor(d.nextOrder);
  return JSON.stringify(out).length > 1_500_000 ? null : out;
}
