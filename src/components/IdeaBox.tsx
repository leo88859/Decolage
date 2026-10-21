"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXEMPLES = ["Réservation pour un coiffeur", "Boutique de bougies faites main", "Cours de guitare en ligne", "Devis pour artisans"];

export function IdeaBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  const go = (q: string) => router.push(`/creer?q=${encodeURIComponent(q)}`);

  return (
    <div className="ib-wrap">
      <form className="ib-box" onSubmit={(e) => { e.preventDefault(); if (text.trim()) go(text.trim()); }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) go(text.trim()); } }}
          maxLength={400}
          rows={2}
          placeholder="Décris ton idée de SaaS… ex. : une appli pour que les clients d'un coiffeur réservent en ligne"
          aria-label="Décris ton idée de SaaS"
        />
        <button className="btn btn-coral btn-lg" disabled={!text.trim()}>Voir mon SaaS <span className="arrow">→</span></button>
      </form>
      <div className="ib-ex">
        <span>Exemples :</span>
        {EXEMPLES.map((e) => <button key={e} type="button" onClick={() => go(e)}>{e}</button>)}
      </div>
    </div>
  );
}
