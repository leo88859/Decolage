"use client";

import { useEffect } from "react";
import { useData } from "@/lib/store";

/** Applique les préférences d'affichage (Paramètres) à toute la page. */
export function PrefsApply() {
  const { prefs } = useData();
  useEffect(() => {
    const d = document.documentElement.dataset;
    d.motion = prefs?.motion === "reduite" ? "reduite" : "auto";
    d.densite = prefs?.densite === "compacte" ? "compacte" : "confort";
  }, [prefs?.motion, prefs?.densite]);
  return null;
}
