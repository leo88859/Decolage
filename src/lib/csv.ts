/**
 * Cellule CSV sûre. Un tableur (Excel, LibreOffice, Sheets) exécute comme formule toute cellule qui
 * commence par = + - @ (ou tabulation / retour chariot) : on la préfixe d'une apostrophe, puis on met
 * entre guillemets si elle contient le séparateur, un guillemet ou un saut de ligne.
 */
export function csvCell(value: unknown, sep = ";"): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Fichier CSV des inscrits d'une liste d'attente (BOM pour Excel, séparateur « ; »). */
export function waitlistCsv(rows: { email: string; created_at: string; consentement_statut?: string | null; consentement_le?: string | null }[]): string {
  // Colonnes de consentement ajoutées seulement si la base les fournit (migration 0011 exécutée).
  const withConsent = rows.some((r) => r.consentement_statut !== undefined);
  const head = withConsent ? "email;date;consentement;consentement_le" : "email;date";
  const extra = (r: (typeof rows)[number]) => (withConsent ? `;${csvCell(r.consentement_statut ?? "a_verifier")};${csvCell(r.consentement_le ?? "")}` : "");
  return "﻿" + head + "\n" + rows.map((r) => `${csvCell(r.email)};${csvCell(r.created_at)}${extra(r)}`).join("\n");
}
