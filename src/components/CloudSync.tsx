"use client";

import { useEffect, useSyncExternalStore } from "react";
import { startCloud } from "@/lib/cloud";

/** Démarre la session et la synchronisation en ligne (sans effet si Supabase n'est pas configuré). */
export function CloudSync() {
  useEffect(() => startCloud(), []);
  return null;
}

// ─── Fonctions disponibles sur ce déploiement ───
type Features = { cloud: boolean; payments: boolean; loaded: boolean };
let features: Features = { cloud: false, payments: false, loaded: false };
const subs = new Set<() => void>();
let started = false;
const SERVER: Features = features;

function load() {
  if (started) return;
  started = true;
  fetch("/api/config")
    .then((r) => r.json())
    .then((f: { cloud: boolean; payments: boolean }) => { features = { ...f, loaded: true }; subs.forEach((l) => l()); })
    .catch(() => { features = { cloud: false, payments: false, loaded: true }; subs.forEach((l) => l()); });
}

export function useFeatures(): Features {
  return useSyncExternalStore((l) => { subs.add(l); load(); return () => subs.delete(l); }, () => features, () => SERVER);
}
