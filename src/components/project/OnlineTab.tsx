"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFeatures } from "@/components/CloudSync";
import { Confirm, CopyButton, download, toast } from "@/components/ui";
import { useCloud } from "@/lib/cloud";
import { waitlistCsv } from "@/lib/csv";
import { siteData, slugError, suggestSlug } from "@/lib/publish";
import { getBrowserClient } from "@/lib/supabase/browser";
import { PLANS, prixCourt } from "@/lib/plans";
import { updateProject, useData } from "@/lib/store";
import type { Project } from "@/lib/types";

type Site = { slug: string; published_at: string; updated_at: string } | null;
type Entry = { id: number; email: string; created_at: string };

const fetchSite = (projectId: string): Promise<Site> =>
  fetch(`/api/sites?projectId=${projectId}`).then((x) => x.json()).then((r) => r.site ?? null, () => null);

async function fetchWaitlist(slug: string): Promise<Entry[] | null> {
  const sb = getBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb.from("waitlist").select("id, email, created_at").eq("slug", slug).order("created_at", { ascending: false }).limit(1000);
  return error ? null : (data as Entry[]);
}

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OnlineTab({ project: p }: { project: Project }) {
  const { cloud, loaded } = useFeatures();
  const { session, ready, serverPlan } = useCloud();
  const local = useData().plan;
  const plan = serverPlan ?? local;

  if (!loaded || !ready) return <div className="skeleton" style={{ height: 220 }} />;
  if (!cloud) {
    return (
      <div className="empty">
        <h2 className="h-sec">La mise en ligne n&apos;est pas encore activée</h2>
        <p className="mut" style={{ margin: "8px auto 0", maxWidth: 560 }}>
          Pour publier des SaaS et récolter de vrais inscrits, l&apos;administrateur de Décollage doit d&apos;abord brancher Supabase. Les étapes sont détaillées dans <b>docs/MISE-EN-LIGNE.md</b>.
        </p>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="empty">
        <h2 className="h-sec">Connecte-toi pour publier ton SaaS</h2>
        <p className="mut" style={{ margin: "8px 0 18px" }}>Ta page de vente aura sa propre adresse, et les inscriptions à ta liste d&apos;attente seront enregistrées.</p>
        <Link href={`/connexion?next=${encodeURIComponent(`/projets/${p.id}?onglet=enligne`)}`} className="btn">Se connecter</Link>
      </div>
    );
  }
  if (PLANS[plan].maxSites === 0) {
    return (
      <div className="empty">
        <h2 className="h-sec">Mets ton SaaS en ligne dès {prixCourt("solo")} par mois</h2>
        <p className="mut" style={{ margin: "8px auto 18px", maxWidth: 540 }}>
          La formule gratuite permet de créer et d&apos;essayer ton projet. Avec une offre payante, il obtient son adresse publique et une vraie liste d&apos;attente, et tu débloques toutes les fonctions.
        </p>
        <Link href="/parametres#formule" className="btn btn-coral">Voir les offres</Link>
      </div>
    );
  }
  return <Publish p={p} />;
}

