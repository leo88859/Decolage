"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatEuros } from "@/lib/boutique/money";
import { PAIEMENT_LABEL, STATUT_LABEL, type StatutCommande } from "@/lib/boutique/types";
import { ContactLinks } from "./Chrome";
import { useVitrine } from "./CartProvider";

type Suivi = {
  ref: string; statut: StatutCommande; total_centimes: number; mode: string;
  boutique: { nom: string; slug: string };
  lignes: { titre: string; variante: string; prix_unitaire_centimes: number; quantite: number }[];
};

const REF = /^CMD-[0-9A-F]{8}$/;
const JETON = /^[0-9a-f]{64}$/;

const subHash = (f: () => void) => { window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); };
function lireHash(raw: string) {
  const h = new URLSearchParams(raw.replace(/^#/, ""));
  return { ref: (h.get("ref") ?? "").toUpperCase(), jeton: (h.get("jeton") ?? "").toLowerCase() };
}

function parseSuivi(x: unknown): Suivi | null {
  const c = (x as { commande?: Partial<Suivi> } | null)?.commande;
  if (!c || typeof c.ref !== "string" || typeof c.total_centimes !== "number" || !Array.isArray(c.lignes) || typeof c.statut !== "string" || !(c.statut in STATUT_LABEL)) return null;
  return c as Suivi;
}

/** Suivi d'une commande par référence + jeton secret ; `confirmation` affiche en plus le message de réussite
 *  (uniquement quand le serveur a bien retrouvé la commande avec son jeton). */
export function SuiviView({ confirmation = false }: { confirmation?: boolean }) {
  const { catalogue } = useVitrine();
  const b = catalogue.boutique;
  const hash = useSyncExternalStore(subHash, () => window.location.hash, () => "");
  const h = lireHash(hash);
  const [saisieRef, setRef] = useState<string | null>(null);
  const [saisieJeton, setJeton] = useState<string | null>(null);
  const ref = saisieRef ?? h.ref;
  const jeton = saisieJeton ?? h.jeton;
  const [cmd, setCmd] = useState<Suivi | null>(null);
  const [err, setErr] = useState("");
  const [attente, setAttente] = useState(false);
  const [lien, setLien] = useState("");

  const chercher = async (r: string, j: string) => {
    setErr(""); setCmd(null); setAttente(true);
    try {
      if (!REF.test(r) || !JETON.test(j)) { setErr("Référence ou code de suivi invalide."); return; }
      const res = await fetch("/api/boutique/suivi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: r, jeton: j }) });
      const body: unknown = await res.json().catch(() => null);
      const c = res.ok ? parseSuivi(body) : null;
      if (c && c.boutique?.slug === b.slug) {
        setCmd(c);
        setLien(`${window.location.origin}/b/${b.slug}/suivi#ref=${r}&jeton=${j}`);
      } else if (res.status === 404 || (res.ok && c)) setErr("Aucune commande ne correspond à cette référence et à ce code de suivi.");
      else if (res.status === 429) setErr("Trop de tentatives. Réessaie dans une minute.");
      else setErr("Suivi indisponible pour le moment. Réessaie plus tard.");
    } catch {
      setErr("Connexion impossible. Réessaie plus tard.");
    } finally {
      setAttente(false);
    }
  };

  const { ref: hRef, jeton: hJeton } = h;
  useEffect(() => {
    if (hRef && hJeton) queueMicrotask(() => void chercher(hRef, hJeton));
    // Recherche automatique quand le lien de suivi (adresse avec #ref=…&jeton=…) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hRef, hJeton]);
  const rejouee = confirmation && hRef && !hJeton && REF.test(hRef) ? hRef : "";

  return (
    <div>
      {confirmation && cmd ? (
        <div className="vt-alert ok" role="status">
          <h1 style={{ fontSize: "1.3rem" }}>Commande enregistrée</h1>
          <p>Référence : <span className="vt-ref">{cmd.ref}</span></p>
          <p><strong>Commande enregistrée — sans paiement en ligne : le règlement se fait avec le commerçant.</strong></p>
          <p>{b.nom} va traiter ta commande et te recontacter avec les coordonnées que tu as indiquées.</p>
        </div>
      ) : null}
      {confirmation && !cmd && rejouee ? (
        <div className="vt-alert ok" role="status">
          <h1 style={{ fontSize: "1.3rem" }}>Commande déjà enregistrée</h1>
          <p>Cette commande avait déjà été enregistrée (référence <span className="vt-ref">{rejouee}</span>) : aucun doublon n&apos;a été créé. Sans paiement en ligne : le règlement se fait avec le commerçant.</p>
        </div>
      ) : null}
      {!confirmation || (!cmd && !rejouee) ? <h1 style={{ fontSize: "1.5rem", marginBottom: 12 }}>Suivre ma commande</h1> : null}
      {confirmation && attente ? <p role="status">Vérification de ta commande auprès du serveur…</p> : null}
      {confirmation && !cmd && !rejouee && !attente && err ? <div className="vt-alert bad" role="alert">Impossible de confirmer cette commande. Si tu viens de la valider, contacte la boutique avant de recommencer.</div> : null}

      {cmd ? (
        <section className="vt-box" aria-label="Détail de la commande">
          <h2>Commande {cmd.ref}</h2>
          <p>Statut : <strong>{STATUT_LABEL[cmd.statut]}</strong></p>
          <p>Paiement : <strong>{PAIEMENT_LABEL}</strong></p>
          <table className="vt-table">
            <caption className="sr-only">Articles de la commande</caption>
            <thead><tr><th scope="col">Article</th><th scope="col" className="num">Qté</th><th scope="col" className="num">Prix</th></tr></thead>
            <tbody>
              {cmd.lignes.map((l, i) => (
                <tr key={i}><td>{l.titre}{l.variante && l.variante !== "Unique" ? ` (${l.variante})` : ""}</td><td className="num">{l.quantite}</td><td className="num">{formatEuros(l.prix_unitaire_centimes * l.quantite)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="vt-total"><span>Total</span><span>{formatEuros(cmd.total_centimes)}</span></p>
          {confirmation ? (
            <div className="vt-field">
              <label htmlFor="vt-lien">Garde ce lien pour suivre ta commande (il ne sera plus affiché)</label>
              <input id="vt-lien" readOnly value={lien} onFocus={(e) => e.currentTarget.select()} />
              <span className="vt-hint">Ce lien est secret : ne le partage pas.</span>
            </div>
          ) : null}
          <p><Link className="vt-btn alt" href={`/b/${b.slug}`}>Retour à la boutique</Link></p>
          <ContactLinks b={b} message={`Bonjour, au sujet de ma commande ${cmd.ref} : `} />
        </section>
      ) : null}

      {!cmd && (!confirmation || !!rejouee || (!attente && !!err)) ? (
        <form className="vt-box" onSubmit={(e) => { e.preventDefault(); void chercher(ref.trim().toUpperCase(), jeton.trim().toLowerCase()); }} noValidate>
          <p className="vt-hint">Entre la référence de ta commande et le code de suivi (contenu dans le lien de suivi donné à la commande).</p>
          {err && !confirmation ? <div className="vt-alert bad" role="alert">{err}</div> : null}
          <div className="vt-field">
            <label htmlFor="s-ref">Référence (ex. CMD-3F9A1C2B)</label>
            <input id="s-ref" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" spellCheck={false} />
          </div>
          <div className="vt-field">
            <label htmlFor="s-jeton">Code de suivi</label>
            <input id="s-jeton" value={jeton} onChange={(e) => setJeton(e.target.value)} autoComplete="off" spellCheck={false} />
          </div>
          <button type="submit" className="vt-btn" disabled={attente}>{attente ? "Recherche…" : "Voir ma commande"}</button>
        </form>
      ) : null}
    </div>
  );
}
