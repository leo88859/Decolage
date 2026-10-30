// Kit du générateur : lib/rules.ts du projet généré. Fonctions pures (aucune dépendance) :
// lecture et affichage des valeurs, validation, créneaux et doubles réservations, doublons, totaux.
// Testé tel quel par rules.test.ts. Mêmes règles que kit-data.ts : pas d'accent grave ni de « ${ ».

export const RULES_TS = String.raw`// Règles métier de l'application : validation, créneaux, doublons, totaux.
// Fonctions pures, utilisées par lib/store.ts (toute écriture passe par validate()).

export type FieldType = "text" | "email" | "date" | "datetime" | "money" | "number" | "status";
export type Booking = { date: number; ressource?: number; annule: string[]; debut: string; fin: string; duree: number; jours: number[] };
export type Schema = { champs: string[]; types: FieldType[]; statut: number; statuts: string[]; booking?: Booking; unique?: number };
export type Row = { id: string; values: string[] };
export type Errors = Record<number, string>;

const pad = (n: number) => String(n).padStart(2, "0");
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00").getTime());
const isDateTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());

/** Nombre saisi en français (« 12,5 », « 1 200 », « −6 € ») → nombre, sinon null. */
export function toNumber(s: string): number | null {
  const t = String(s ?? "").replace(/\s/g, "").replace("−", "-").replace(/€$/, "").replace(",", ".");
  return /^[+-]?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Valeur saisie → valeur enregistrée (nombres en notation point, texte sans espaces autour). */
export function normalize(v: string, type: FieldType): string {
  const s = String(v ?? "").trim();
  if ((type === "money" || type === "number") && s) { const n = toNumber(s); return n === null ? s : String(n); }
  if (type === "email") return s.toLowerCase();
  // Dates à la française (« 31/12/2026 », « 31/12/2026 14h30 ») → ISO.
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2})[:h](\d{2}))?$/);
  if (fr && type === "date") return fr[3] + "-" + pad(Number(fr[2])) + "-" + pad(Number(fr[1]));
  if (fr && type === "datetime" && fr[4]) return fr[3] + "-" + pad(Number(fr[2])) + "-" + pad(Number(fr[1])) + "T" + pad(Number(fr[4])) + ":" + fr[5];
  if (type === "datetime" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s.replace(" ", "T");
  return s;
}

/** Affichage lisible d'une valeur enregistrée. */
export function fmt(v: string, type: FieldType): string {
  if (!v) return "—";
  if (type === "date" && isDate(v)) return new Date(v + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  if (type === "datetime" && isDateTime(v)) return new Date(v).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (type === "money") { const n = toNumber(v); return n === null ? v : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }
  if (type === "number") { const n = toNumber(v); return n === null ? v : n.toLocaleString("fr-FR"); }
  return v;
}

/** Type de champ HTML adapté. */
export const inputType = (t: FieldType) => (t === "date" ? "date" : t === "datetime" ? "datetime-local" : t === "email" ? "email" : t === "money" || t === "number" ? "text" : "text");

/** Clé de tri : dates et nombres comparés pour de vrai. */
export function sortKey(v: string, type: FieldType): string | number {
  if (type === "money" || type === "number") return toNumber(v) ?? Number.NEGATIVE_INFINITY;
  return v.toLowerCase();
}

/** Créneaux d'une journée (« 09:00 », « 09:30 »…) selon les horaires d'ouverture. */
export function slotTimes(b: Booking): string[] {
  const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(b.debut); m + b.duree <= toMin(b.fin); m += b.duree) out.push(pad(Math.floor(m / 60)) + ":" + pad(m % 60));
  return out;
}
const active = (r: Row, s: Schema) => !(s.booking?.annule ?? []).includes(r.values[s.statut] ?? "");

/** Réservation déjà prise au même moment (et pour la même ressource, s'il y en a). */
export function conflictWith(values: string[], rows: Row[], s: Schema, exceptId?: string): Row | null {
  const b = s.booking;
  if (!b || !values[b.date]) return null;
  if ((b.annule ?? []).includes(values[s.statut] ?? "")) return null;
  const same = (r: Row) => r.values[b.date] === values[b.date] && (b.ressource === undefined || (r.values[b.ressource] ?? "").trim().toLowerCase() === (values[b.ressource] ?? "").trim().toLowerCase());
  return rows.find((r) => r.id !== exceptId && active(r, s) && same(r)) ?? null;
}

/** Créneaux d'une date : libres ou pris (avec la réservation qui les occupe). */
export function daySlots(day: string, rows: Row[], s: Schema): { time: string; at: string; taken: Row | null; open: boolean }[] {
  const b = s.booking;
  if (!b || !isDate(day)) return [];
  const open = b.jours.includes(new Date(day + "T00:00").getDay());
  return slotTimes(b).map((time) => {
    const at = day + "T" + time;
    return { time, at, open, taken: rows.find((r) => r.values[b.date] === at && active(r, s)) ?? null };
  });
}

/**
 * Vérifie une saisie avant tout enregistrement. Renvoie les erreurs par colonne (vide si tout va bien).
 * isNew : vrai pour une création (une réservation ne peut pas être créée dans le passé).
 */
export function validate(values: string[], rows: Row[], s: Schema, exceptId?: string, now = new Date(), isNew = !exceptId): Errors {
  const e: Errors = {};
  s.champs.forEach((c, j) => {
    const v = (values[j] ?? "").trim();
    const t = s.types[j] ?? "text";
    const requis = j === 0 || (s.booking && j === s.booking.date) || (s.unique !== undefined && j === s.unique);
    if (!v) { if (requis) e[j] = c + " est obligatoire."; return; }
    if (v.length > 500) e[j] = c + " : 500 caractères maximum.";
    else if (t === "email" && !isEmail(v)) e[j] = "Adresse e-mail invalide.";
    else if (t === "date" && !isDate(v)) e[j] = c + " : date invalide.";
    else if (t === "datetime" && !isDateTime(v)) e[j] = c + " : date et heure invalides.";
    else if ((t === "money" || t === "number") && toNumber(v) === null) e[j] = c + " : nombre attendu (ex. 12,50).";
    else if (t === "status" && s.statuts.length && !s.statuts.includes(v)) e[j] = c + " : valeur inconnue.";
  });
  const b = s.booking;
  if (b && !e[b.date] && values[b.date] && !(b.annule ?? []).includes(values[s.statut] ?? "")) {
    const at = values[b.date]!;
    const time = at.slice(11, 16);
    if (isNew && new Date(at).getTime() < now.getTime()) e[b.date] = "Ce créneau est déjà passé.";
    else if (!b.jours.includes(new Date(at).getDay())) e[b.date] = "Fermé ce jour-là.";
    else if (!slotTimes(b).includes(time)) e[b.date] = "Choisis un créneau entre " + b.debut + " et " + b.fin + " (toutes les " + b.duree + " min).";
    else { const c = conflictWith(values, rows, s, exceptId); if (c) e[b.date] = "Ce créneau est déjà pris (" + (c.values[0] || "réservation") + ")."; }
  }
  if (s.unique !== undefined && !e[s.unique]) {
    const k = (values[s.unique] ?? "").trim().toLowerCase();
    if (k && rows.some((r) => r.id !== exceptId && (r.values[s.unique!] ?? "").trim().toLowerCase() === k)) e[s.unique] = "Déjà inscrit avec cette adresse.";
  }
  return e;
}

/** Totaux d'une colonne de montants : entrées, sorties, solde. */
export function totals(rows: Row[], col: number): { entrees: number; sorties: number; solde: number } {
  let entrees = 0, sorties = 0;
  for (const r of rows) { const n = toNumber(r.values[col] ?? ""); if (n === null) continue; if (n >= 0) entrees += n; else sorties -= n; }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { entrees: r2(entrees), sorties: r2(sorties), solde: r2(entrees - sorties) };
}

/** Lignes dont la date (colonne col) tombe entre debut et fin inclus (« AAAA-MM-JJ »). */
export function inPeriod(rows: Row[], col: number, debut: string, fin: string): Row[] {
  return rows.filter((r) => { const d = (r.values[col] ?? "").slice(0, 10); return isDate(d) && d >= debut && d <= fin; });
}
`;
