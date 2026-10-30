"use client";

import Link from "next/link";
import { useState } from "react";
import { useVitrine } from "./CartProvider";
import { DISPO_LABEL, dispoProduit, imagesSures, type ProduitPub } from "./logic";
import { formatEuros } from "@/lib/boutique/money";

export function Badge({ p }: { p: Pick<ProduitPub, "variantes"> }) {
  const d = dispoProduit(p);
  return <span className={`vt-badge ${d}`}>{DISPO_LABEL[d]}</span>;
}

/** Catalogue : filtres par catégorie et grille de produits. */
export function CatalogueView() {
  const { catalogue, ajouter } = useVitrine();
  const [cat, setCat] = useState<string | null>(null);
  const [ajoute, setAjoute] = useState("");
  const { boutique: b, categories, produits } = catalogue;
  const slug = b.slug;
  // Seules les catégories qui contiennent au moins un produit sont proposées.
  const cats = categories.filter((c) => produits.some((p) => p.categorie_id === c.id));
  const liste = cat ? produits.filter((p) => p.categorie_id === cat) : produits;
  const peutCommander = b.modes.length > 0;

  if (!produits.length) return <p className="vt-empty">Cette boutique n&apos;a pas encore de produit en ligne.</p>;

  return (
    <>
      {cats.length > 0 ? (
        <ul className="vt-filters" aria-label="Filtrer par catégorie">
          <li><button type="button" className="vt-chip" aria-pressed={cat === null} onClick={() => setCat(null)}>Tout ({produits.length})</button></li>
          {cats.map((c) => (
            <li key={c.id}><button type="button" className="vt-chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.nom}</button></li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only" role="status">{liste.length} produit{liste.length > 1 ? "s" : ""} affiché{liste.length > 1 ? "s" : ""}{ajoute ? `. ${ajoute} ajouté au panier.` : ""}</p>
      <ul className="vt-grid">
        {liste.map((p) => {
          const img = imagesSures(p.images)[0];
          const dispo = p.variantes.filter((v) => v.stock > 0);
          const direct = peutCommander && p.variantes.length === 1 && dispo.length === 1;
          return (
            <li key={p.id} className="vt-card">
              <Link href={`/b/${slug}/p/${p.id}`} className="vt-card-link">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="vt-img" loading="lazy" />
                ) : <div className="vt-noimg" aria-hidden="true">Pas de photo</div>}
                <div className="vt-card-body">
                  <h3>{p.titre}</h3>
                  <span className="vt-price">{formatEuros(p.prix_centimes)}</span>
                  <Badge p={p} />
                </div>
              </Link>
              <div className="vt-card-foot">
                {direct ? (
                  <button type="button" className="vt-btn sm full" onClick={() => { ajouter(dispo[0]!.id, 1); setAjoute(p.titre); }}>
                    Ajouter<span className="sr-only"> {p.titre} au panier</span>
                  </button>
                ) : (
                  <Link className="vt-btn sm alt full" href={`/b/${slug}/p/${p.id}`}>{dispo.length ? "Choisir" : "Voir"}<span className="sr-only"> {p.titre}</span></Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
