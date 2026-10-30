"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "./CatalogueView";
import { useVitrine } from "./CartProvider";
import { DISPO_LABEL, MAX_QTE, dispoVariante, imagesSures } from "./logic";
import { formatEuros } from "@/lib/boutique/money";

export function ProduitView({ produitId }: { produitId: string }) {
  const { catalogue, lignes, ajouter } = useVitrine();
  const p = catalogue.produits.find((x) => x.id === produitId);
  const [img, setImg] = useState(0);
  const premiereDispo = p?.variantes.find((v) => v.disponible) ?? p?.variantes[0];
  const [choix, setChoix] = useState<string | null>(null);
  const [qte, setQte] = useState(1);
  const [msg, setMsg] = useState("");
  if (!p) return null;
  const slug = catalogue.boutique.slug;
  const images = imagesSures(p.images);
  const vid = choix ?? premiereDispo?.id ?? "";
  const v = p.variantes.find((x) => x.id === vid);
  const dansPanier = lignes.find((l) => l.variante_id === vid)?.quantite ?? 0;
  const max = v && v.disponible ? Math.max(0, MAX_QTE - dansPanier) : 0; // le stock exact n'est pas public : la boutique confirme à la commande
  const commandable = catalogue.boutique.modes.length > 0;

  const ajouterAuPanier = () => {
    if (!v || max < 1) return;
    const q = Math.min(Math.max(1, qte), max);
    ajouter(v.id, q);
    setMsg(`${q} × ${p.titre}${p.variantes.length > 1 ? ` (${v.nom})` : ""} ajouté au panier.`);
    setQte(1);
  };

  return (
    <article className="vt-prod">
      <div>
        {images.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[Math.min(img, images.length - 1)]} alt={`${p.titre}, photo ${Math.min(img, images.length - 1) + 1} sur ${images.length}`} className="vt-gallery-main" />
        ) : <div className="vt-noimg vt-gallery-main" aria-hidden="true">Pas de photo</div>}
        {images.length > 1 ? (
          <div className="vt-thumbs" role="group" aria-label="Photos du produit">
            {images.map((u, i) => (
              <button key={u + i} type="button" className="vt-thumb" aria-pressed={i === img} aria-label={`Photo ${i + 1}`} onClick={() => setImg(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <h1>{p.titre}</h1>
        <span className="vt-price">{formatEuros(p.prix_centimes)}</span>
        <Badge p={p} />
        {p.description ? <p className="vt-desc">{p.description}</p> : null}

        {p.variantes.length > 1 ? (
          <fieldset className="vt-field">
            <legend>Choisir une option</legend>
            <div className="vt-opts">
              {p.variantes.map((x) => {
                const d = dispoVariante(x);
                return (
                  <label key={x.id} className={`vt-opt${d === "indisponible" ? " off" : ""}`}>
                    <input type="radio" name="variante" value={x.id} checked={x.id === vid} disabled={d === "indisponible"} onChange={() => { setChoix(x.id); setQte(1); }} />
                    <span>{x.nom} <span className="vt-hint">({DISPO_LABEL[d]})</span></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {!commandable ? (
          <p className="vt-hint">Cette boutique ne prend pas de commande en ligne pour le moment : contacte-la directement (voir en bas de page).</p>
        ) : v && v.disponible ? (
          <>
            {v.stock_bas ? <p className="vt-hint">Stock bas : il n&apos;en reste plus beaucoup.</p> : null}
            <div className="vt-field">
              <label htmlFor="vt-qte">Quantité</label>
              <div className="vt-qty">
                <button type="button" aria-label="Diminuer la quantité" onClick={() => setQte((q) => Math.max(1, q - 1))}>−</button>
                <input id="vt-qte" inputMode="numeric" value={qte} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setQte(Math.min(Math.max(1, n || 1), Math.max(1, max))); }} />
                <button type="button" aria-label="Augmenter la quantité" onClick={() => setQte((q) => Math.min(Math.max(1, max), q + 1))}>+</button>
              </div>
            </div>
            <button type="button" className="vt-btn full" onClick={ajouterAuPanier} disabled={max < 1}>
              {max < 1 ? "Tout le stock est déjà dans ton panier" : "Ajouter au panier"}
            </button>
          </>
        ) : (
          <p className="vt-alert warn" role="status">Ce produit est indisponible pour le moment.</p>
        )}
        <p role="status" className="vt-hint" style={{ minHeight: "1.5em" }}>{msg}</p>
        {dansPanier > 0 || msg ? <p><Link className="vt-btn alt" href={`/b/${slug}/panier`}>Voir le panier</Link></p> : null}
        <p className="vt-hint">Le prix affiché est indicatif : le total est confirmé par la boutique à la commande.</p>
      </div>
    </article>
  );
}