function Publish({ p }: { p: Project }) {
  const [site, setSite] = useState<Site | undefined>(undefined);
  const [slug, setSlug] = useState(suggestSlug(p.config.nom));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const apply = useCallback((s: Site) => { setSite(s); if (s) setSlug(s.slug); }, []);
  const refresh = useCallback(() => fetchSite(p.id).then(apply), [p.id, apply]);
  useEffect(() => {
    let alive = true;
    fetchSite(p.id).then((s) => { if (alive) apply(s); });
    return () => { alive = false; };
  }, [p.id, apply]);

  async function publish() {
    const err = slugError(slug);
    if (err) return setError(err);
    setBusy(true);
    setError("");
    const r = await fetch("/api/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: p.id, slug, data: siteData(p) }) });
    const body = await r.json().catch(() => ({ error: "Réponse illisible." }));
    setBusy(false);
    if (!r.ok) return setError(body.error ?? "Publication impossible.");
    toast(site ? "Site mis à jour" : "Ton SaaS est en ligne 🎉");
    updateProject(p.id, (x) => x, site ? "En ligne : site mis à jour" : "En ligne : site publié");
    await refresh();
  }

  async function unpublish() {
    const r = await fetch(`/api/sites?projectId=${p.id}`, { method: "DELETE" });
    if (!r.ok) return toast("Impossible de dépublier", "error");
    toast("Site dépublié");
    updateProject(p.id, (x) => x, "En ligne : site dépublié");
    setSite(null);
  }

  if (site === undefined) return <div className="skeleton" style={{ height: 220 }} />;
  const url = site ? `${origin}/s/${site.slug}` : `${origin}/s/${slug || "…"}`;
  const outdated = site && p.updatedAt > site.updated_at;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className={`panel on-card ${site ? "live" : ""}`}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <span className={`badge ${site ? "badge-ok" : "badge-line"}`}>{site ? "● En ligne" : "Pas encore publié"}</span>
            <h2 className="h-sec" style={{ margin: "10px 0 6px" }}>{site ? "Ton SaaS est en ligne" : "Publier ton SaaS"}</h2>
            <p className="mut small">{site ? `Publié le ${fmt(site.published_at)} · dernière mise à jour ${fmt(site.updated_at)}` : "Ta page de vente et la démo de ton application auront une adresse publique, à partager partout."}</p>
          </div>
          {site && <a className="btn" href={`/s/${site.slug}`} target="_blank" rel="noreferrer">Ouvrir le site ↗</a>}
        </div>

        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="slug">Adresse de ton site</label>
          <div className="on-url">
            <span className="mut">{origin}/s/</span>
            <input id="slug" value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} aria-invalid={!!slugError(slug)} />
          </div>
          <span className="hint">Lettres minuscules, chiffres et tirets. Un nom de domaine personnalisé (ex. monsaas.fr) se branche à l&apos;étape « Mise en production ».</span>
        </div>
        {error && <div className="alert alert-bad" style={{ marginTop: 12 }} role="alert">{error}</div>}
        {outdated && <div className="alert alert-warn" style={{ marginTop: 12 }}>Tu as modifié ton projet depuis la dernière publication : mets le site à jour pour que les visiteurs voient la nouvelle version.</div>}

        <div className="row" style={{ marginTop: 16 }}>
          <button className={`btn ${site ? "" : "btn-coral btn-lg"}`} onClick={publish} disabled={busy}>{busy ? "Publication…" : site ? "Mettre à jour le site" : "Publier mon SaaS"}</button>
          {site && <CopyButton text={url} label="Copier le lien" />}
          {site && <a className="btn btn-ghost btn-sm" href={`/s/${site.slug}/app`} target="_blank" rel="noreferrer">Démo de l&apos;application ↗</a>}
          {site && <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>Dépublier</button>}
        </div>
      </section>

      {site && <Waitlist slug={site.slug} name={p.config.nom} />}

      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={unpublish} danger cta="Dépublier"
        title="Dépublier ce site ?" text="L'adresse ne fonctionnera plus et la liste des inscrits sera supprimée. Exporte-la d'abord si tu veux la garder." />
      <style>{`
        .on-card.live{border-color:rgba(19,138,90,.35);box-shadow:0 0 0 4px rgba(19,138,90,.08),var(--shadow)}
        .on-url{display:flex;align-items:center;border:1.5px solid var(--line-2);border-radius:12px;background:#fff;padding-left:12px;overflow:hidden}
        .on-url:focus-within{border-color:var(--blue);box-shadow:0 0 0 4px rgba(47,91,255,.15)}
        .on-url span{white-space:nowrap;font-size:14px;overflow:hidden;text-overflow:ellipsis;max-width:55%}
        .on-url input{flex:1;min-width:80px;border:0;outline:0;padding:11px 12px 11px 2px;font:600 15px var(--body);background:none}
      `}</style>
    </div>
  );
}

function Waitlist({ slug, name }: { slug: string; name: string }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");

  const [week, setWeek] = useState(0);
  const apply = useCallback((r: Entry[] | null) => {
    if (!r) return setError("Impossible de charger les inscrits.");
    const now = Date.now();
    setRows(r);
    setWeek(r.filter((x) => now - new Date(x.created_at).getTime() < 7 * 86400_000).length);
    setError("");
  }, []);
  const load = useCallback(() => fetchWaitlist(slug).then(apply), [slug, apply]);
  useEffect(() => {
    let alive = true;
    fetchWaitlist(slug).then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [slug, apply]);

  async function remove(id: number) {
    const sb = getBrowserClient();
    if (!sb) return;
    const { error: e } = await sb.from("waitlist").delete().eq("id", id);
    if (e) return toast("Suppression impossible", "error");
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
    toast("Inscrit supprimé");
  }

  return (
    <section className="panel">
      <div className="row between">
        <h2 className="h-sec">Liste d&apos;attente</h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Actualiser</button>
          <button className="btn btn-sm" disabled={!rows?.length} onClick={() => download(`inscrits-${slug}.csv`, waitlistCsv(rows ?? []), "text/csv")}>Exporter CSV</button>
        </div>
      </div>
      {error && <div className="alert alert-bad" style={{ marginTop: 12 }}>{error}</div>}
      {rows === null ? <div className="skeleton" style={{ height: 120, marginTop: 14 }} /> : (
        <>
          <div className="row" style={{ gap: 28, margin: "16px 0" }}>
            <div><span className="tiny mut">Inscrits</span><div style={{ font: "600 40px var(--display)" }}>{rows.length}</div></div>
            <div><span className="tiny mut">7 derniers jours</span><div style={{ font: "600 40px var(--display)", color: "var(--ok)" }}>+{week}</div></div>
          </div>
          {rows.length === 0 ? (
            <p className="mut small">Personne pour l&apos;instant. Partage le lien de ton site sur tes réseaux : chaque inscription apparaîtra ici. Le plan de lancement de « {name} » t&apos;aide à trouver tes 20 premiers inscrits.</p>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Email</th><th>Inscrit le</th><th /></tr></thead>
                <tbody>{rows.slice(0, 200).map((r) => <tr key={r.id}><td>{r.email}</td><td className="mut">{fmt(r.created_at)}</td><td style={{ textAlign: "right" }}><button className="btn btn-danger btn-sm" onClick={() => void remove(r.id)} aria-label={`Supprimer ${r.email}`}>✕</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="tiny mut" style={{ marginTop: 12 }}>Ces adresses sont des données personnelles : utilise-les seulement pour prévenir du lancement, et supprime celles qui le demandent.</p>
        </>
      )}
    </section>
  );
}
