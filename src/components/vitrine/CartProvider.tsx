"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { addLigne, newCle, parseCart, removeLigne, setQuantite, type CataloguePub, type Ligne } from "./logic";

type Ctx = {
  catalogue: CataloguePub;
  lignes: Ligne[];
  /** Clé d'idempotence du panier courant ; change à chaque modification du panier. */
  cle: string | null;
  pret: boolean;
  ajouter: (varianteId: string, qte?: number) => void;
  fixer: (varianteId: string, qte: number) => void;
  retirer: (varianteId: string) => void;
  vider: () => void;
  /** Garde la clé (nouvel essai) : à appeler avant d'envoyer une commande. */
  assurerCle: () => string;
};

const C = createContext<Ctx | null>(null);
export const useVitrine = () => {
  const v = useContext(C);
  if (!v) throw new Error("useVitrine hors du fournisseur de la vitrine");
  return v;
};

// Stockage navigateur : seulement le panier (variante_id + quantité) et la clé d'idempotence. Jamais de prix ni de coordonnées.
const keyOf = (slug: string) => `decollage-vitrine:${slug}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  window.addEventListener("storage", f);
  return () => { listeners.delete(f); window.removeEventListener("storage", f); };
};
function lire(slug: string): { lignes: Ligne[]; cle: string | null } {
  try {
    const raw = window.localStorage.getItem(keyOf(slug));
    if (!raw) return { lignes: [], cle: null };
    const o = JSON.parse(raw) as { lignes?: unknown; cle?: unknown };
    return { lignes: parseCart(JSON.stringify(o.lignes ?? [])), cle: typeof o.cle === "string" && o.cle.length >= 16 && o.cle.length <= 64 ? o.cle : null };
  } catch {
    return { lignes: [], cle: null };
  }
}
function ecrire(slug: string, lignes: Ligne[], cle: string | null) {
  try {
    if (!lignes.length) window.localStorage.removeItem(keyOf(slug));
    else window.localStorage.setItem(keyOf(slug), JSON.stringify({ lignes, cle }));
  } catch {
    // Stockage refusé (navigation privée…) : le panier reste vide au rechargement, sans casser la page.
  }
  emit();
}

export function CartProvider({ catalogue, children }: { catalogue: CataloguePub; children: ReactNode }) {
  const slug = catalogue.boutique.slug;
  const raw = useSyncExternalStore(
    subscribe,
    () => { try { return window.localStorage.getItem(keyOf(slug)) ?? ""; } catch { return ""; } },
    () => null,
  );
  const pret = raw !== null;
  const etat = useMemo(() => (raw === null ? { lignes: [] as Ligne[], cle: null } : lire(slug)), [raw, slug]);

  const modifier = useCallback((f: (l: Ligne[]) => Ligne[]) => {
    const cur = lire(slug);
    ecrire(slug, f(cur.lignes), newCle());
  }, [slug]);

  const value: Ctx = {
    catalogue,
    lignes: etat.lignes,
    cle: etat.cle,
    pret,
    ajouter: (id, qte = 1) => modifier((l) => addLigne(l, id, qte)),
    fixer: (id, qte) => modifier((l) => setQuantite(l, id, qte)),
    retirer: (id) => modifier((l) => removeLigne(l, id)),
    vider: () => ecrire(slug, [], null),
    assurerCle: () => {
      const cur = lire(slug);
      if (cur.cle) return cur.cle;
      const cle = newCle();
      ecrire(slug, cur.lignes, cle);
      return cle;
    },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
