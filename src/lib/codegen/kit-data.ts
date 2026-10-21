// Kit du générateur : fichiers source copiés tels quels dans chaque projet Next.js généré.
// Écrits à l'avance (aucune IA). Contrainte : pas d'accent grave ni de « ${ » dans ces textes,
// car ils sont stockés dans des gabarits JavaScript.

/** lib/types.ts — types partagés du projet généré. */
export const TYPES_TS = String.raw`export type PageKind =
  | "accueil" | "dashboard" | "table" | "cards" | "grid" | "kanban" | "agenda"
  | "form" | "todo" | "goals" | "settings" | "pricing" | "login" | "activity";

export type NavPage = { id: string; titre: string; kind: PageKind; href: string; nav: boolean };

export type SaasConfig = {
  nom: string;
  initiales: string;
  description: string;
  cible: string;
  storageKey: string;
  entite: { nom: string; pluriel: string; champs: string[] };
  statut: number;
  statuts: string[];
  exemples: string[][];
  pages: NavPage[];
  fonctionnalites: [string, string][];
  heroTitre: string;
  revenu: string;
  offres: { nom: string; prix: number; periode: string; points: string[] }[];
  csvSeparateur: string;
  /** Textes de départ rattachés aux éléments (notes, leçons, documents). */
  notes?: Record<string, string>;
  /** Architecture de l'application (site public + espace utilisateur), si le type de SaaS en a une. */
  arch?: ArchConfig;
};

export type ArchScreen = { id: string; titre: string; view: string; href: string };
export type ArchConfig = {
  id: string;
  frame: string;
  home: string;
  accounts: boolean;
  roles: Record<string, number>;
  site: { id: string; titre: string; href: string }[];
  screens: ArchScreen[];
  extras: NavPage[];
};

export type Item = { id: string; values: string[]; fav: boolean; createdAt: string; updatedAt: string };
export type Goal = { id: string; nom: string; cible: number; actuel: number };
export type LogEntry = { at: string; text: string };
export type Order = { id: number; pid: string; nom: string; qte: number; total: number; client: string; statut: string; date: string };
export type State = {
  v: 1;
  items: Item[];
  goals: Goal[];
  log: LogEntry[];
  profil: { nom: string };
  notes: Record<string, string>;
  orders: Order[];
  nextOrder: number;
  /** Compte local (dans ce navigateur uniquement) : ce n'est pas une authentification. */
  compte: { nom: string; email: string } | null;
  session: boolean;
};
`;

