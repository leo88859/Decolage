"use client";

import { useEffect } from "react";
import { cleanAppData } from "@/lib/appdata";
import { getData, setAppData } from "@/lib/store";

/**
 * Relie l'application du projet (iframe isolé, sans accès au stockage) à la sauvegarde du projet :
 * elle demande ses données au démarrage, puis envoie chaque modification. Les messages sont vérifiés
 * (origine « null » des iframes isolés, identifiant du projet, forme des données).
 */
export function useAppDataBridge(projectId: string) {
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "null") return;
      const d = e.data as { key?: unknown; decollageHello?: unknown; decollageData?: unknown } | null;
      if (!d || typeof d !== "object" || d.key !== projectId) return;
      if (d.decollageHello) {
        const p = getData().projects.find((x) => x.id === projectId);
        (e.source as Window | null)?.postMessage({ decollageLoad: p?.appData ?? null, key: projectId }, "*");
      }
      if ("decollageData" in d) {
        const clean = cleanAppData(d.decollageData);
        if (clean) setAppData(projectId, clean);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [projectId]);
}
