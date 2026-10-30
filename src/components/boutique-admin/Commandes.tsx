"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, toast } from "@/components/ui";
import { formatEuros } from "@/lib/boutique/money";
import { STATUT_LABEL, STATUTS_COMMANDE, type Commande, type StatutCommande } from "@/lib/boutique/types";
import { ErrorBox, WithBoutique } from "./BoutiqueContext";
import { ACTION_LABEL, api, prochainsStatuts } from "./logic";

export function Commandes() {
  return <WithBoutique>{({ boutique }) => <Liste bid={boutique.id} />}</WithBoutique>;
}

const QUAND = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const BADGE: Record<StatutCommande, string> = { nouvelle: "badge-coral", confirmee: "", prete: "badge-warn", terminee: "badge-ok", annulee: "badge-bad" };

/** Mention obligatoire : aucune commande n'est payée en ligne. */
function SansPaiement() {
  return <span className="badge badge-line">Commande sans paiement en ligne</span>;
}

function Liste({ bid }: { bid: string }) {
  const [filtre, setFiltre] = useState<StatutCommande | "">("");
  const [liste, setListe] = useState<Commande[] | null>(null);
  const [fail, setFail] = useState<{ code: string; message: string } | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await api<{ commandes: Commande[] }>(`/${bid}/commandes${filtre ? `?statut=${filtre}` : ""}`);
    if (!r.ok) return setFail({ code: r.code, message: r.message });
    setFail(null);
    setListe(r.data.commandes);
  }, [bid, filtre]);

  useEffect(() => {
    // Chargement depuis l'API à chaque changement de filtre.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const commande = liste?.find((c) => c.ref === sel) ?? null;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="f-statut">Filtrer par statut</label>
          <select id="f-statut" className="input" value={filtre} onChange={(e) => { setListe(null); setFiltre(e.target.value as StatutCommande | ""); }}>
            <option value="">Tous les statuts</option>
            {STATUTS_COMMANDE.map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
          </select>
        </div>
        <SansPaiement />
      </div>

      {fail ? <ErrorBox code={fail.code} message={fail.message} onRetry={() => void charger()} /> : liste === null ? (
        <div className="skeleton" style={{ height: 160 }} aria-busy="true" aria-label="Chargement des commandes" />
      ) : liste.length === 0 ? (
        <div className="empty"><h2 className="h-sec">Aucune commande</h2><p className="mut">{filtre ? "Aucune commande avec ce statut." : "Les commandes de tes clients apparaîtront ici dès que ta boutique en recevra."}</p></div>
      ) : (
        <div className="scroll-x panel" style={{ padding: 8 }}>
          <table className="table">
            <caption className="mut" style={{ textAlign: "left", padding: "8px 10px" }}>{liste.length} commande{liste.length > 1 ? "s" : ""} (200 dernières au maximum)</caption>
            <thead><tr><th scope="col">Commande</th><th scope="col">Client</th><th scope="col">Total</th><th scope="col">Statut</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.ref}>
                  <td><strong>{c.ref}</strong><br /><span className="mut">{QUAND(c.created_at)}</span></td>
                  <td>{c.client_nom}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatEuros(c.total_centimes)}</td>
                  <td><span className={`badge ${BADGE[c.statut]}`}>{STATUT_LABEL[c.statut]}</span></td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => setSel(c.ref)} aria-label={`Ouvrir la commande ${c.ref}`}>Détail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Detail bid={bid} commande={commande} onClose={() => setSel(null)} reload={charger} />
    </div>
  );
}

function Detail({ bid, commande: c, onClose, reload }: { bid: string; commande: Commande | null; onClose: () => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [annul, setAnnul] = useState(false);

  async function changer(statut: StatutCommande) {
    if (!c) return;
    setBusy(true);
    setFail("");
    const r = await api<{ commande: { statut: StatutCommande } }>(`/${bid}/commandes/${c.ref}`, { method: "PATCH", body: { statut } });
    setBusy(false);
    setAnnul(false);
    if (!r.ok) {
      await reload(); // l'état affiché doit refléter celui du serveur
      return setFail(r.message);
    }
    toast(`Statut : ${STATUT_LABEL[r.data.commande.statut]}`);
    await reload();
  }

  const suivants = c ? prochainsStatuts(c.statut) : [];
  return (
    <Modal open={!!c} onClose={() => { setFail(""); setAnnul(false); onClose(); }} wide title={c ? `Commande ${c.ref}` : "Commande"}>
      {c && (
        <div className="stack">
          <div className="alert alert-info"><strong>Commande sans paiement en ligne.</strong> Paiement : non payée en ligne, à régler directement avec le client.</div>
          <p style={{ margin: 0 }}><span className={`badge ${BADGE[c.statut]}`}>{STATUT_LABEL[c.statut]}</span> <span className="mut">· reçue le {QUAND(c.created_at)} · mode : {c.mode}</span></p>
          <div>
            <strong>{c.client_nom}</strong><br />
            {c.client_email && <a href={`mailto:${c.client_email}`}>{c.client_email}</a>}{c.client_email && c.client_telephone && " · "}
            {c.client_telephone && <a href={`tel:${c.client_telephone}`}>{c.client_telephone}</a>}
            {c.adresse_livraison && <p style={{ margin: "6px 0 0" }}>Adresse : {c.adresse_livraison}</p>}
            {c.note && <p style={{ margin: "6px 0 0" }}>Note : {c.note}</p>}
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th scope="col">Article</th><th scope="col">Qté</th><th scope="col">Prix</th></tr></thead>
              <tbody>
                {c.lignes_commande.map((l, i) => <tr key={i}><td>{l.produit_titre}{l.variante_nom && l.variante_nom !== "Unique" ? ` (${l.variante_nom})` : ""}</td><td>{l.quantite}</td><td style={{ whiteSpace: "nowrap" }}>{formatEuros(l.prix_unitaire_centimes * l.quantite)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p style={{ margin: 0 }}><strong>Total : {formatEuros(c.total_centimes)}</strong></p>
          {fail && <ErrorBox message={fail} />}
          {suivants.length === 0 ? <p className="mut" style={{ margin: 0 }}>Statut définitif : plus de changement possible.</p> : (
            <div className="row">
              {suivants.map((s) => s === "annulee"
                ? <button key={s} className="btn btn-danger" disabled={busy} onClick={() => setAnnul(true)}>{ACTION_LABEL[s]}</button>
                : <button key={s} className="btn btn-dark" disabled={busy} onClick={() => void changer(s)}>{ACTION_LABEL[s]}</button>)}
            </div>
          )}
          {annul && (
            <div className="alert alert-warn" role="alertdialog" aria-label="Confirmer l'annulation">
              <p style={{ marginTop: 0 }}>Annuler cette commande est définitif et remet le stock en place.</p>
              <div className="row"><button className="btn btn-danger" disabled={busy} onClick={() => void changer("annulee")}>Oui, annuler</button><button className="btn btn-ghost" onClick={() => setAnnul(false)}>Non, garder</button></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