/** lib/store.ts — données enregistrées dans le navigateur (localStorage), avec import et export CSV. */
export const STORE_TS = String.raw`"use client";

import { useSyncExternalStore } from "react";
import { SAAS } from "@/lib/config";
import type { Goal, Item, Order, State } from "@/lib/types";

// Toutes les données de l'application sont gardées dans le navigateur de l'utilisateur.
// Pas de serveur ni de base de données : chaque appareil a ses propres données.

const KEY = SAAS.storageKey;
const N = SAAS.entite.champs.length;
const EPOCH = "2026-01-01T09:00:00.000Z";

function seed(): State {
  return {
    v: 1,
    items: SAAS.exemples.map((values, i) => ({ id: "ex" + (i + 1), values: values.slice(), fav: false, createdAt: EPOCH, updatedAt: EPOCH })),
    goals: [],
    log: [],
    profil: { nom: "" },
    notes: { ...(SAAS.notes ?? {}) },
    orders: [],
    nextOrder: 1001,
    compte: null,
    session: false,
  };
}
const SEED = seed();

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function isItem(x: unknown): x is Item {
  const i = x as Item;
  return !!i && typeof i.id === "string" && Array.isArray(i.values) && i.values.length === N && i.values.every((v) => typeof v === "string");
}

/** Relit un état enregistré en écartant tout ce qui n'a pas la bonne forme. */
function parse(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<State>;
    if (!d || d.v !== 1 || !Array.isArray(d.items)) return null;
    return {
      v: 1,
      items: d.items.filter(isItem).map((i) => ({ ...i, fav: !!i.fav, values: i.values.map((v) => v.slice(0, 500)) })),
      goals: Array.isArray(d.goals) ? d.goals.filter((g) => g && typeof g.nom === "string" && typeof g.cible === "number" && typeof g.actuel === "number") : [],
      log: Array.isArray(d.log) ? d.log.filter((l) => l && typeof l.text === "string").slice(0, 100) : [],
      profil: { nom: typeof d.profil?.nom === "string" ? d.profil.nom.slice(0, 80) : "" },
      notes: d.notes && typeof d.notes === "object" ? Object.fromEntries(Object.entries(d.notes).filter(([, t]) => typeof t === "string").map(([k, t]) => [k, String(t).slice(0, 20000)])) : {},
      orders: Array.isArray(d.orders) ? d.orders.filter((o) => o && typeof o.id === "number" && typeof o.pid === "string" && typeof o.total === "number").slice(0, 500) : [],
      nextOrder: typeof d.nextOrder === "number" ? d.nextOrder : 1001,
      compte: d.compte && typeof d.compte.nom === "string" && typeof d.compte.email === "string" ? { nom: d.compte.nom.slice(0, 80), email: d.compte.email.slice(0, 120) } : null,
      session: d.session === true,
    };
  } catch {
    return null;
  }
}

let cache: State | null = null;
const subs = new Set<() => void>();
let lastError = "";

function read(): State {
  if (cache) return cache;
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { stored = null; }
  cache = parse(stored) ?? SEED;
  return cache;
}

function write(next: State, text?: string) {
  const withLog = text ? { ...next, log: [{ at: new Date().toISOString(), text }, ...next.log].slice(0, 100) } : next;
  cache = withLog;
  try {
    localStorage.setItem(KEY, JSON.stringify(withLog));
    lastError = "";
  } catch {
    lastError = "Le navigateur refuse d'enregistrer (stockage plein ou bloqué).";
  }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; f(); } };
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(f); window.removeEventListener("storage", onStorage); };
}

/** État courant ; côté serveur, les données d'exemple (remplacées dès l'arrivée dans le navigateur). */
export const useStore = () => useSyncExternalStore(subscribe, read, () => SEED);
export const storageError = () => lastError;

const clean = (values: string[]) => SAAS.entite.champs.map((_, i) => String(values[i] ?? "").trim().slice(0, 500));

export const actions = {
  add(values: string[]): Item {
    const now = new Date().toISOString();
    const item: Item = { id: newId(), values: clean(values), fav: false, createdAt: now, updatedAt: now };
    const s = read();
    write({ ...s, items: [item, ...s.items] }, SAAS.entite.nom + " ajouté : " + item.values[0]);
    return item;
  },
  update(id: string, values: string[]) {
    const s = read();
    write({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, values: clean(values), updatedAt: new Date().toISOString() } : i)) }, "Modifié : " + (values[0] ?? ""));
  },
  setStatus(id: string, statut: string) {
    const s = read();
    const it = s.items.find((i) => i.id === id);
    if (!it) return;
    const values = it.values.slice();
    values[SAAS.statut] = statut;
    write({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, values, updatedAt: new Date().toISOString() } : i)) }, it.values[0] + " → " + statut);
  },
  remove(id: string) {
    const s = read();
    const it = s.items.find((i) => i.id === id);
    write({ ...s, items: s.items.filter((i) => i.id !== id) }, "Supprimé : " + (it?.values[0] ?? ""));
  },
  toggleFav(id: string) {
    const s = read();
    write({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, fav: !i.fav } : i)) });
  },
  addGoal(nom: string, cible: number) {
    const s = read();
    const g: Goal = { id: newId(), nom: nom.trim().slice(0, 120), cible: Math.max(1, cible), actuel: 0 };
    write({ ...s, goals: [...s.goals, g] }, "Objectif créé : " + g.nom);
  },
  addToGoal(id: string, montant: number) {
    const s = read();
    write({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, actuel: Math.max(0, g.actuel + montant) } : g)) });
  },
  removeGoal(id: string) {
    const s = read();
    write({ ...s, goals: s.goals.filter((g) => g.id !== id) }, "Objectif supprimé");
  },
  setProfil(nom: string) {
    const s = read();
    write({ ...s, profil: { nom: nom.trim().slice(0, 80) } }, "Profil mis à jour");
  },
  setNote(id: string, text: string) {
    const s = read();
    write({ ...s, notes: { ...s.notes, [id]: text.slice(0, 20000) } });
  },
  /** Commande : décompte le stock du produit s'il est chiffré. Aucun paiement n'est encaissé. */
  order(pid: string, qte: number, client: string): string {
    const s = read();
    const it = s.items.find((i) => i.id === pid);
    if (!it) return "Produit introuvable.";
    const roles = SAAS.arch?.roles ?? {};
    const sc = roles.stock;
    const stock = typeof sc === "number" ? parseInt(it.values[sc] ?? "", 10) : NaN;
    if (Number.isFinite(stock) && stock < qte) return "Stock insuffisant (" + stock + " restant).";
    const unit = typeof roles.prix === "number" ? amount(it.values[roles.prix] ?? "") ?? 0 : 0;
    const values = it.values.slice();
    if (typeof sc === "number" && Number.isFinite(stock)) values[sc] = String(stock - qte);
    const now = new Date().toISOString();
    const o: Order = { id: s.nextOrder, pid, nom: it.values[roles.titre ?? 0] ?? "", qte, total: unit * qte, client: client.slice(0, 120), statut: "À préparer", date: now };
    write({ ...s, items: s.items.map((i) => (i.id === pid ? { ...i, values, updatedAt: now } : i)), orders: [o, ...s.orders].slice(0, 500), nextOrder: s.nextOrder + 1 }, "Commande #" + o.id + " : " + qte + " × " + o.nom);
    return "Commande #" + o.id + " créée.";
  },
  setOrderStatus(id: number, statut: string) {
    const s = read();
    write({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, statut } : o)) }, "Commande #" + id + " : " + statut);
  },
  /** Compte local : enregistré dans ce navigateur, sans mot de passe ni serveur. */
  signup(nom: string, email: string) {
    const s = read();
    const n = nom.trim().slice(0, 80) || "Moi";
    write({ ...s, compte: { nom: n, email: email.trim().toLowerCase().slice(0, 120) }, session: true, profil: { nom: n } }, "Compte local créé");
  },
  login(email: string): boolean {
    const s = read();
    if (!s.compte || s.compte.email !== email.trim().toLowerCase()) return false;
    write({ ...s, session: true }, "Connexion");
    return true;
  },
  logout() {
    write({ ...read(), session: false }, "Déconnexion");
  },
  reset() {
    const s = read();
    write({ ...seed(), compte: s.compte, session: s.session }, "Données d'exemple restaurées");
  },
  clearAll() {
    const s = read();
    write({ ...seed(), items: [], notes: {}, compte: s.compte, session: s.session }, "Toutes les données ont été effacées");
  },
  exportCsv(): string {
    const sep = SAAS.csvSeparateur;
    const q = (c: string) => '"' + c.replace(/"/g, '""') + '"';
    return "﻿" + [SAAS.entite.champs, ...read().items.map((i) => i.values)].map((l) => l.map(q).join(sep)).join("\n");
  },
  importCsv(text: string): number {
    const lines = parseCsv(text);
    const low = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    const head = (lines[0] ?? []).map(low);
    const idx = SAAS.entite.champs.map((c) => head.indexOf(low(c)));
    const hasHead = idx.some((j) => j >= 0);
    const rows = (hasHead ? lines.slice(1) : lines).slice(0, 5000);
    const now = new Date().toISOString();
    const added: Item[] = [];
    for (const l of rows) {
      const values = SAAS.entite.champs.map((_, i) => String((hasHead ? (idx[i]! >= 0 ? l[idx[i]!] : "") : l[i]) ?? "").trim().slice(0, 500));
      if (!values[0]) continue;
      if (!SAAS.statuts.includes(values[SAAS.statut]!)) values[SAAS.statut] = SAAS.statuts[0] ?? values[SAAS.statut]!;
      added.push({ id: newId(), values, fav: false, createdAt: now, updatedAt: now });
    }
    if (added.length) {
      const s = read();
      write({ ...s, items: [...added, ...s.items] }, "Import CSV : " + added.length + " ligne(s)");
    }
    return added.length;
  },
};

/** Lecteur CSV : séparateur « ; » ou « , » détecté, guillemets et retours à la ligne gérés. */
export function parseCsv(input: string): string[][] {
  const t = input.replace(/^﻿/, "");
  const first = t.split(/\r?\n/)[0] ?? "";
  const sep = (first.match(/;/g) ?? []).length >= (first.match(/,/g) ?? []).length ? ";" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quoted) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) out.push(row);
  return out;
}

/** Couleur du badge d'un statut, à partir de mots courants. */
export function tone(s: string): "ok" | "bad" | "warn" | "info" {
  if (/annul|refus|perdu|rupture|retard|haute|dépense|impay/i.test(s)) return "bad";
  if (/confirm|valid|gagn|pay|résolu|livr|termin|fait|en ligne|actif|revenu/i.test(s)) return "ok";
  return SAAS.statuts.indexOf(s) % 2 ? "warn" : "info";
}

/** Montant lisible dans une cellule (« +24 € », « −6 € », « 1 200,50 »), sinon null. */
export function amount(s: string): number | null {
  const m = s.replace(/\s/g, "").replace("−", "-").match(/^([+-]?)(\d+(?:[.,]\d+)?)€?$/);
  if (!m) return null;
  const n = Number(m[2]!.replace(",", "."));
  return m[1] === "-" ? -n : n;
}
`;
