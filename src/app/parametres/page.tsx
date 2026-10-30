"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CheckoutDialog, type PurchaseConsent } from "@/components/CheckoutDialog";
import { useFeatures } from "@/components/CloudSync";
import { ManageCookiesButton } from "@/components/ConsentManager";
import { LEGAL_PAGES } from "@/data/legal";
import { OfferCards } from "@/components/OfferCards";
import { Confirm, download, toast } from "@/components/ui";
import { refreshPlan, signOut, useCloud } from "@/lib/cloud";
import { dataJson, parseImport } from "@/lib/export";
import { PLANS, type PaidPlan } from "@/lib/plans";
import { getData, hasStorageError, importProjects, resetAll, setPlan, setPrefs, useData, useHydrated } from "@/lib/store";

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Parametres />
    </Suspense>
  );
}

async function post(url: string, method = "POST", body?: object) {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const res = await r.json().catch(() => ({}));
  return { ok: r.ok, ...res } as { ok: boolean; url?: string; error?: string };
}

function Parametres() {
  const data = useData();
  const hydrated = useHydrated();
  const { session, serverPlan } = useCloud();
  const { cloud, payments, loaded } = useFeatures();
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"local" | "compte" | null>(null);
  const [busy, setBusy] = useState(false);
  const [buy, setBuy] = useState<PaidPlan | null>(null);
  const [buyError, setBuyError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const paiement = params.get("paiement");
  // Retour vers l'idée en cours après le choix d'une offre (chemin interne uniquement).
  const retourRaw = params.get("retour") ?? "";
  const retour = /^\/creer(\?|$)/.test(retourRaw) ? retourRaw : "";

  // Retour de Stripe : le webhook peut mettre quelques secondes, on relit la formule plusieurs fois.
  useEffect(() => {
    if (paiement !== "ok" || !session) return;
    let n = 0;
    const id = setInterval(() => { n++; void refreshPlan(); if (n >= 6) clearInterval(id); }, 2000);
    return () => clearInterval(id);
  }, [paiement, session]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5_000_000) return setError("Fichier trop volumineux (5 Mo maximum).");
    const r = parseImport(await f.text());
    if (!r.ok) return setError(r.error);
    const room = PLANS[data.plan].maxProjets - data.projects.length;
    if (r.projects.length > room) return setError(`Cet import contient ${r.projects.length} projet(s), mais ta formule n'en permet plus que ${Math.max(0, room)}.`);
    setError("");
    const n = importProjects(r.projects, r.favorites);
    toast(`${n} projet${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}`);
  }

  async function go(url: string, body?: object) {
    setBusy(true);
    const r = await post(url, "POST", body);
    setBusy(false);
    if (r.url) window.location.assign(r.url);
    else toast(r.error ?? "Action impossible", "error");
  }

  // Commande : le serveur refuse sans les confirmations et en garde la preuve avant d'ouvrir Stripe.
  // Aucune confirmation n'est affichée tant que Stripe n'a pas renvoyé l'adresse de paiement.
  async function checkout(consent: PurchaseConsent) {
    if (!buy) return;
    setBusy(true);
    setBuyError("");
    const r = await post("/api/stripe/checkout", "POST", { plan: buy, ...consent, ...(retour ? { retour } : {}) });
    if (r.url) { window.location.assign(r.url); return; }
    setBusy(false);
    setBuyError(r.error ?? "Paiement indisponible pour le moment. Aucun montant n'a été débité.");
  }

  async function deleteAccount() {
    const r = await post("/api/account", "DELETE");
    // Échec (par ex. résiliation de l'abonnement impossible) : le compte n'est PAS supprimé, on le dit clairement.
    if (!r.ok) return setDeleteError(r.error ?? "Suppression impossible pour le moment. Ton compte n'a pas été supprimé.");
    setDeleteError("");
    await signOut();
    toast("Compte supprimé");
    router.push("/");
  }

  if (!hydrated || !loaded) return <main className="page"><div className="container narrow"><div className="skeleton" style={{ height: 300 }} /></div></main>;
  const plan = session ? (serverPlan ?? data.plan) : data.plan;

  return (
    <main className="page">
      <div className="container stack" style={{ gap: 20, maxWidth: 1040 }}>
        <div>
          <span className="eyebrow">Paramètres</span>
          <h1 className="h-page" style={{ marginTop: 10 }}>Compte, préférences et données</h1>
          <nav className="pr-nav" aria-label="Sections">
            {[["Compte", "#compte"], ["Préférences", "#preferences"], ["Formule", "#formule"], ["Données", "#donnees"], ["Confidentialité et conditions", "#confidentialite"], ["Zone sensible", "#sensible"], ["Marque blanche", "/parametres/marque-blanche"]].map(([l, h]) => <a key={h} href={h} className="chip">{l}</a>)}
          </nav>
        </div>
        {hasStorageError() && <div className="alert alert-bad">Le navigateur refuse d&apos;enregistrer les données (stockage plein ou bloqué). Exporte tes projets pour ne pas les perdre.</div>}
        {paiement === "ok" && <div className="alert alert-ok">Merci ! Ton paiement est confirmé. Ta formule s&apos;active dans quelques secondes{plan !== "gratuit" ? ` : ${PLANS[plan].nom} est active ✓` : "…"}</div>}
        {retour && plan !== "gratuit" && (
          <div className="alert alert-ok row between">
            <span>Ta formule {PLANS[plan].nom} est active : tu peux générer ton SaaS.</span>
            <Link href={retour} className="btn btn-coral btn-sm">Revenir à mon SaaS →</Link>
          </div>
        )}
        {retour && plan === "gratuit" && <div className="alert alert-info">Choisis une offre ci-dessous : tu reviendras ensuite directement à ton SaaS, ton idée est gardée.</div>}
        {paiement === "annule" && <div className="alert alert-warn">Paiement annulé : rien n&apos;a été débité.</div>}

        <section className="panel stack" style={{ gap: 12 }} id="compte">
          <h2 className="h-sec">Compte</h2>
          {!cloud ? (
            <p className="mut small">Les comptes ne sont pas encore activés sur ce site (Supabase non configuré). Tes projets sont enregistrés dans ce navigateur.</p>
          ) : session ? (
            <div className="row between">
              <div><b>{session.email}</b><p className="mut small">Tes projets sont sauvegardés en ligne et synchronisés sur tes appareils.</p></div>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); toast("Déconnecté·e"); }}>Se déconnecter</button>
            </div>
          ) : (
            <div className="row between">
              <p className="mut small" style={{ maxWidth: 460 }}>Connecte-toi pour retrouver tes projets partout, publier tes SaaS en ligne et récolter de vrais inscrits.</p>
              <Link href="/connexion?next=/parametres" className="btn btn-sm">Se connecter</Link>
            </div>
          )}
        </section>

        <section className="panel stack" style={{ gap: 14 }} id="preferences">
          <h2 className="h-sec">Préférences et apparence</h2>
          <div className="pr-row">
            <div><b>Animations</b><p className="mut small">« Réduites » coupe les apparitions et les transitions sur tout le site. Le réglage de ton appareil est toujours respecté.</p></div>
            <div className="seg" role="group" aria-label="Animations">
              <button aria-pressed={(data.prefs?.motion ?? "auto") === "auto"} onClick={() => { setPrefs({ motion: "auto" }); toast("Animations : automatiques"); }}>Automatiques</button>
              <button aria-pressed={data.prefs?.motion === "reduite"} onClick={() => { setPrefs({ motion: "reduite" }); toast("Animations : réduites"); }}>Réduites</button>
            </div>
          </div>
          <div className="pr-row">
            <div><b>Densité</b><p className="mut small">« Compacte » réduit les espacements pour voir plus de choses à l&apos;écran.</p></div>
            <div className="seg" role="group" aria-label="Densité">
              <button aria-pressed={(data.prefs?.densite ?? "confort") === "confort"} onClick={() => { setPrefs({ densite: "confort" }); toast("Densité : confortable"); }}>Confortable</button>
              <button aria-pressed={data.prefs?.densite === "compacte"} onClick={() => { setPrefs({ densite: "compacte" }); toast("Densité : compacte"); }}>Compacte</button>
            </div>
          </div>
          <p className="hint">Préférences enregistrées dans ce navigateur.</p>
        </section>

        <section className="panel stack" style={{ gap: 16 }} id="formule">
          <div className="row between"><h2 className="h-sec">Formule</h2><span className={`badge ${plan !== "gratuit" ? "badge-coral" : "badge-line"}`}>{PLANS[plan].nom}</span></div>
          {!payments && !session && <div className="alert alert-warn">Mode test : aucun paiement n&apos;est actif. Tu peux activer n&apos;importe quelle formule gratuitement dans ce navigateur pour l&apos;essayer.</div>}
          {!payments && session && <p className="hint">Le paiement n&apos;est pas encore activé sur ce site : ta formule est gérée par l&apos;administrateur.</p>}
          <OfferCards current={plan} cta={(k) => {
            if (!payments) {
              if (session) return <button className="btn btn-ghost" disabled>{k === plan ? "Ta formule" : "Bientôt disponible"}</button>;
              return <button className={`btn ${k === plan ? "" : "btn-ghost"}`} onClick={() => { setPlan(k); toast(`Formule ${PLANS[k].nom} activée (test)`); if (retour && k !== "gratuit") router.push(retour); }}>{k === plan ? "Active (test)" : `Tester ${PLANS[k].nom}`}</button>;
            }
            if (!session) return k === "gratuit" ? null : <Link href="/connexion?next=/parametres%23formule" className="btn">Se connecter pour choisir</Link>;
            if (plan === "gratuit") return k === "gratuit" ? <button className="btn btn-ghost" disabled>Ta formule</button> : <button className={`btn ${k === "pro" ? "btn-coral" : ""}`} disabled={busy} onClick={() => { setBuyError(""); setBuy(k); }}>{`Choisir ${PLANS[k].nom}`}</button>;
            // Déjà abonné : changement d'offre et résiliation dans le portail Stripe (prorata calculé par Stripe).
            if (k === plan) return <button className="btn" disabled={busy} onClick={() => go("/api/stripe/portal")}>Gérer mon abonnement</button>;
            return <button className="btn btn-ghost" disabled={busy} onClick={() => go("/api/stripe/portal")}>{k === "gratuit" ? "Résilier" : "Changer pour celle-ci"}</button>;
          }} />
          {payments && <p className="tiny mut">Paiement sécurisé par Stripe. Sans engagement : tu changes d&apos;offre ou tu résilies en ligne, à tout moment. Avant de commander, tu confirmes avoir lu les <Link href="/cgv" style={{ textDecoration: "underline" }}>conditions générales de vente</Link> et ta demande d&apos;accès immédiat (voir <Link href="/remboursement" style={{ textDecoration: "underline" }}>Remboursement</Link>).</p>}
        </section>

        <section className="panel stack" style={{ gap: 14 }} id="donnees">
          <h2 className="h-sec">Tes données</h2>
          <p className="mut small">{session ? "Tes projets sont gardés dans ce navigateur et copiés en ligne sur ton compte." : "Tes projets sont enregistrés dans ce navigateur uniquement. Pour changer d'appareil, exporte puis importe — ou connecte-toi."}</p>
          <div className="row">
            <button className="btn" onClick={() => { download(`decollage-donnees-${new Date().toISOString().slice(0, 10)}.json`, dataJson(getData()), "application/json"); toast("Données exportées"); }}>Exporter toutes mes données</button>
            <button className="btn btn-ghost" onClick={() => file.current?.click()}>Importer un fichier</button>
            {session && <a className="btn btn-ghost" href="/api/account/export" download>Télécharger mes données</a>}
            <input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={onImport} aria-label="Fichier à importer" />
          </div>
          {error && <div className="alert alert-bad" role="alert">{error}</div>}
          {session && <p className="hint">« Télécharger mes données » : copie complète de ton compte en ligne (profil, projets, sites publiés, acceptations des conditions), sans tes identifiants de paiement.</p>}
          <p className="hint">Format : JSON « decollage-projet » ou « decollage-donnees », version 2 (voir docs/FORMAT.md). Chaque projet est vérifié avant import.</p>
        </section>

        <section className="panel stack" style={{ gap: 12 }} id="confidentialite">
          <h2 className="h-sec">Confidentialité et conditions</h2>
          <p className="mut small">Les textes qui encadrent le service et tes données personnelles. Tu peux aussi revoir ou changer ton choix sur les cookies à tout moment.</p>
          <div className="row">
            {LEGAL_PAGES.map((l) => <Link key={l.href} href={l.href} className="chip">{l.label}</Link>)}
            <ManageCookiesButton className="btn btn-ghost btn-sm" />
          </div>
        </section>

        <section className="panel stack" style={{ gap: 12, borderColor: "rgba(196,43,60,.25)" }} id="sensible">
          <h2 className="h-sec">Zone sensible</h2>
          {session ? (
            <>
              <p className="mut small">Supprime définitivement ton compte, tes projets, tes sites publiés, leurs listes d&apos;inscrits et tes preuves d&apos;acceptation. Ton abonnement éventuel est résilié immédiatement, sans remboursement automatique de la période en cours. Sont conservés : ton client et tes factures chez Stripe (obligation comptable), et les copies de sauvegarde de nos hébergeurs jusqu&apos;à leur renouvellement. Télécharge tes données avant si tu veux les garder.</p>
              {deleteError && <div className="alert alert-bad" role="alert">{deleteError}</div>}
              <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm("compte")}>Supprimer mon compte</button>
            </>
          ) : (
            <>
              <p className="mut small">Supprime tous les projets, favoris et réglages de ce navigateur.</p>
              <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm("local")} disabled={!data.projects.length && !data.favorites.length}>Tout effacer</button>
            </>
          )}
        </section>
      </div>
      <CheckoutDialog plan={buy} busy={busy} error={buyError} onClose={() => { if (!busy) setBuy(null); }} onConfirm={(c) => void checkout(c)} />
      <Confirm open={confirm === "local"} onClose={() => setConfirm(null)} onConfirm={() => { resetAll(); toast("Données effacées"); }} title="Tout effacer ?" text={`${data.projects.length} projet(s) et ${data.favorites.length} favori(s) seront supprimés définitivement de ce navigateur.`} cta="Tout effacer" danger />
      <Confirm open={confirm === "compte"} onClose={() => setConfirm(null)} onConfirm={() => void deleteAccount()} title="Supprimer ton compte ?" text="C'est définitif : projets, sites publiés et listes d'inscrits seront effacés, et ton abonnement éventuel sera résilié tout de suite. Ton client et tes factures restent chez Stripe (obligation comptable). Si la résiliation échoue, rien n'est supprimé." cta="Supprimer définitivement" danger />
    </main>
  );
}
