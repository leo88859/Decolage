"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Boutique, Categorie, Produit } from "@/lib/boutique/types";
import { api, isPlanLimit } from "./logic";

type State =
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "ready"; boutique: Boutique | null; categories: Categorie[]; produits: Produit[] };

type Ctx = { state: State; reload: () => Promise<void> };
const BoutiqueCtx = createContext<Ctx | null>(null);

export function useBoutiqueCtx(): Ctx {
  const c = useContext(BoutiqueCtx);
  if (!c) throw new Error("useBoutiqueCtx hors du provider");
  return c;
}

/** Charge la boutique du commerçant depuis l'API (aucune donnée locale). */
export function BoutiqueProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const reload = useCallback(async () => {
    const list = await api<{ boutiques: Boutique[] }>("");
    if (!list.ok) return setState({ status: "error", code: list.code, message: list.message });
    const b = list.data.boutiques[0];
    if (!b) return setState({ status: "ready", boutique: null, categories: [], produits: [] });
    const det = await api<{ boutique: Boutique; categories: Categorie[]; produits: Produit[] }>(`/${b.id}`);
    if (!det.ok) return setState({ status: "error", code: det.code, message: det.message });
    setState({ status: "ready", boutique: det.data.boutique, categories: det.data.categories, produits: det.data.produits });
  }, []);

  useEffect(() => {
    // Chargement initial depuis l'API (setState après réponse asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return <BoutiqueCtx.Provider value={{ state, reload }}>{children}</BoutiqueCtx.Provider>;
}

export function ErrorBox({ code, message, onRetry }: { code?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-bad" role="alert">
      <p style={{ margin: 0 }}><strong>{message}</strong></p>
      <div className="row" style={{ marginTop: 10 }}>
        {code === "auth" && <Link href="/connexion?next=/boutique" className="btn btn-sm btn-dark">Me connecter</Link>}
        {code && isPlanLimit(code) && <Link href="/parametres" className="btn btn-sm btn-coral">Voir les formules</Link>}
        {onRetry && code !== "auth" && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Réessayer</button>}
      </div>
    </div>
  );
}

/** Garde commune : chargement, erreur, ou pas de boutique. Rend les enfants quand une boutique existe. */
export function WithBoutique({ children }: { children: (b: { boutique: Boutique; categories: Categorie[]; produits: Produit[]; reload: () => Promise<void> }) => React.ReactNode }) {
  const { state, reload } = useBoutiqueCtx();
  if (state.status === "loading") return <div className="skeleton" style={{ height: 220 }} aria-busy="true" aria-label="Chargement" />;
  if (state.status === "error") return <ErrorBox code={state.code} message={state.message} onRetry={() => void reload()} />;
  if (!state.boutique) {
    return (
      <div className="empty">
        <h2 className="h-sec">Crée d&apos;abord ta boutique</h2>
        <p className="mut">Il faut une boutique avant d&apos;ajouter des produits ou de recevoir des commandes.</p>
        <Link href="/boutique" className="btn btn-dark">Créer ma boutique</Link>
      </div>
    );
  }
  return <>{children({ boutique: state.boutique, categories: state.categories, produits: state.produits, reload })}</>;
}
