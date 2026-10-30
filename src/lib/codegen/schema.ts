// Schéma des données d'une application générée : un type par colonne, déduit sans IA du nom de la
// colonne et des valeurs d'exemple. Les exemples écrits en français (« Lun. 10:00 », « 12 mai », « +24 € »)
// sont convertis en valeurs réelles (dates ISO, nombres) pour pouvoir valider, trier et comparer.

export type FieldType = "text" | "email" | "date" | "datetime" | "money" | "number" | "status";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const EMPTY = /^(—|-|–|)$/;
const MOIS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];
const JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

/** « +24 € », « −6 € », « 1 200,50 », « 18 € » → nombre ; sinon null. */
export function parseMoney(s: string): number | null {
  const m = s.replace(/\s/g, "").replace("−", "-").replace(/€$/, "").match(/^([+-]?)(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const n = Number(m[2]!.replace(",", "."));
  return m[1] === "-" ? -n : n;
}
/** « 4,8 », « 12 », « 3 » → nombre ; sinon null. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/**
 * Date écrite en français ou en ISO → { iso, time }. Les dates relatives (« Demain », « Lundi ») sont
 * calculées à partir de `base`. Renvoie null si la valeur n'est pas une date reconnue.
 */
export function parseFrDate(s: string, base: Date): { iso: string; time: boolean } | null {
  const raw = s.trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/);
  if (iso) return { iso: iso[2] ? `${iso[1]}T${iso[2]}` : iso[1]!, time: !!iso[2] };
  const t = norm(raw).replace(/\./g, "");
  const hm = t.match(/(\d{1,2})[:h](\d{2})/);
  const time = hm ? `${pad(Number(hm[1]))}:${hm[2]}` : null;
  const day0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  let d: Date | null = null;
  if (/aujourd/.test(t)) d = day0;
  else if (/demain/.test(t)) d = new Date(day0.getTime() + 86400000);
  else if (/hier/.test(t)) d = new Date(day0.getTime() - 86400000);
  else if (/^le (\d{1,2})$/.test(t)) {
    // « Le 5 » : le prochain 5 du mois (ce mois-ci s'il n'est pas passé).
    const n = Number(t.slice(3));
    d = new Date(base.getFullYear(), base.getMonth(), n);
    if (d < day0) d = new Date(base.getFullYear(), base.getMonth() + 1, n);
  } else {
    const m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)/);
    const mo = m ? MOIS.findIndex((x) => m[2]!.startsWith(x) || x.startsWith(m[2]!)) : -1;
    if (m && mo >= 0) d = new Date(base.getFullYear(), mo, Number(m[1]));
    else {
      const j = JOURS.findIndex((x) => t.startsWith(x));
      if (j >= 0) { d = new Date(day0); d.setDate(d.getDate() + ((j - d.getDay() + 7) % 7 || 7)); }
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  return { iso: time ? `${isoDay(d)}T${time}` : isoDay(d), time: !!time };
}

const DATE_NAME = /date|echeance|relance|mis a jour|inscrit le|publie|cree le|creee le|ajoute|creneau|jour|^le /;
const MONEY_NAME = /prix|montant|tarif|chiffre|revenu|budget|cout|total/;
const NUMBER_NAME = /stock|note|nombre|parrainage|quantite|places|age|score|avancement/;

/** Type de chaque colonne, à partir de son nom et des valeurs d'exemple. */
export function inferTypes(champs: string[], status: number, rows: string[][], base: Date): FieldType[] {
  return champs.map((c, j) => {
    if (j === status) return "status";
    const name = norm(c);
    const vals = rows.map((r) => (r[j] ?? "").trim()).filter((v) => !EMPTY.test(v));
    const all = (f: (v: string) => boolean) => vals.length > 0 && vals.every(f);
    if (/e-?mail|courriel/.test(name) || all(isEmail)) return "email";
    if (MONEY_NAME.test(name) && all((v) => parseMoney(v) !== null)) return "money";
    if (all((v) => /[+−-]?\s?\d.*€$/.test(v)) && all((v) => parseMoney(v) !== null)) return "money";
    if (DATE_NAME.test(name) || all((v) => parseFrDate(v, base) !== null && !/^\d+([.,]\d+)?$/.test(v))) {
      const parsed = vals.map((v) => parseFrDate(v, base));
      if (parsed.length && parsed.every(Boolean)) return parsed.some((p) => p!.time) ? "datetime" : "date";
    }
    if (NUMBER_NAME.test(name) && all((v) => parseNumber(v) !== null)) return "number";
    return "text";
  });
}

/** Valeur d'exemple convertie dans le format enregistré par l'application (ISO, nombre en notation point). */
export function toStored(v: string, type: FieldType, base: Date): string {
  const s = (v ?? "").trim();
  if (EMPTY.test(s)) return "";
  if (type === "date" || type === "datetime") {
    const p = parseFrDate(s, base);
    if (!p) return s;
    return type === "datetime" && !p.time ? `${p.iso}T09:00` : type === "date" ? p.iso.slice(0, 10) : p.iso;
  }
  if (type === "money") { const n = parseMoney(s); return n === null ? s : String(n); }
  if (type === "number") { const n = parseNumber(s); return n === null ? s : String(n); }
  return s;
}
