// Teste lib/rules.ts du projet généré, tel qu'il est écrit dans le ZIP.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { RULES_TS } from "./kit-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rules = any;
type Slot = { time: string; open: boolean; taken: { id: string } | null };
let R: Rules;
beforeAll(async () => {
  const dir = join(tmpdir(), `decollage-rules-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "rules.ts");
  writeFileSync(file, RULES_TS, "utf8");
  R = (await import(/* @vite-ignore */ file)) as Rules;
});

const booking = { date: 1, annule: ["Annulé"], debut: "09:00", fin: "12:00", duree: 30, jours: [1, 2, 3, 4, 5] };
const rdv = { champs: ["Client", "Date", "Prestation", "Statut"], types: ["text", "datetime", "text", "status"] as const, statut: 3, statuts: ["En attente", "Confirmé", "Annulé"], booking };
const S = { ...rdv, types: [...rdv.types] };
const NOW = new Date(2026, 9, 26, 8, 0); // lundi 26 octobre 2026, 8 h
const rows = [{ id: "a", values: ["Léa", "2026-10-27T10:00", "Suivi", "Confirmé"] }, { id: "b", values: ["Tom", "2026-10-27T10:30", "Suivi", "Annulé"] }];

describe("règles des applications générées", () => {
  it("valide les champs obligatoires et les formats", () => {
    expect(R.validate(["", "2026-10-27T11:00", "", "Confirmé"], rows, S, undefined, NOW)).toEqual({ 0: "Client est obligatoire." });
    expect(R.validate(["Ana", "demain", "", "Confirmé"], rows, S, undefined, NOW)[1]).toMatch(/invalides/);
    expect(R.validate(["Ana", "2026-10-27T11:00", "", "Inventé"], rows, S, undefined, NOW)[3]).toMatch(/inconnue/);
    expect(R.validate(["Ana", "2026-10-27T11:00", "", "Confirmé"], rows, S, undefined, NOW)).toEqual({});
  });
  it("empêche les doubles réservations, sauf sur un créneau annulé", () => {
    expect(R.validate(["Ana", "2026-10-27T10:00", "", "En attente"], rows, S, undefined, NOW)[1]).toMatch(/déjà pris \(Léa\)/);
    expect(R.validate(["Ana", "2026-10-27T10:30", "", "En attente"], rows, S, undefined, NOW)).toEqual({});
    // Modifier la réservation elle-même ne crée pas de conflit.
    expect(R.validate(["Léa", "2026-10-27T10:00", "Suivi", "Confirmé"], rows, S, "a", NOW)).toEqual({});
    // Annuler libère le créneau.
    expect(R.validate(["Ana", "2026-10-27T10:00", "", "Annulé"], rows, S, undefined, NOW)).toEqual({});
  });
  it("refuse les créneaux passés, fermés ou hors horaires", () => {
    expect(R.validate(["Ana", "2026-10-26T07:00", "", "Confirmé"], rows, S, undefined, NOW)[1]).toMatch(/passé/);
    expect(R.validate(["Ana", "2026-10-31T10:00", "", "Confirmé"], rows, S, undefined, NOW)[1]).toMatch(/Fermé/);
    expect(R.validate(["Ana", "2026-10-27T10:15", "", "Confirmé"], rows, S, undefined, NOW)[1]).toMatch(/créneau entre 09:00 et 12:00/);
    expect(R.validate(["Ana", "2026-10-27T12:00", "", "Confirmé"], rows, S, undefined, NOW)[1]).toMatch(/créneau entre/);
  });
  it("liste les créneaux d'une journée", () => {
    const s = R.daySlots("2026-10-27", rows, S);
    expect(s.map((x: Slot) => x.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(s.find((x: Slot) => x.time === "10:00")?.taken?.id).toBe("a");
    expect(s.find((x: Slot) => x.time === "10:30")?.taken).toBeNull();
    expect(R.daySlots("2026-11-01", rows, S).every((x: Slot) => !x.open)).toBe(true);
  });
  it("tient compte de la ressource réservée", () => {
    const res = { ...S, booking: { ...booking, date: 1, ressource: 0 } };
    const r2 = [{ id: "x", values: ["Salle A", "2026-10-27T10:00", "Camille", "Confirmé"] }];
    expect(R.validate(["Salle B", "2026-10-27T10:00", "", "Confirmé"], r2, res, undefined, NOW)).toEqual({});
    expect(R.validate(["salle a ", "2026-10-27T10:00", "", "Confirmé"], r2, res, undefined, NOW)[1]).toMatch(/déjà pris/);
  });
  it("vérifie les e-mails et refuse les doublons (liste d'attente)", () => {
    const wl = { champs: ["Email", "Inscrit le", "Source", "Parrainages"], types: ["email", "date", "status", "number"] as string[], statut: 2, statuts: ["TikTok", "Autre"], unique: 0 };
    const ins = [{ id: "1", values: ["lea@exemple.fr", "2026-10-20", "TikTok", "0"] }];
    expect(R.validate(["pas-un-email", "", "TikTok", ""], ins, wl)[0]).toMatch(/invalide/);
    expect(R.validate(["LEA@exemple.fr", "", "TikTok", ""], ins, wl)[0]).toMatch(/Déjà inscrit/);
    expect(R.validate(["tom@exemple.fr", "", "TikTok", "deux"], ins, wl)[3]).toMatch(/nombre attendu/);
    expect(R.validate(["tom@exemple.fr", "", "TikTok", "2"], ins, wl)).toEqual({});
  });
  it("calcule les totaux et filtre par période à partir des vraies données", () => {
    const tx = [{ id: "1", values: ["2026-05-02", "Vente", "Revente", "24"] }, { id: "2", values: ["2026-05-05", "Envoi", "Dépense", "-6"] }, { id: "3", values: ["2026-06-01", "Cours", "Cours", "30.5"] }, { id: "4", values: ["2026-06-03", "Note", "Autre", "abc"] }];
    expect(R.totals(tx, 3)).toEqual({ entrees: 54.5, sorties: 6, solde: 48.5 });
    expect(R.totals(R.inPeriod(tx, 0, "2026-05-01", "2026-05-31"), 3)).toEqual({ entrees: 24, sorties: 6, solde: 18 });
    expect(R.totals([], 3)).toEqual({ entrees: 0, sorties: 0, solde: 0 });
  });
  it("lit et affiche les nombres et les dates en français", () => {
    expect(R.toNumber("1 200,50")).toBe(1200.5);
    expect(R.toNumber("−6 €")).toBe(-6);
    expect(R.normalize("12,5", "money")).toBe("12.5");
    expect(R.normalize(" Lea@Exemple.FR ", "email")).toBe("lea@exemple.fr");
    expect(R.normalize("31/12/2026", "date")).toBe("2026-12-31");
    expect(R.normalize("3/11/2026 9h30", "datetime")).toBe("2026-11-03T09:30");
    expect(R.fmt("-6", "money")).toMatch(/-6,00/);
    expect(R.fmt("2026-10-27T10:00", "datetime")).toMatch(/27 oct.*10:00/);
    expect(R.fmt("", "text")).toBe("—");
  });
});
