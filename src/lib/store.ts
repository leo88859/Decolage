"use client";

import { useSyncExternalStore } from "react";
import { IDEA_BY_ID } from "@/data/ideas";
import { canCreateProject, normalizePlan, PLANS } from "@/lib/plans";
import { duplicateProject, newId, newProject, newProjectFromIdee } from "@/lib/project";
import type { AppData, AppState, Plan, Project, TemplateId } from "@/lib/types";

// Cache local (navigateur). Sans compte, c'est le seul stockage. Avec un compte, chaque
// modification est aussi envoyée en ligne par CloudSync (voir lib/cloud.ts).
const KEY = "decollage.data.v2";
const EMPTY: AppData = { version: 2, projects: [], favorites: [], plan: "gratuit" };
const listeners = new Set<() => void>();
let cache: AppData | null = null;
let storageError = false;

/** Ce qui a changé lors d'une écriture, pour la synchronisation en ligne. */
export type Change = { upsert?: Project[]; remove?: string[]; favorites?: string[] };
const changeListeners = new Set<(c: Change) => void>();
export function onStoreChange(fn: (c: Change) => void) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function read(): AppData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AppData) : null;
    cache = parsed?.version === 2 ? { ...EMPTY, ...parsed, plan: normalizePlan(parsed.plan) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: AppData, change?: Change) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    storageError = false;
  } catch {
    storageError = true; // stockage plein ou bloqué : les données restent en mémoire pour cette session
  }
  listeners.forEach((l) => l());
  if (change) changeListeners.forEach((l) => l(change));
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export const useData = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);
export const hasStorageError = () => storageError;

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/** Message affiché quand la formule ne permet pas de créer un projet de plus. */
export function limitMessage(plan: Plan): string {
  if (PLANS[plan].maxProjets === 0) return `Pour générer ton SaaS, choisis une offre (dès ${PLANS.solo.prix.toLocaleString("fr-FR")} €/mois) dans Paramètres.`;
  const n = PLANS[plan].maxProjets;
  return `Ta formule ${PLANS[plan].nom} permet ${n} projet${n > 1 ? "s" : ""}. Supprime un projet ou choisis une offre supérieure.`;
}

export function createProject(templateId: TemplateId, ideaId?: string): CreateResult {
  const d = read();
  if (!canCreateProject(d.plan, d.projects.length)) return { ok: false, error: limitMessage(d.plan) };
  const p = newProject(templateId, ideaId ? IDEA_BY_ID[ideaId] : undefined);
  write({ ...d, projects: [p, ...d.projects] }, { upsert: [p] });
  return { ok: true, id: p.id };
}

export function createProjectFromIdee(input: Parameters<typeof newProjectFromIdee>[0]): CreateResult {
  const d = read();
  if (!canCreateProject(d.plan, d.projects.length)) return { ok: false, error: limitMessage(d.plan) };
  const p = newProjectFromIdee(input);
  write({ ...d, projects: [p, ...d.projects] }, { upsert: [p] });
  return { ok: true, id: p.id };
}

export function updateProject(id: string, patch: (p: Project) => Project, activity?: string) {
  const d = read();
  const now = new Date().toISOString();
  let changed: Project | null = null;
  const projects = d.projects.map((p) => {
    if (p.id !== id) return p;
    const next = patch(p);
    const last = next.activity[0];
    // Une même action répétée ne remplit pas l'historique.
    const log = activity && last?.label !== activity ? [{ date: now, label: activity }, ...next.activity].slice(0, 30) : next.activity;
    changed = { ...next, updatedAt: now, activity: log };
    return changed;
  });
  write({ ...d, projects }, changed ? { upsert: [changed] } : undefined);
}

export function duplicate(id: string): CreateResult {
  const d = read();
  const p = d.projects.find((x) => x.id === id);
  if (!p) return { ok: false, error: "Projet introuvable." };
  if (!canCreateProject(d.plan, d.projects.length)) return { ok: false, error: limitMessage(d.plan) };
  const copy = duplicateProject(p);
  write({ ...d, projects: [copy, ...d.projects] }, { upsert: [copy] });
  return { ok: true, id: copy.id };
}

export function deleteProject(id: string) {
  const d = read();
  write({ ...d, projects: d.projects.filter((p) => p.id !== id) }, { remove: [id] });
}

export function importProjects(projects: Project[], favorites: string[]): number {
  const d = read();
  const ids = new Set(d.projects.map((p) => p.id));
  const incoming = projects.map((p) => (ids.has(p.id) ? { ...p, id: newId() } : p));
  const favs = [...new Set([...d.favorites, ...favorites])];
  write({ ...d, projects: [...incoming, ...d.projects], favorites: favs }, { upsert: incoming, favorites: favs });
  return incoming.length;
}

export function toggleFavorite(ideaId: string) {
  const d = read();
  const favorites = d.favorites.includes(ideaId) ? d.favorites.filter((f) => f !== ideaId) : [...d.favorites, ideaId];
  write({ ...d, favorites }, { favorites });
}

/** Formule locale (mode test sans paiement). Avec un compte, la formule vient du serveur. */
export function setPlan(plan: Plan) {
  write({ ...read(), plan });
}

/** Remplace tout le cache (après synchronisation avec le compte). N'émet pas de changement. */
export function replaceAll(next: Omit<AppData, "version">) {
  // Les réglages propres à ce navigateur (favoris de designs, guides, préférences) sont conservés.
  const { designFavs, parcours, prefs } = read();
  write({ designFavs, parcours, prefs, version: 2, ...next });
}

/** Données saisies dans l'application d'un projet (null = revenir aux données d'exemple). */
export function setAppData(id: string, appData: AppState | null) {
  updateProject(id, (p) => {
    const { appData: _old, ...rest } = p;
    void _old;
    return appData ? { ...rest, appData } : rest;
  });
}

export function toggleDesignFav(id: string) {
  const d = read();
  const cur = d.designFavs ?? [];
  write({ ...d, designFavs: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
}

/** Coche ou décoche une étape d'un guide : dans le projet choisi, sinon dans ce navigateur. */
export function setParcours(key: string, done: boolean, projectId?: string) {
  if (projectId) {
    updateProject(projectId, (p) => ({ ...p, guide: { ...p.guide, [key]: done } }), done ? "Apprendre : étape cochée" : undefined);
    return;
  }
  const d = read();
  write({ ...d, parcours: { ...d.parcours, [key]: done } });
}

export function setPrefs(patch: Partial<NonNullable<AppData["prefs"]>>) {
  const d = read();
  write({ ...d, prefs: { ...d.prefs, ...patch } });
}

export function resetAll() {
  const d = read();
  write(EMPTY, { remove: d.projects.map((p) => p.id), favorites: [] });
}

export const getData = read;
