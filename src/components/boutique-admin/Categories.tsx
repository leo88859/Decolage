"use client";

import { useState } from "react";
import { Confirm, toast } from "@/components/ui";
import type { Categorie } from "@/lib/boutique/types";
import { ErrorBox, WithBoutique } from "./BoutiqueContext";
import { Field } from "./Field";
import { api, categoriePayload } from "./logic";

export function Categories() {
  return (
    <WithBoutique>
      {({ boutique, categories, produits, reload }) => <Liste bid={boutique.id} categories={categories} compte={(id) => produits.filter((p) => p.categorie_id === id).length} reload={reload} />}
    </WithBoutique>
  );
}

function Liste({ bid, categories, compte, reload }: { bid: string; categories: Categorie[]; compte: (id: string) => number; reload: () => Promise<void> }) {
  const [nom, setNom] = useState("");
  const [err, setErr] = useState("");
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ id: string; nom: string } | null>(null);
  const [editErr, setEditErr] = useState("");
  const [del, setDel] = useState<Categorie | null>(null);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setFail("");
    const v = categoriePayload(nom);
    if (!v.ok) return setErr(v.errors.nom ?? "Nom invalide.");
    setErr("");
    setBusy(true);
    const r = await api(`/${bid}/categories`, { method: "POST", body: { nom: v.value.nom } });
    setBusy(false);
    if (!r.ok) return r.code === "duplicate" || r.code === "invalid" ? setErr(r.errors?.nom ?? r.message) : setFail(r.message);
    setNom("");
    toast("Catégorie créée");
    await reload();
  }

  async function renommer() {
    if (!edit) return;
    const v = categoriePayload(edit.nom);
    if (!v.ok) return setEditErr(v.errors.nom ?? "Nom invalide.");
    setBusy(true);
    const r = await api(`/${bid}/categories/${edit.id}`, { method: "PATCH", body: { nom: v.value.nom } });
    setBusy(false);
    if (!r.ok) return setEditErr(r.errors?.nom ?? r.message);
    setEdit(null);
    setEditErr("");
    toast("Catégorie renommée");
    await reload();
  }

  async function supprimer(c: Categorie) {
    const r = await api(`/${bid}/categories/${c.id}`, { method: "DELETE" });
    if (!r.ok) return setFail(r.message);
    toast("Catégorie supprimée");
    await reload();
  }

  return (
    <div className="stack">
      <form className="panel row" style={{ alignItems: "flex-start" }} onSubmit={(e) => void ajouter(e)} noValidate>
        <div style={{ flex: "1 1 240px" }}>
          <Field label="Nouvelle catégorie" error={err}>{(p) => <input {...p} className="input" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Robes" />}</Field>
        </div>
        <button className="btn btn-dark" style={{ marginTop: 26 }} disabled={busy}>Ajouter</button>
      </form>
      {fail && <ErrorBox message={fail} />}

      {categories.length === 0 ? (
        <div className="empty"><p className="mut">Aucune catégorie pour le moment. Elles servent à ranger tes produits (facultatif).</p></div>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}>
          {categories.map((c) => (
            <li key={c.id} className="panel row" style={{ justifyContent: "space-between" }}>
              {edit?.id === c.id ? (
                <form className="row" style={{ flex: "1 1 260px", alignItems: "flex-start" }} onSubmit={(e) => { e.preventDefault(); void renommer(); }} noValidate>
                  <div style={{ flex: "1 1 180px" }}>
                    <Field label={`Nouveau nom de « ${c.nom} »`} error={editErr}>{(p) => <input {...p} className="input" maxLength={60} value={edit.nom} autoFocus onChange={(e) => setEdit({ id: c.id, nom: e.target.value })} />}</Field>
                  </div>
                  <button className="btn btn-sm btn-dark" style={{ marginTop: 26 }} disabled={busy}>Enregistrer</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 26 }} onClick={() => { setEdit(null); setEditErr(""); }}>Annuler</button>
                </form>
              ) : (
                <>
                  <span><strong>{c.nom}</strong> <span className="mut">· {compte(c.id)} produit{compte(c.id) > 1 ? "s" : ""}</span></span>
                  <span className="row">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEdit({ id: c.id, nom: c.nom }); setEditErr(""); }} aria-label={`Renommer ${c.nom}`}>Renommer</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDel(c)} aria-label={`Supprimer ${c.nom}`}>Supprimer</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={() => del && void supprimer(del)} danger cta="Supprimer" title="Supprimer la catégorie ?" text={del ? `« ${del.nom} » sera supprimée. Ses produits sont conservés, simplement sans catégorie.` : ""} />
    </div>
  );
}
