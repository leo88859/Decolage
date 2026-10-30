"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFeatures } from "@/components/CloudSync";
import { LogoMark } from "@/components/ui";
import { signInWithEmail, signOut, useCloud } from "@/lib/cloud";
import { clearPendingAcceptance, hasPendingAcceptance, rememberPendingAcceptance, saveSignupAcceptance } from "@/lib/legal-client";
import { safeNext } from "@/lib/safe-redirect";

export default function Page() {
  return (
    <Suspense fallback={<main className="page" />}>
      <Connexion />
    </Suspense>
  );
}

function Connexion() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const { session } = useCloud();
  const { cloud, loaded } = useFeatures();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(params.get("erreur") === "lien" ? "Ce lien de connexion a expiré ou a déjà été utilisé. Demande-en un nouveau." : "");

  // Acceptation des CGU et de la confidentialité (case non cochée par défaut).
  const [accepted, setAccepted] = useState(false);
  // Connecté : "verif" = on regarde si les conditions en vigueur sont acceptées, "a-accepter" = écran d'acceptation.
  const [gate, setGate] = useState<"verif" | "a-accepter">("verif");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const r = (await fetch("/api/legal/accept").then((x) => x.json()).catch(() => ({ accepted: null }))) as { accepted?: boolean | null };
      if (cancelled) return;
      // true = déjà accepté ; null = impossible à savoir (on ne bloque pas la connexion).
      if (r.accepted !== false) { clearPendingAcceptance(); router.replace(next); return; }
      // Case déjà cochée dans le formulaire avant l'envoi du lien (même navigateur) : on enregistre directement.
      if (hasPendingAcceptance() && !(await saveSignupAcceptance())) { if (!cancelled) router.replace(next); return; }
      if (!cancelled) setGate("a-accepter");
    })();
    return () => { cancelled = true; };
  }, [session, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) return setError("Coche la case pour accepter les conditions et continuer.");
    setState("sending");
    setError("");
    const err = await signInWithEmail(email.trim(), next);
    if (err) { setError(err); setState("idle"); } else { rememberPendingAcceptance(); setState("sent"); }
  }

  async function confirmAcceptance() {
    setSaving(true);
    setError("");
    const err = await saveSignupAcceptance();
    setSaving(false);
    if (err) setError(err); else router.replace(next);
  }

  const consentLabel = (
    <>J&apos;accepte les <Link href="/cgu" target="_blank" style={{ textDecoration: "underline" }}>conditions générales d&apos;utilisation</Link> et la <Link href="/confidentialite" target="_blank" style={{ textDecoration: "underline" }}>politique de confidentialité</Link>.</>
  );

  return (
    <main className="page">
      <div className="container" style={{ display: "grid", placeItems: "center", minHeight: "65vh" }}>
        <div className="panel fade" style={{ width: "min(440px, 100%)", padding: 32, display: "grid", gap: 16, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><LogoMark size={44} /></div>
          {session ? (
            gate === "verif" ? (
              <p className="mut" role="status">Vérification de ton compte…</p>
            ) : (
              <>
                <h1 className="h-sec">Avant de continuer</h1>
                <p className="mut">Pour utiliser ton compte, accepte nos conditions. Nous gardons la date et la version acceptées.</p>
                <label className="row" style={{ gap: 10, textAlign: "left", alignItems: "flex-start" }}>
                  <input type="checkbox" className="check" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                  <span className="small">{consentLabel}</span>
                </label>
                <button className="btn btn-lg" disabled={!accepted || saving} onClick={() => void confirmAcceptance()}>{saving ? "Enregistrement…" : "Continuer"}</button>
                {error && <div className="alert alert-bad" role="alert" style={{ textAlign: "left" }}>{error}</div>}
                <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>Je refuse : me déconnecter</button>
              </>
            )
          ) : state === "sent" ? (
            <>
              <div style={{ fontSize: 44 }} aria-hidden="true">✉️</div>
              <h1 className="h-sec">Vérifie ta boîte mail</h1>
              <p className="mut">Un lien de connexion a été envoyé à <b>{email}</b>. Clique dessus depuis cet appareil. Pense à regarder dans les spams.</p>
              <button className="btn btn-ghost" onClick={() => setState("idle")}>Changer d&apos;adresse</button>
            </>
          ) : (
            <>
              <h1 className="h-sec">Connexion</h1>
              <p className="mut">Retrouve tes projets sur tous tes appareils et publie tes SaaS en ligne. Pas de mot de passe : on t&apos;envoie un lien.</p>
              {loaded && !cloud ? (
                <div className="alert alert-warn" style={{ textAlign: "left" }}>
                  Les comptes ne sont pas encore activés sur ce site : il faut d&apos;abord configurer Supabase (voir le fichier <b>docs/MISE-EN-LIGNE.md</b>). En attendant, tes projets restent enregistrés dans ce navigateur.
                </div>
              ) : (
                <form onSubmit={submit} style={{ display: "grid", gap: 10, textAlign: "left" }}>
                  <label className="label" htmlFor="email">Adresse email</label>
                  <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" />
                  <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                    <input type="checkbox" className="check" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                    <span className="small">{consentLabel}</span>
                  </label>
                  <button className="btn btn-lg" disabled={state === "sending" || !cloud}>{state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}</button>
                </form>
              )}
              {error && <div className="alert alert-bad" role="alert" style={{ textAlign: "left" }}>{error}</div>}
              <p className="tiny mut">Tes projets actuels seront ajoutés à ton compte à la première connexion.</p>
            </>
          )}
          <Link href="/" className="small mut">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    </main>
  );
}
