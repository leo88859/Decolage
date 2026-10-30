"use client";

import Link from "next/link";
import { useState } from "react";
import { Confirm, Modal, toast } from "@/components/ui";
import type { Boutique } from "@/lib/boutique/types";
import type { Errors } from "@/lib/boutique/validate";
import { ErrorBox, useBoutiqueCtx } from "./BoutiqueContext";
import { BoutiqueFields } from "./BoutiqueFields";
import { api, BOUTIQUE_VIDE, boutiquePayload, erreursEtape, ETAPES, isPlanLimit, slugDepuisNom, type BoutiqueForm } from "./logic";

type Fail = { code: string; message: string } | null;

export function VueEnsemble() {
  const { state, reload } = useBoutiqueCtx();
  if (state.status === "loading") return <div className="skeleton" style={{ height: 260 }} aria-busy="true" aria-label="Chargement" />;
  if (state.status === "error") return <ErrorBox code={state.code} message={state.message} onRetry={() => void reload()} />;
  if (!state.boutique) return <Assistant onDone={reload} />;
  return <Apercu boutique={state.boutique} nbProduits={state.produits.length} nbCategories={state.categories.length} reload={reload} />;
}

function formDe(b: Boutique): BoutiqueForm {
  return {
    nom: b.nom, slug: b.slug, description: b.description, couleur_principale: b.couleur_principale, couleur_accent: b.couleur_accent,
    logo: b.logo ?? "", adresse: b.adresse, whatsapp: b.whatsapp ?? "", email: b.email ?? "", telephone: b.telephone ?? "", modes: b.modes,
  };
}

// ─── Assistant de création ───
function Assistant({ onDone }: { onDone: () => Promise<void> }) {
  const [form, setForm] = useState<BoutiqueForm>(BOUTIQUE_VIDE);
  const [etape, setEtape] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [slugEdite, setSlugEdite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Fail>(null);
  const derniere = etape === ETAPES.length - 1;

  const patch = (p: Partial<BoutiqueForm>) =>
    setForm((f) => {
      const next = { ...f, ...p };
      if (p.nom !== undefined && !slugEdite) next.slug = slugDepuisNom(p.nom);
      return next;
    });

  async function suivant() {
    setFail(null);
    const v = boutiquePayload(form);
    const ici = v.ok ? {} : erreursEtape(etape, v.errors);
    setErrors(ici);
    if (Object.keys(ici).length) return;
    if (!derniere) return setEtape(etape + 1);
    if (!v.ok) {
      // Une erreur appartient à une étape précédente : on y retourne.
      const premiere = ETAPES.findIndex((_, i) => Object.keys(erreursEtape(i, v.errors)).length > 0);
      setErrors(v.errors);
      return setEtape(Math.max(0, premiere));
    }
    setBusy(true);
    const r = await api<{ boutique: Boutique }>("", { method: "POST", body: v.body });
    setBusy(false);
    if (!r.ok) {
      setFail({ code: r.code, message: r.message });
      if (r.errors) {
        setErrors(r.errors);
        const premiere = ETAPES.findIndex((_, i) => Object.keys(erreursEtape(i, r.errors!)).length > 0);
        if (premiere >= 0) setEtape(premiere);
      }
      return;
    }
    toast("Boutique créée en brouillon");
    await onDone();
  }

  return (
    <section className="panel" style={{ maxWidth: 640 }} aria-labelledby="assist-t">
      <p className="mut" style={{ margin: 0 }}>Étape {etape + 1} sur {ETAPES.length}</p>
      <h2 id="assist-t" className="h-sec">{ETAPES[etape].titre}</h2>
      <ol className="row" style={{ listStyle: "none", padding: 0, margin: "8px 0 20px" }} aria-label="Progression">
        {ETAPES.map((e, i) => <li key={e.titre} className={`badge ${i === etape ? "badge-dark" : i < etape ? "badge-ok" : "badge-line"}`} aria-current={i === etape ? "step" : undefined}>{i + 1}. {e.titre}</li>)}
      </ol>
      <form onSubmit={(ev) => { ev.preventDefault(); void suivant(); }} noValidate>
        <BoutiqueFields value={form} onChange={patch} errors={errors} etapes={[etape]} onSlugEdited={() => setSlugEdite(true)} />
        {fail && <div style={{ marginTop: 16 }}><ErrorBox code={fail.code} message={fail.message} /></div>}
        {fail && isPlanLimit(fail.code) && <p className="mut">Ta boutique n&apos;a pas été créée.</p>}
        <div className="row" style={{ marginTop: 20, justifyContent: "space-between" }}>
          <button type="button" className="btn btn-ghost" disabled={etape === 0 || busy} onClick={() => { setErrors({}); setEtape(etape - 1); }}>Retour</button>
          <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? "Création…" : derniere ? "Créer ma boutique" : "Continuer"}</button>
        </div>
      </form>
    </section>
  );
}

