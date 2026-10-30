"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useVitrine } from "./CartProvider";
import { PROBLEME_LABEL, hasProbleme, imagesSures, mapCommandeError, parseCommandeSuccess, resolveCart, totalIndicatif } from "./logic";
import { formatEuros } from "@/lib/boutique/money";
import { validateCommande } from "@/lib/boutique/validate";
import type { Mode } from "@/lib/boutique/types";

const MODE_LABEL: Record<Mode, string> = {
  retrait: "Retrait sur place",
  livraison: "Livraison",
  contact: "Être recontacté(e) par la boutique",
};

export function PanierView() {
  const { catalogue, lignes, pret, fixer, retirer, assurerCle, vider } = useVitrine();
  const router = useRouter();
  const b = catalogue.boutique;
  const items = resolveCart(lignes, catalogue.produits);
  const probleme = hasProbleme(items);
  const modes = b.modes;
  const [mode, setMode] = useState<Mode | "">("");
  const modeEff: Mode | "" = mode || modes[0] || "";
  const [f, setF] = useState({ nom: "", email: "", telephone: "", adresse: "", note: "", site: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!pret) return <p className="vt-empty" role="status">Chargement du panier…</p>;
  if (!lignes.length) {
    return (
      <div className="vt-empty">
        <p>Ton panier est vide.</p>
        <Link className="vt-btn" href={`/b/${b.slug}`}>Voir les produits</Link>
      </div>
    );
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verrou.current) return; // double clic : une seule requête à la fois
    setErreur("");
    if (!modeEff) { setErreur("Cette boutique ne prend pas de commande en ligne pour le moment."); return; }
    if (probleme) { setErreur("Retire ou ajuste les articles signalés avant de commander."); return; }
    const payload = {
      slug: b.slug,
      cle: assurerCle(),
      mode: modeEff,
      client: { nom: f.nom, email: f.email, telephone: f.telephone, adresse: modeEff === "livraison" ? f.adresse : "", note: f.note },
      lignes: lignes.map((l) => ({ variante_id: l.variante_id, quantite: l.quantite })),
      site: f.site, // champ piège : reste vide pour un humain
    };
    const v = validateCommande(payload);
    if (!v.ok) {
      setErrs(v.errors);
      setErreur("Corrige les champs indiqués puis valide de nouveau.");
      return;
    }
    setErrs({});
    verrou.current = true;
    setEnvoi(true);
    try {
      let status: number | null = null;
      let body: unknown = null;
      try {
        const res = await fetch("/api/boutique/commande", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        status = res.status;
        body = await res.json().catch(() => null);
      } catch {
        status = null;
      }
      const ok = status === null ? null : parseCommandeSuccess(status, body);
      if (ok) {
        vider();
        const h = new URLSearchParams({ ref: ok.ref });
        if (ok.jeton) h.set("jeton", ok.jeton);
        router.push(`/b/${b.slug}/commande#${h.toString()}`);
        return; // le verrou reste posé pendant la navigation
      }
      if (status !== null && (status === 200 || status === 201)) {
        setErreur("Le serveur n'a pas confirmé la commande (réponse incomplète). Rien n'est enregistré à coup sûr : réessaie ou contacte la boutique.");
      } else {
        const m = mapCommandeError(status, body);
        setErreur(m.message);
        setErrs(m.champs);
        if (m.rafraichir) router.refresh();
      }
      verrou.current = false;
      setEnvoi(false);
    } catch {
      verrou.current = false;
      setEnvoi(false);
      setErreur("Une erreur est survenue. Ta commande n'est pas confirmée.");
    }
  };

  const fe = (k: string) => errs[k];
  const total = totalIndicatif(items);

  return (
    <div className="vt-cols">
      <section aria-labelledby="vt-h-panier">
        <h1 id="vt-h-panier" style={{ fontSize: "1.5rem", marginBottom: 12 }}>Ton panier</h1>
        {probleme ? (
          <div className="vt-alert warn" role="alert">
            <strong>Certains articles ne sont plus disponibles tels quels.</strong>
            <p>Ajuste la quantité ou retire les articles signalés pour pouvoir commander.</p>
          </div>
        ) : null}
        <ul className="vt-lines">
          {items.map((it) => {
            const img = it.produit ? imagesSures(it.produit.images)[0] : undefined;
            const id = it.ligne.variante_id;
            const nom = it.produit ? it.produit.titre : "Article retiré";
            return (
              <li key={id} className={`vt-line${it.probleme ? " pb" : ""}`}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="vt-img" />
                ) : <div className="vt-noimg" aria-hidden="true">·</div>}
                <div className="vt-line-body">
                  <strong>{nom}</strong>
                  {it.variante && it.produit && it.produit.variantes.length > 1 ? <span className="vt-hint">Option : {it.variante.nom}</span> : null}
                  {it.produit ? <span>{formatEuros(it.prix_unitaire_centimes)} l&apos;unité</span> : null}
                  {it.probleme ? <span className="vt-err" role="alert">{PROBLEME_LABEL[it.probleme]}{it.probleme === "stock_insuffisant" ? ` Maximum : ${it.max}.` : ""}</span> : null}
                  <div className="vt-line-actions">
                    {it.probleme === "retire" || it.probleme === "indisponible" ? null : (
                      <div className="vt-qty" role="group" aria-label={`Quantité de ${nom}`}>
                        <button type="button" aria-label={`Diminuer la quantité de ${nom}`} onClick={() => fixer(id, it.ligne.quantite - 1)}>−</button>
                        <input aria-label={`Quantité de ${nom}`} inputMode="numeric" value={it.ligne.quantite} onChange={(e) => fixer(id, Number(e.target.value.replace(/\D/g, "")))} />
                        <button type="button" aria-label={`Augmenter la quantité de ${nom}`} onClick={() => fixer(id, it.ligne.quantite + 1)} disabled={it.max > 0 && it.ligne.quantite >= it.max}>+</button>
                      </div>
                    )}
                    <button type="button" className="vt-btn sm alt" onClick={() => retirer(id)}>Retirer<span className="sr-only"> {nom}</span></button>
                  </div>
                  {!it.probleme ? <span>Sous-total indicatif : <strong>{formatEuros(it.prix_unitaire_centimes * it.ligne.quantite)}</strong></span> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="vt-total"><span>Total indicatif</span><span>{formatEuros(total)}</span></div>
        <p className="vt-hint">Les prix affichés sont indicatifs : la boutique recalcule le total exact à partir de ses prix et de son stock au moment de la commande. Aucun paiement n&apos;est demandé en ligne.</p>
      </section>

      <section aria-labelledby="vt-h-cmd" className="vt-box">
        <h2 id="vt-h-cmd">Passer la commande</h2>
        {!modes.length ? (
          <p className="vt-alert warn">Cette boutique ne prend pas de commande en ligne pour le moment. Contacte-la directement.</p>
        ) : (
          <form onSubmit={envoyer} noValidate>
            <p className="vt-hint">Commande enregistrée sans paiement en ligne : le règlement se fait directement avec le commerçant.</p>
            {erreur ? <div className="vt-alert bad" role="alert" tabIndex={-1}>{erreur}</div> : null}

            {modes.length > 1 ? (
              <fieldset className="vt-field">
                <legend>Mode de réception</legend>
                <div className="vt-opts">
                  {modes.map((m) => (
                    <label key={m} className="vt-opt"><input type="radio" name="mode" value={m} checked={modeEff === m} onChange={() => setMode(m)} />{MODE_LABEL[m]}</label>
                  ))}
                </div>
              </fieldset>
            ) : <p><strong>{MODE_LABEL[modes[0]!]}</strong></p>}

            <div className="vt-field">
              <label htmlFor="c-nom">Nom *</label>
              <input id="c-nom" name="nom" autoComplete="name" required value={f.nom} onChange={set("nom")} aria-invalid={!!fe("client.nom")} aria-describedby={fe("client.nom") ? "c-nom-e" : undefined} />
              {fe("client.nom") ? <span id="c-nom-e" className="vt-err">{fe("client.nom")}</span> : null}
            </div>
            <div className="vt-field">
              <label htmlFor="c-email">E-mail</label>
              <input id="c-email" name="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} aria-invalid={!!fe("client.email")} aria-describedby={fe("client.email") ? "c-email-e" : "c-email-h"} />
              <span id="c-email-h" className="vt-hint">Un e-mail ou un téléphone est nécessaire pour te recontacter.</span>
              {fe("client.email") ? <span id="c-email-e" className="vt-err">{fe("client.email")}</span> : null}
            </div>
            <div className="vt-field">
              <label htmlFor="c-tel">Téléphone</label>
              <input id="c-tel" name="telephone" type="tel" autoComplete="tel" value={f.telephone} onChange={set("telephone")} aria-invalid={!!fe("client.telephone")} aria-describedby={fe("client.telephone") ? "c-tel-e" : undefined} />
              {fe("client.telephone") ? <span id="c-tel-e" className="vt-err">{fe("client.telephone")}</span> : null}
            </div>
            {modeEff === "livraison" ? (
              <div className="vt-field">
                <label htmlFor="c-adr">Adresse de livraison *</label>
                <textarea id="c-adr" name="adresse" rows={3} autoComplete="street-address" value={f.adresse} onChange={set("adresse")} aria-invalid={!!fe("client.adresse")} aria-describedby={fe("client.adresse") ? "c-adr-e" : undefined} />
                {fe("client.adresse") ? <span id="c-adr-e" className="vt-err">{fe("client.adresse")}</span> : null}
              </div>
            ) : modeEff === "retrait" && b.adresse ? (
              <p className="vt-hint">Retrait à : {b.adresse}</p>
            ) : null}
            <div className="vt-field">
              <label htmlFor="c-note">Message pour la boutique (facultatif)</label>
              <textarea id="c-note" name="note" rows={2} value={f.note} onChange={set("note")} aria-invalid={!!fe("client.note")} />
              {fe("client.note") ? <span className="vt-err">{fe("client.note")}</span> : null}
            </div>
            {/* Champ piège anti-spam : invisible, hors tabulation. L'API attend « site » vide. */}
            <div className="vt-trap" aria-hidden="true">
              <label>Ne pas remplir<input name="site" tabIndex={-1} autoComplete="off" value={f.site} onChange={set("site")} /></label>
            </div>
            {fe("lignes") ? <p className="vt-err">{fe("lignes")}</p> : null}
            <button type="submit" className="vt-btn full" disabled={envoi || probleme} aria-disabled={envoi || probleme}>
              {envoi ? "Envoi en cours…" : "Envoyer ma commande"}
            </button>
            <p className="vt-hint" style={{ marginTop: 8 }}>Tes coordonnées ne sont transmises qu&apos;à cette boutique pour traiter ta commande.</p>
          </form>
        )}
      </section>
    </div>
  );
}
