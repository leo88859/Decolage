"use client";

import { useSyncExternalStore } from "react";
import { normalizePlan } from "@/lib/plans";
import { getData, onStoreChange, replaceAll } from "@/lib/store";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Plan, Project } from "@/lib/types";

// Session et synchronisation en ligne. Sans Supabase configuré, tout ceci reste inactif.

export type Session = { userId: string; email: string } | null;
export type CloudState = { ready: boolean; session: Session; syncing: boolean; error: string; serverPlan: Plan | null };

let state: CloudState = { ready: false, session: null, syncing: false, error: "", serverPlan: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<CloudState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const EMPTY_STATE: CloudState = state;

export const useCloud = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => EMPTY_STATE);
export const getCloud = () => state;

// Les données locales appartiennent à un compte précis : on ne mélange jamais les projets de deux comptes.
const OWNER_KEY = "decollage.owner";
const owner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
const setOwner = (id: string | null) => { try { if (id) localStorage.setItem(OWNER_KEY, id); else localStorage.removeItem(OWNER_KEY); } catch { /* stockage indisponible */ } };

const isProject = (x: unknown): x is Project => Boolean(x && typeof x === "object" && typeof (x as Project).id === "string" && (x as Project).config);

/** Fusion à la connexion : pour chaque projet, la version modifiée le plus récemment l'emporte. */
export function mergeProjects(local: Project[], remote: Project[]): { merged: Project[]; toPush: Project[] } {
  const byId = new Map<string, Project>(remote.map((p) => [p.id, p]));
  const toPush: Project[] = [];
  for (const p of local) {
    const r = byId.get(p.id);
    if (!r || p.updatedAt > r.updatedAt) {
      byId.set(p.id, p);
      toPush.push(p);
    }
  }
  const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { merged, toPush };
}

async function syncOnLogin(userId: string) {
  const sb = getBrowserClient();
  if (!sb) return;
  set({ syncing: true, error: "" });
  try {
    const [{ data: rows, error: e1 }, { data: profile, error: e2 }] = await Promise.all([
      sb.from("projects").select("data").eq("user_id", userId),
      sb.from("profiles").select("plan, favorites").eq("id", userId).maybeSingle(),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2)!.message);
    const remote = (rows ?? []).map((r) => r.data).filter(isProject);
    const local = getData();
    // Les projets locaux d'un autre compte ne sont jamais importés dans celui-ci.
    const mine = owner() === null || owner() === userId ? local.projects : [];
    const { merged, toPush } = mergeProjects(mine, remote);
    const favorites = [...new Set([...(profile?.favorites ?? []), ...(owner() === userId || owner() === null ? local.favorites : [])])];
    const plan = normalizePlan(profile?.plan);
    replaceAll({ projects: merged, favorites, plan });
    setOwner(userId);
    if (toPush.length) await pushProjects(userId, toPush);
    if (favorites.length !== (profile?.favorites ?? []).length) await sb.from("profiles").update({ favorites, updated_at: new Date().toISOString() }).eq("id", userId);
    set({ syncing: false, serverPlan: plan });
  } catch (e) {
    set({ syncing: false, error: `Synchronisation impossible : ${(e as Error).message}` });
  }
}

async function pushProjects(userId: string, projects: Project[]) {
  const sb = getBrowserClient();
  if (!sb || !projects.length) return;
  const { error } = await sb.from("projects").upsert(projects.map((p) => ({ user_id: userId, id: p.id, data: p, updated_at: p.updatedAt })), { onConflict: "user_id,id" });
  if (error) throw new Error(error.message);
}

// Envoi des modifications, regroupées pour ne pas écrire à chaque frappe.
const pending = new Map<string, Project>();
const removed = new Set<string>();
let pendingFavs: string[] | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const s = state.session;
  const sb = getBrowserClient();
  if (!s || !sb) return;
  const ups = [...pending.values()];
  const dels = [...removed];
  const favs = pendingFavs;
  pending.clear();
  removed.clear();
  pendingFavs = null;
  try {
    if (ups.length) await pushProjects(s.userId, ups);
    if (dels.length) {
      const { error } = await sb.from("projects").delete().eq("user_id", s.userId).in("id", dels);
      if (error) throw new Error(error.message);
    }
    if (favs) await sb.from("profiles").update({ favorites: favs, updated_at: new Date().toISOString() }).eq("id", s.userId);
    if (state.error) set({ error: "" });
  } catch (e) {
    // On remet en file pour la prochaine tentative.
    ups.forEach((p) => { if (!pending.has(p.id)) pending.set(p.id, p); });
    dels.forEach((id) => removed.add(id));
    if (favs && !pendingFavs) pendingFavs = favs;
    set({ error: `Sauvegarde en ligne impossible : ${(e as Error).message}` });
  }
}

/** À appeler une seule fois (composant CloudSync). Renvoie la fonction de nettoyage. */
export function startCloud(): () => void {
  const sb = getBrowserClient();
  if (!sb) {
    set({ ready: true });
    return () => {};
  }
  const offStore = onStoreChange((c) => {
    if (!state.session) return;
    c.upsert?.forEach((p) => { pending.set(p.id, p); removed.delete(p.id); });
    c.remove?.forEach((id) => { pending.delete(id); removed.add(id); });
    if (c.favorites) pendingFavs = c.favorites;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 700);
  });
  const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
    const next: Session = session?.user ? { userId: session.user.id, email: session.user.email ?? "" } : null;
    const changedUser = next?.userId !== state.session?.userId;
    set({ session: next, ready: true });
    if (next && changedUser) void syncOnLogin(next.userId);
    if (!next && event === "SIGNED_OUT") {
      // Déconnexion : on vide le cache pour que le compte suivant ne voie pas ces projets.
      replaceAll({ projects: [], favorites: [], plan: "gratuit" });
      setOwner(null);
      set({ serverPlan: null });
    }
  });
  const flushOnHide = () => { if (document.visibilityState === "hidden" && timer) { clearTimeout(timer); void flush(); } };
  document.addEventListener("visibilitychange", flushOnHide);
  return () => {
    offStore();
    sub.subscription.unsubscribe();
    document.removeEventListener("visibilitychange", flushOnHide);
  };
}

export async function signInWithEmail(email: string, next = "/tableau-de-bord"): Promise<string | null> {
  const sb = getBrowserClient();
  if (!sb) return "Les comptes ne sont pas encore activés sur ce site.";
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  return error ? error.message : null;
}

export async function signOut() {
  if (timer) { clearTimeout(timer); await flush(); }
  await getBrowserClient()?.auth.signOut();
}

/** Relit la formule depuis le serveur (après un paiement). */
export async function refreshPlan() {
  const sb = getBrowserClient();
  const s = state.session;
  if (!sb || !s) return;
  const { data } = await sb.from("profiles").select("plan").eq("id", s.userId).maybeSingle();
  if (data?.plan) {
    const plan = normalizePlan(data.plan);
    replaceAll({ ...getData(), plan });
    set({ serverPlan: plan });
  }
}