// ─── Vue d'ensemble ───
function Apercu({ boutique: b, nbProduits, nbCategories, reload }: { boutique: Boutique; nbProduits: number; nbCategories: number; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Fail>(null);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const suspendue = b.statut === "publiee" && Boolean(b.suspended_at);
  const publiee = b.statut === "publiee" && !suspendue;
  const lien = `/b/${b.slug}`;

  async function basculer() {
    setBusy(true);
    setFail(null);
    const r = await api<{ boutique: Boutique }>(`/${b.id}`, { method: "PATCH", body: { statut: b.statut === "publiee" ? "brouillon" : "publiee" } });
    if (!r.ok) {
      setBusy(false);
      return setFail({ code: r.code, message: r.message });
    }
    await reload();
    setBusy(false);
    // On annonce selon ce que le serveur a confirmé, pas selon ce qui était demandé.
    toast(r.data.boutique.statut === "publiee" ? "Boutique publiée" : "Boutique repassée en brouillon");
  }

  async function supprimer() {
    const r = await api(`/${b.id}`, { method: "DELETE" });
    if (!r.ok) return setFail({ code: r.code, message: r.message });
    toast("Boutique supprimée");
    await reload();
  }

  return (
    <div className="stack">
      <section className="panel" aria-labelledby="b-nom">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 id="b-nom" className="h-sec" style={{ margin: 0 }}>{b.nom}</h2>
            <p className="mut" style={{ margin: "6px 0 0" }}>{b.description || "Pas encore de description."}</p>
          </div>
          <span className={`badge ${publiee ? "badge-ok" : "badge-warn"}`} data-testid="statut">{publiee ? "Publiée" : suspendue ? "Suspendue" : "Brouillon"}</span>
        </div>
        <p style={{ margin: "16px 0 0" }}>
          Lien public :{" "}
          {publiee ? <Link href={lien} target="_blank" rel="noopener"><strong>{lien}</strong></Link> : <span><strong>{lien}</strong> <span className="mut">(visible par tes clients seulement une fois publiée)</span></span>}
        </p>
        {suspendue && <p className="mut" role="status" style={{ marginBottom: 0 }}>Ta boutique est suspendue : ta formule actuelle ne permet pas de la garder en ligne. Elle n&apos;est plus accessible aux clients, mais tes produits et tes commandes sont conservés. Reprends une formule qui le permet, ou repasse-la en brouillon pour la préparer.</p>}
        <div className="row" style={{ marginTop: 18 }}>
          <button className={`btn ${publiee ? "btn-ghost" : "btn-coral"}`} onClick={() => void basculer()} disabled={busy}>
            {busy ? "Un instant…" : b.statut === "publiee" ? "Dépublier" : "Publier la boutique"}
          </button>
          <button className="btn btn-ghost" onClick={() => setEdit(true)}>Modifier les infos</button>
        </div>
        {!publiee && nbProduits === 0 && <p className="mut" style={{ marginBottom: 0 }}>Astuce : ajoute au moins un produit avant de publier.</p>}
        {fail && <div style={{ marginTop: 16 }}><ErrorBox code={fail.code} message={fail.message} /></div>}
      </section>

      <div className="grid-2">
        <Link href="/boutique/produits" className="panel"><strong>{nbProduits}</strong> produit{nbProduits > 1 ? "s" : ""} <span className="mut">→ gérer le catalogue</span></Link>
        <Link href="/boutique/categories" className="panel"><strong>{nbCategories}</strong> catégorie{nbCategories > 1 ? "s" : ""} <span className="mut">→ organiser</span></Link>
      </div>
      <Link href="/boutique/commandes" className="panel">Voir les commandes <span className="mut">(sans paiement en ligne)</span> →</Link>

      <div><button className="btn btn-danger btn-sm" onClick={() => setDel(true)}>Supprimer la boutique</button></div>

      <ModifierModal key={`${edit}-${b.updated_at}`} b={b} open={edit} onClose={() => setEdit(false)} reload={reload} />
      <Confirm open={del} onClose={() => setDel(false)} onConfirm={() => void supprimer()} danger cta="Supprimer définitivement" title="Supprimer la boutique ?" text="Ses produits, ses variantes et TOUTES ses commandes seront supprimés. C'est irréversible." />
    </div>
  );
}

function ModifierModal({ b, open, onClose, reload }: { b: Boutique; open: boolean; onClose: () => void; reload: () => Promise<void> }) {
  const [form, setForm] = useState<BoutiqueForm>(() => formDe(b));
  const [errors, setErrors] = useState<Errors>({});
  const [fail, setFail] = useState<Fail>(null);
  const [busy, setBusy] = useState(false);

  async function enregistrer() {
    setFail(null);
    const v = boutiquePayload(form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    const r = await api<{ boutique: Boutique }>(`/${b.id}`, { method: "PATCH", body: v.body });
    setBusy(false);
    if (!r.ok) {
      if (r.errors) setErrors(r.errors);
      return setFail({ code: r.code, message: r.message });
    }
    toast("Modifications enregistrées");
    await reload();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Modifier ma boutique" wide footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-dark" disabled={busy} onClick={() => void enregistrer()}>{busy ? "Enregistrement…" : "Enregistrer"}</button></>}>
      <BoutiqueFields value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} errors={errors} />
      {fail && <div style={{ marginTop: 16 }}><ErrorBox code={fail.code} message={fail.message} /></div>}
    </Modal>
  );
}
