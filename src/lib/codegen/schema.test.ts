import { describe, expect, it } from "vitest";
import { DEMO } from "@/data/demo";
import { TEMPLATE_BY_ID } from "@/data/templates";
import type { TemplateId } from "@/lib/types";
import { inferTypes, parseFrDate, parseMoney, toStored } from "./schema";

// Lundi 26 octobre 2026, 09:00 : les dates relatives sont calculées à partir de là.
const BASE = new Date(2026, 9, 26, 9, 0);
const types = (t: TemplateId) => inferTypes(TEMPLATE_BY_ID[t].entite.champs, DEMO[t].status, DEMO[t].rows, BASE);

describe("schéma des données générées", () => {
  it("lit les dates françaises", () => {
    expect(parseFrDate("Lun. 10:00", BASE)).toEqual({ iso: "2026-11-02T10:00", time: true });
    expect(parseFrDate("Demain", BASE)).toEqual({ iso: "2026-10-27", time: false });
    expect(parseFrDate("1er juil.", BASE)).toEqual({ iso: "2026-07-01", time: false });
    expect(parseFrDate("12 mai", BASE)?.iso).toBe("2026-05-12");
    expect(parseFrDate("2026-11-03T14:30", BASE)?.iso).toBe("2026-11-03T14:30");
    expect(parseFrDate("Séance découverte", BASE)).toBeNull();
  });
  it("lit les montants", () => {
    expect(parseMoney("+24 €")).toBe(24);
    expect(parseMoney("−6 €")).toBe(-6);
    expect(parseMoney("1 200,50")).toBe(1200.5);
    expect(parseMoney("∞")).toBeNull();
  });
  it("déduit le bon type de chaque colonne", () => {
    expect(types("rendez-vous")).toEqual(["text", "datetime", "text", "status"]);
    expect(types("reservations")).toEqual(["text", "datetime", "text", "status"]);
    expect(types("liste-attente")).toEqual(["email", "date", "status", "number"]);
    expect(types("annuaire")).toEqual(["text", "status", "text", "number"]);
    expect(types("suivi-gains")).toEqual(["date", "text", "status", "money"]);
    expect(types("boutique")).toEqual(["text", "money", "text", "status"]);
    expect(types("taches")).toEqual(["text", "date", "text", "status"]);
    expect(types("crm")[3]).toBe("date");
  });
  it("convertit les exemples en valeurs réelles", () => {
    expect(toStored("Lun. 10:00", "datetime", BASE)).toBe("2026-11-02T10:00");
    expect(toStored("−6 €", "money", BASE)).toBe("-6");
    expect(toStored("4,8", "number", BASE)).toBe("4.8");
    expect(toStored("—", "date", BASE)).toBe("");
    expect(toStored("Vente Vinted", "text", BASE)).toBe("Vente Vinted");
  });
});
