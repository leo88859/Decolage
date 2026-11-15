"use client";

import { useEffect, type RefObject } from "react";
import { validateBridgeMessage } from "@/lib/bridge";
import { getData, setAppData } from "@/lib/store";

/** Fournit les fenêtres des iframes d'aperçu réellement créées par la page (jamais une supposition). */
export type FrameWindows = RefObject<() => Array<Window | null>>;

/**
 * Relie l'application du projet (iframe isolé, sans accès au stockage) à la sauvegarde du projet :
 * elle demande ses données au démarrage, puis envoie chaque modification. Chaque message est vérifié
 * par src/lib/bridge.ts : fenêtre source attendue, origine, identifiant du projet, forme et taille des données.
 */
export function useAppDataBridge(projectId: string, frames: FrameWindows) {
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const r = validateBridgeMessage(
        { source: e.source, origin: e.origin, data: e.data },
        // Les aperçus sont des iframes `sandbox` sans allow-same-origin : origine « null » obligatoire,
        // acceptée uniquement parce que la fenêtre source est l'une de nos iframes.
        { projectId, expectedWindows: frames.current?.() ?? [], allowedOrigins: [window.location.origin], sandboxedFrames: true },
      );
      if (!r.ok) return;
      if (r.message.type === "hello") {
        const p = getData().projects.find((x) => x.id === projectId);
        (e.source as Window).postMessage({ decollageLoad: p?.appData ?? null, key: projectId }, "*");
      } else if (r.message.type === "data") {
        setAppData(projectId, r.message.data);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [projectId, frames]);
}
