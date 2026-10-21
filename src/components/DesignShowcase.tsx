"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { DesignThumb, type IdeeInput } from "@/components/DesignThumb";
import { DESIGNS } from "@/data/designs";

const QUERY = "(prefers-reduced-motion: reduce)";
const useReducedMotion = () => useSyncExternalStore(
  (l) => { const mq = window.matchMedia(QUERY); mq.addEventListener("change", l); return () => mq.removeEventListener("change", l); },
  () => window.matchMedia(QUERY).matches,
  () => false,
);

const EXEMPLE: Omit<IdeeInput, "design"> = { idee: "Une appli pour que les clients d'un coiffeur réservent en ligne", type: "rendez-vous", secteur: "coiffure", nom: "RésaCoiff" };

/** Le même SaaS, présenté tour à tour dans chacun des 10 designs (vrais prototypes, pas des images). */
export function DesignShowcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const d = DESIGNS[i]!;

  useEffect(() => {
    if (paused || reduced) return;
    const id = setTimeout(() => setI((x) => (x + 1) % DESIGNS.length), 4200);
    return () => clearTimeout(id);
  }, [i, paused, reduced]);

  return (
    <div className="show" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="show-device">
        <div className="device-bar"><i /><i /><i /><span className="url">resacoiff.fr · design {d.nom}</span></div>
        <DesignThumb input={{ ...EXEMPLE, design: d.id }} width={1180} />
        {!paused && !reduced && <span key={i} className="show-timer" aria-hidden="true" />}
      </div>
      <div className="show-tabs" role="tablist" aria-label="Designs">
        {DESIGNS.map((x, k) => (
          <button key={x.id} role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => { setI(k); setPaused(true); }}>
            <span style={{ background: `linear-gradient(135deg, ${x.couleurs.primaire}, ${x.couleurs.accent})` }} />{x.nom}
          </button>
        ))}
      </div>
      <p className="show-cap">{d.description}</p>
    </div>
  );
}
