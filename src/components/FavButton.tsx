"use client";

import { toast } from "@/components/ui";
import { toggleFavorite, useData, useHydrated } from "@/lib/store";

export function FavButton({ id }: { id: string }) {
  const fav = useData().favorites.includes(id);
  const hydrated = useHydrated();
  return (
    <button
      className="btn btn-ghost btn-lg"
      aria-pressed={fav}
      disabled={!hydrated}
      onClick={() => { toggleFavorite(id); toast(fav ? "Retiré des favoris" : "Ajouté aux favoris"); }}
    >
      <span className={fav ? "fav-pop" : ""} style={{ color: fav ? "var(--coral)" : undefined, display: "inline-block" }}>{fav ? "♥" : "♡"}</span> {fav ? "Dans tes favoris" : "Ajouter aux favoris"}
    </button>
  );
}
