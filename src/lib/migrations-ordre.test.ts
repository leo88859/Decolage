import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Ordre et prérequis des migrations de l'étape pré-production (lecture des fichiers : aucune base, aucune exécution).
const lire = (f: string) => readFileSync(`supabase/${f}`, "utf8");
const code = (f: string) => lire(f).split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("ordre des migrations : 0010 -> 0010b -> 0011 -> 0011b", () => {
  it("0010 annonce son ordre, ses prérequis et l'interdiction de rejouer 0007 et 0008", () => {
    const tete = lire("0010_expiration_antiabus.sql");
    expect(tete).toMatch(/ORDRE D'EXÉCUTION/);
    expect(tete).toMatch(/0001 à 0009/);
    expect(tete).toMatch(/NE JAMAIS REJOUER 0007 NI 0008/);
  });
  it("0010b exige 0010 et pg_cron, et ne crée pas l'extension", () => {
    const tete = lire("0010b_planification_pg_cron.sql");
    expect(tete).toMatch(/0001 à 0010/);
    expect(code("0010b_planification_pg_cron.sql")).not.toMatch(/create\s+extension/i);
  });
  it("0011 ne supprime PLUS l'ancienne fonction (transition) et annonce 0011b", () => {
    expect(code("0011_waitlist_consentement.sql")).not.toMatch(/drop\s+function/i);
    expect(lire("0011_waitlist_consentement.sql")).toMatch(/0011b_retrait_waitlist_inscrire\.sql/);
    expect(lire("0011_waitlist_consentement.sql")).toMatch(/ORDRE : 0010 -> 0010b/);
  });
  it("0011b retire l'ancienne fonction et seulement elle", () => {
    const c = code("0011b_retrait_waitlist_inscrire.sql");
    expect(c.match(/drop\s+function/gi)).toHaveLength(1);
    expect(c).toMatch(/drop function if exists public\.waitlist_inscrire\(text, text\)/i);
    expect(c).not.toMatch(/waitlist_inscrire_consent/);
  });
  it("0011b se déclare NON exécutée et réservée au code déjà déployé", () => {
    expect(lire("0011b_retrait_waitlist_inscrire.sql")).toMatch(/NON EXÉCUTÉ/);
    expect(lire("0011b_retrait_waitlist_inscrire.sql")).toMatch(/déploiement COMPLET/);
  });
  it("aucune migration de l'étape ne contient de CREATE EXTENSION ni de politique RLS nouvelle", () => {
    for (const f of ["0010_expiration_antiabus.sql", "0010b_planification_pg_cron.sql", "0011_waitlist_consentement.sql", "0011b_retrait_waitlist_inscrire.sql"]) {
      expect(code(f), f).not.toMatch(/create\s+extension/i);
      expect(code(f), f).not.toMatch(/create\s+policy/i);
    }
  });
  it("le fichier à coller 0010 reste identique à la migration", () => {
    expect(lire("A-COLLER-0010.sql")).toBe(lire("0010_expiration_antiabus.sql"));
  });
});
