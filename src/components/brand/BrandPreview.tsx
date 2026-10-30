"use client";

import type { CSSProperties } from "react";
import { brandToCssObject } from "@/lib/brand/css";
import type { Brand } from "@/lib/brand/types";
import "./brand-preview.css";

export type Device = "desktop" | "mobile";

const initials = (name: string) => [...name.trim()].slice(0, 2).join("").toUpperCase() || "?";

/**
 * Aperçu d'une interface d'exemple avec le nom, le logo et les couleurs de la marque.
 * Les couleurs passent par brandToCssObject (valeurs revalidées) ; le logo n'est affiché que par <img>.
 */
export function BrandPreview({ brand, device }: { brand: Brand; device: Device }) {
  const style = brandToCssObject(brand) as CSSProperties;
  const mark = brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} alt="" className="bp-logo" />
  ) : (
    <span className="bp-initials" aria-hidden="true">{initials(brand.name)}</span>
  );
  return (
    <div className={`bp-frame bp-frame-${device}`}>
    <div className="bp-chrome" aria-hidden="true">
      {device === "desktop" ? (
        <>
          <span className="bp-dots"><i /><i /><i /></span>
          <span className="bp-url">exemple.fr</span>
        </>
      ) : (
        <span className="bp-notch" />
      )}
    </div>
    <div className={`bp bp-${device}`} style={style} role="group" aria-label={`Aperçu ${device === "desktop" ? "sur ordinateur" : "sur mobile"}`}>
      <div className="bp-bar">
        <span className="bp-brand">{mark}<b>{brand.name}</b></span>
        <span className="bp-nav" aria-hidden="true"><i>Produit</i><i>Tarifs</i></span>
        <span className="bp-btn bp-btn-sm" aria-hidden="true">Connexion</span>
      </div>
      <div className="bp-hero">
        <p className="bp-eyebrow">Exemple de page</p>
        <h3>Bienvenue chez {brand.name}</h3>
        <p>Un texte d&apos;exemple pour voir ton fond et la couleur de ton texte. Rien de ceci n&apos;est publié.</p>
        <div className="bp-actions" aria-hidden="true">
          <span className="bp-btn">Commencer</span>
          <span className="bp-btn bp-btn-alt">En savoir plus</span>
        </div>
      </div>
      <div className="bp-cards" aria-hidden="true">
        <div className="bp-card"><span className="bp-chip">Nouveau</span><b>Tableau de bord</b><span>3 projets actifs</span></div>
        <div className="bp-card"><span className="bp-chip">Info</span><b>Clients</b><span>128 inscrits</span></div>
      </div>
      <p className="bp-foot">© {brand.name} · données d&apos;exemple</p>
    </div>
    </div>
  );
}
