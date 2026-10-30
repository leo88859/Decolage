"use client";

import { VERSIONS } from "@/data/legal";

// Côté navigateur : acceptation des CGU et de la confidentialité à l'inscription.
// La case est cochée AVANT l'envoi du lien de connexion ; comme l'utilisateur n'est pas encore authentifié,
// on garde son choix (versions affichées) jusqu'à sa première connexion, où le serveur enregistre la preuve.

const KEY = "decollage.accept-pending";

/** Documents et versions affichés à l'utilisateur au moment où il coche la case. */
export const signupDocuments = () => [
  { document: "cgu", version: VERSIONS.cgu },
  { document: "confidentialite", version: VERSIONS.confidentialite },
];

export function rememberPendingAcceptance() {
  try { localStorage.setItem(KEY, JSON.stringify(signupDocuments())); } catch { /* stockage indisponible : l'écran d'acceptation sera simplement redemandé */ }
}

export function hasPendingAcceptance(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    return raw !== null && raw === JSON.stringify(signupDocuments());
  } catch {
    return false;
  }
}

export function clearPendingAcceptance() {
  try { localStorage.removeItem(KEY); } catch { /* sans effet */ }
}

/** Demande au serveur d'enregistrer l'acceptation. Renvoie un message d'erreur, ou null si c'est enregistré. */
export async function saveSignupAcceptance(): Promise<string | null> {
  try {
    const r = await fetch("/api/legal/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documents: signupDocuments() }) });
    if (r.ok) { clearPendingAcceptance(); return null; }
    const res = (await r.json().catch(() => ({}))) as { error?: string };
    return res.error ?? "Enregistrement impossible pour le moment.";
  } catch {
    return "Enregistrement impossible : vérifie ta connexion.";
  }
}
