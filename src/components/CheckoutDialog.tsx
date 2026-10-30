"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui";
import { VERSIONS } from "@/data/legal";
import { BRAND_OPTION_PRIX, brandOptionTotalSolo, PLANS, prixCourt, type PaidPlan } from "@/lib/plans";
import "@/components/brand/brand-preview.css";

/** Ce que le navigateur envoie à /api/stripe/checkout. Le serveur revérifie tout (version comprise) et garde la preuve. */
export type PurchaseConsent = { acceptCgv: true; renonciation: true; cgvVersion: string; /** Solo seulement : option marque blanche en 2e ligne du même abonnement (le serveur revérifie). */ brandOption?: true };

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

/**
 * Confirmation de commande : CGV lues, demande d'accès immédiat avec renonciation au droit de rétractation,
 * et bouton portant la mention « Commande avec obligation de paiement ». Cases NON cochées par défaut.
 * Le texte est une proposition à faire valider (voir rapport-securite-corrections.md).
 */
export function CheckoutDialog({ plan, busy, error, onClose, onConfirm, brandAvailable = false, addOptionOnly = false }: { plan: PaidPlan | null; busy: boolean; error: string; onClose: () => void; onConfirm: (c: PurchaseConsent) => void; /** L'option marque blanche est vendue (prix configuré côté serveur). */ brandAvailable?: boolean; /** Abonné Solo qui ajoute seulement l'option à son abonnement existant. */ addOptionOnly?: boolean }) {
  const [withBrand, setWithBrand] = useState(false);
  const [cgv, setCgv] = useState(false);
  const [renonce, setRenonce] = useState(false);
  const close = () => { setCgv(false); setRenonce(false); setWithBrand(false); onClose(); };
  const p = plan ? PLANS[plan] : null;
  const ok = cgv && renonce && !busy;
  const brand = plan === "solo" && (addOptionOnly || (brandAvailable && withBrand));
  const total = brand && !addOptionOnly ? brandOptionTotalSolo() : null;

  return (
    <Modal
      open={plan !== null}
      onClose={close}
      title={addOptionOnly ? "Ajouter l'option marque blanche" : p ? `Commander la formule ${p.nom}` : "Commander"}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Annuler</button>
          <button className="btn btn-coral" disabled={!ok} onClick={() => onConfirm({ acceptCgv: true, renonciation: true, cgvVersion: VERSIONS.cgv, ...(brand ? { brandOption: true as const } : {}) })}>
            {busy ? "Redirection…" : "Commande avec obligation de paiement"}
          </button>
        </>
      }
    >
      {p && (
        <div className="stack" style={{ gap: 14 }}>
          {addOptionOnly ? (
            <>
              <div className="ck-summary">
                <span className="ck-plan">Option marque blanche (Solo)</span>
                <span className="ck-price">+{eur(BRAND_OPTION_PRIX)} <small>par mois</small></span>
              </div>
              <p>
                L&apos;option est ajoutée à ton abonnement Solo existant (pas de second abonnement) : ton total passe à <b>{eur(brandOptionTotalSolo())} par mois</b>. Le montant de l&apos;option pour le mois en cours est calculé au prorata et prélevé tout de suite sur ton moyen de paiement enregistré ; si le paiement échoue, rien n&apos;est ajouté. Tu peux la retirer à tout moment (crédit au prorata).
              </p>
            </>
          ) : (
            <>
              <div className="ck-summary">
                <span className="ck-plan">Formule {p.nom}{brand ? " + option marque blanche" : ""}</span>
                <span className="ck-price">{brand ? eur(brandOptionTotalSolo()) : prixCourt(plan!)} <small>par mois</small></span>
              </div>
              {plan === "solo" && brandAvailable && (
                <label className="ck-check">
                  <input type="checkbox" className="check" checked={withBrand} onChange={(e) => setWithBrand(e.target.checked)} style={{ marginTop: 2 }} />
                  <span className="small"><b>Ajouter l&apos;option marque blanche</b> : +{eur(BRAND_OPTION_PRIX)} par mois (total {eur(brandOptionTotalSolo())} par mois). Retire la mention « Créé avec Décollage » de tes boutiques publiées. Un seul abonnement.</span>
                </label>
              )}
              <p>
                <b>{p.nom}{brand ? " + option" : ""}</b> : {total !== null ? eur(total) : prixCourt(plan!)} par mois, abonnement sans engagement (résiliable en ligne à tout moment). Le paiement se fait ensuite sur la page sécurisée de Stripe.
              </p>
            </>
          )}
          <label className="ck-check">
            <input type="checkbox" className="check" checked={cgv} onChange={(e) => setCgv(e.target.checked)} style={{ marginTop: 2 }} />
            <span className="small">J&apos;ai lu et j&apos;accepte les <Link href="/cgv" target="_blank" style={{ textDecoration: "underline" }}>conditions générales de vente</Link>.</span>
          </label>
          <label className="ck-check">
            <input type="checkbox" className="check" checked={renonce} onChange={(e) => setRenonce(e.target.checked)} style={{ marginTop: 2 }} />
            <span className="small">
              Je demande que ma formule soit activée immédiatement, avant la fin du délai de rétractation de 14 jours. Je reconnais que, si j&apos;exerce mon droit de rétractation, je devrai payer la part du service déjà fournie, et que je perds ce droit une fois le service pleinement exécuté. Voir la page <Link href="/remboursement" target="_blank" style={{ textDecoration: "underline" }}>Remboursement</Link>.
            </span>
          </label>
          {!ok && !busy && <p className="ck-state">Coche les deux cases pour activer le bouton de commande.</p>}
          <p className="ck-legal">En cliquant sur « Commande avec obligation de paiement », tu t&apos;engages à payer {addOptionOnly ? `${eur(BRAND_OPTION_PRIX)} de plus` : total !== null ? eur(total) : prixCourt(plan!)} par mois jusqu&apos;à ta résiliation{addOptionOnly ? " (ou jusqu'au retrait de l'option)" : ""}. Date, version des conditions et cases cochées sont enregistrées comme preuve.</p>
          {error && <div className="alert alert-bad bw-alert bw-alert-bad" role="alert"><span>{error}</span></div>}
        </div>
      )}
    </Modal>
  );
}
