"use client";

import Link from "next/link";
import "./legal.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptAll, CATEGORY_INFO, CONSENT_OPEN_EVENT, getConsent, needsPrompt, OPTIONAL_CATEGORIES, OPTIONAL_TRACKERS,
  refuseAll, setConsent, type ConsentChoices,
} from "@/lib/consent/consent";

/** Ouvre le panneau « Gérer mes cookies » (utilisable de n'importe où). */
export function openConsentPanel() {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

/** Bouton « Gérer mes cookies » : ouvre toujours le panneau, même s'il n'y a aucun traceur facultatif. */
export function ManageCookiesButton({ className }: { className?: string }) {
  return <button type="button" className={className ?? "linklike"} onClick={openConsentPanel}>Gérer mes cookies</button>;
}

const NECESSAIRES = [
  ["Cookie de session (sb-…-auth-token)", "Posé seulement après connexion. Te garde connecté·e. Durée : 400 jours (valeur par défaut de la bibliothèque de connexion), jusqu'à la déconnexion."],
  ["Stockage local « decollage.data.v2 »", "Tes projets, favoris, formule et préférences, dans ton navigateur. Pas de limite de durée, jusqu'à ce que tu l'effaces."],
  ["Stockage local « decollage.owner »", "Identifiant de ton compte sur cet appareil, effacé à la déconnexion."],
  ["Stockage local « decollage.consent »", "Mémorise le choix fait dans ce panneau, pendant 6 mois."],
];

export function ConsentManager() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>({ audience: false, medias: false, publicite: false });
  const hasTrackers = OPTIONAL_TRACKERS.length > 0;

  const show = useCallback(() => {
    setDraft(getConsent()?.choices ?? { audience: false, medias: false, publicite: false });
    setCustom(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Affichage automatique SEULEMENT s'il existe un traceur facultatif et aucun choix valide.
    window.addEventListener(CONSENT_OPEN_EVENT, show);
    if (needsPrompt()) window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, show);
  }, [show]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const done = (fn: () => unknown) => () => { fn(); setOpen(false); };
  const current = open ? getConsent() : null;

  return (
    <dialog ref={ref} className="modal consent" aria-labelledby="consent-title" aria-describedby="consent-desc" onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)}>
      {open && (
        <>
          <div className="modal-head">
            <h2 id="consent-title" style={{ fontSize: 20 }}>Cookies et traceurs</h2>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer">✕</button>
          </div>
          <div className="modal-body stack" style={{ gap: 12 }}>
            <p id="consent-desc">
              {hasTrackers
                ? "Certains services facultatifs ne se chargent que si tu les acceptes. Refuser est aussi simple qu'accepter, et tu peux changer d'avis à tout moment. Ton choix n'a aucun lien avec l'acceptation des conditions d'utilisation."
                : "Aujourd'hui, Décollage n'utilise aucun cookie ni traceur facultatif : pas de mesure d'audience, pas de publicité, pas de contenu de tiers. Il n'y a donc rien à accepter ou à refuser. Voici ce qui est utilisé, parce que le service en a besoin :"}
            </p>

            {!hasTrackers && (
              <ul className="consent-list">
                {NECESSAIRES.map(([n, t]) => <li key={n}><b>{n}</b> : {t}</li>)}
              </ul>
            )}

            {hasTrackers && !custom && (
              <ul className="consent-list">
                {OPTIONAL_CATEGORIES.map((c) => {
                  const list = OPTIONAL_TRACKERS.filter((t) => t.categorie === c);
                  return (
                    <li key={c}><b>{CATEGORY_INFO[c].nom}</b> : {list.length ? list.map((t) => `${t.nom} (${t.fournisseur}, ${t.finalite}, ${t.duree})`).join(" ; ") : "aucun service."}</li>
                  );
                })}
              </ul>
            )}

            {hasTrackers && custom && (
              <fieldset className="consent-fields">
                <legend className="small mut">Choisis par catégorie (tout est refusé par défaut)</legend>
                {OPTIONAL_CATEGORIES.map((c) => (
                  <label key={c} className="consent-opt">
                    <span><b>{CATEGORY_INFO[c].nom}</b><br /><span className="small mut">{CATEGORY_INFO[c].texte}</span></span>
                    <span className="consent-switch">
                      <input type="checkbox" role="switch" className="switch" checked={draft[c]} onChange={(e) => setDraft({ ...draft, [c]: e.target.checked })} />
                      <span aria-hidden="true">{draft[c] ? "Accepté" : "Refusé"}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {current && <p className="small mut">Dernier choix : {new Date(current.date).toLocaleDateString("fr-FR")}, valable jusqu&apos;au {new Date(current.expires).toLocaleDateString("fr-FR")}.</p>}
            <p className="small">Détails : <Link href="/cookies" onClick={() => setOpen(false)} style={{ textDecoration: "underline" }}>page Cookies</Link> et <Link href="/confidentialite" onClick={() => setOpen(false)} style={{ textDecoration: "underline" }}>confidentialité</Link>.</p>
          </div>
          <div className="modal-foot consent-foot">
            {hasTrackers ? (
              custom ? (
                <>
                  <button type="button" className="btn btn-ghost" onClick={done(() => setConsent(draft))}>Enregistrer mon choix</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCustom(false)}>Retour</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost" onClick={done(() => acceptAll())}>Tout accepter</button>
                  <button type="button" className="btn btn-ghost" onClick={done(() => refuseAll())}>Tout refuser</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCustom(true)}>Personnaliser</button>
                </>
              )
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
