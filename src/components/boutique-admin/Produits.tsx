"use client";

import { useState } from "react";
import { Confirm, Modal, toast } from "@/components/ui";
import { formatEuros } from "@/lib/boutique/money";
import type { Categorie, Produit } from "@/lib/boutique/types";
import type { Errors } from "@/lib/boutique/validate";
import { ErrorBox, WithBoutique } from "./BoutiqueContext";
import { Field } from "./Field";
import { api, DISPO_LABEL, PRODUIT_VIDE, produitPayload, stockEtat, type ProduitForm } from "./logic";

export function Produits() {
  return <WithBoutique>{({ boutique, categories, produits, reload }) => <Liste bid={boutique.id} categories={categories} produits={produits} reload={reload} />}</WithBoutique>;
}

const centimesEnSaisie = (c: number) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;
function formDe(p: Produit): ProduitForm {
  return {
    titre: p.titre, description: p.description, prix: centimesEnSaisie(p.prix_centimes), image: p.images[0] ?? "", categorie_id: p.categorie_id ?? "", actif: p.actif,
    variantes: p.variantes.map((v) => ({ id: v.id, nom: v.nom, stock: String(v.stock), actif: v.actif })),
  };
}

function Liste({ bid, categories, produits, reload }: { bid: string; categories: Categorie[]; produits: Produit[]; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<Produit | "new" | null>(null);
  const [del, setDel] = useState<Produit | null>(null);
  const [fail, setFail] = useState("");
  const catNom = (id: string | null) => categories.find((c) => c.id === id)?.nom;

  async function supprimer(p: Produit) {
    const r = await api(`/${bid}/produits/${p.id}`, { method: "DELETE" });
    if (!r.ok) return setFail(r.message);
    setFail("");
    toast("Produit supprimé");
    await reload();
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <p className="mut" style={{ margin: 0 }}>{produits.length} produit{produits.length > 1 ? "s" : ""}</p>
        <button className="btn btn-dark" onClick={() => setEdit("new")}>+ Ajouter un produit</button>
      </div>
      {fail && <ErrorBox message={fail} />}
      {produits.length === 0 ? (
        <div className="empty">
          <h2 className="h-sec">Aucun produit</h2>
          <p className="mut">Ajoute ton premier produit : titre, prix, et le stock de chaque taille ou couleur.</p>
          <button className="btn btn-dark" onClick={() => setEdit("new")}>Ajouter un produit</button>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}>
          {produits.map((p) => {
            const etat = p.actif ? stockEtat(p.variantes) : null;
            return (
              <li key={p.id} className="panel row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <strong>{p.titre}</strong> <span style={{ whiteSpace: "nowrap" }}>· {formatEuros(p.prix_centimes)}</span>
                  <div className="row" style={{ gap: 6, margin: "6px 0" }}>
                    {!p.actif ? <span className="badge badge-line">Inactif (invisible)</span> : <span className={`badge ${etat === "disponible" ? "badge-ok" : etat === "stock_bas" ? "badge-warn" : "badge-bad"}`}>{DISPO_LABEL[etat!]}</span>}
                    {catNom(p.categorie_id) && <span className="badge badge-line">{catNom(p.categorie_id)}</span>}
                  </div>
                  <p className="mut" style={{ margin: 0, fontSize: 14 }}>{p.variantes.map((v) => `${v.nom} : ${v.stock}${v.actif ? "" : " (inactive)"}`).join(" · ")}</p>
                </div>
                <span className="row">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEdit(p)} aria-label={`Modifier ${p.titre}`}>Modifier</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDel(p)} aria-label={`Supprimer ${p.titre}`}>Supprimer</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <FormProduit key={edit === null ? "x" : edit === "new" ? "new" : edit.id} bid={bid} categories={categories} produit={edit} onClose={() => setEdit(null)} reload={reload} />
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={() => del && void supprimer(del)} danger cta="Supprimer" title="Supprimer le produit ?" text={del ? `« ${del.titre} » et ses variantes seront supprimés définitivement.` : ""} />
    </div>
  );
}

function FormProduit({ bid, categories, produit, onClose, reload }: { bid: string; categories: Categorie[]; produit: Produit | "new" | null; onClose: () => void; reload: () => Promise<void> }) {
  const existant = produit && produit !== "new" ? produit : null;
  const [f, setF] = useState<ProduitForm>(() => (existant ? formDe(existant) : PRODUIT_VIDE));
  const [errors, setErrors] = useState<Errors>({});
  const [fail, setFail] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<ProduitForm>) => setF((x) => ({ ...x, ...p }));
  const setVar = (i: number, p: Partial<ProduitForm["variantes"][number]>) => set({ variantes: f.variantes.map((v, j) => (j === i ? { ...v, ...p } : v)) });

  async function enregistrer() {
    setFail("");
    const v = produitPayload(f);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    const serverErrors = (e?: Errors) => e && setErrors(Object.fromEntries(Object.entries(e).map(([k, m]) => [k === "prix_centimes" ? "prix" : k === "images" ? "image" : k, m])));
    if (!existant) {
      const r = await api(`/${bid}/produits`, { method: "POST", body: { ...v.produit, variantes: v.variantes.map(({ nom, stock, actif }) => ({ nom, stock, actif })) } });
      setBusy(false);
      if (!r.ok) { serverErrors(r.errors); return setFail(r.message); }
      toast("Produit ajouté");
    } else {
      const base = `/${bid}/produits/${existant.id}`;
      const r = await api(base, { method: "PATCH", body: v.produit });
      if (!r.ok) { setBusy(false); serverErrors(r.errors); return setFail(r.message); }
      // Variantes : ajout / modification / suppression, une par une ; la première erreur arrête et s'affiche.
      const gardees = new Set(v.variantes.map((x) => x.id).filter(Boolean));
      const steps: [string, string, unknown?][] = [];
      for (const old of existant.variantes) if (!gardees.has(old.id)) steps.push(["DELETE", `${base}/variantes/${old.id}`]);
      for (const x of v.variantes) {
        const old = x.id ? existant.variantes.find((o) => o.id === x.id) : undefined;
        if (!x.id) steps.push(["POST", `${base}/variantes`, { nom: x.nom, stock: x.stock, actif: x.actif }]);
        else if (old && (old.nom !== x.nom || old.stock !== x.stock || old.actif !== x.actif)) steps.push(["PATCH", `${base}/variantes/${x.id}`, { nom: x.nom, stock: x.stock, actif: x.actif }]);
      }
      for (const [method, path, body] of steps) {
        const rv = await api(path, { method, body });
        if (!rv.ok) {
          setBusy(false);
          await reload();
          return setFail(`${rv.message} (le produit a été enregistré, mais pas toutes les variantes)`);
        }
      }
      setBusy(false);
      toast("Produit modifié");
    }
    await reload();
    onClose();
  }

  return (
    <Modal open={!!produit} onClose={onClose} wide title={existant ? "Modifier le produit" : "Ajouter un produit"} footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-dark" disabled={busy} onClick={() => void enregistrer()}>{busy ? "Enregistrement…" : "Enregistrer"}</button></>}>
      <div className="stack">
        <Field label="Titre" error={errors.titre}>{(p) => <input {...p} className="input" maxLength={120} value={f.titre} onChange={(e) => set({ titre: e.target.value })} />}</Field>
        <Field label="Description (facultatif)" error={errors.description}>{(p) => <textarea {...p} className="input" rows={3} maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
        <div className="grid-2">
          <Field label="Prix en euros" error={errors.prix} hint="Ex. 25,99">{(p) => <input {...p} inputMode="decimal" className="input" value={f.prix} onChange={(e) => set({ prix: e.target.value })} />}</Field>
          <Field label="Catégorie" error={errors.categorie_id}>
            {(p) => (
              <select {...p} className="input" value={f.categorie_id} onChange={(e) => set({ categorie_id: e.target.value })}>
                <option value="">Sans catégorie</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Image (adresse https://, facultatif)" error={errors.image} hint="Lien d'une image hébergée en ligne.">{(p) => <input {...p} type="url" inputMode="url" className="input" placeholder="https://…" value={f.image} onChange={(e) => set({ image: e.target.value })} />}</Field>
        <label className="row" style={{ gap: 10, cursor: "pointer" }}>
          <input type="checkbox" style={{ width: 20, height: 20 }} checked={f.actif} onChange={(e) => set({ actif: e.target.checked })} />
          <span>Produit actif (visible dans la boutique)</span>
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>Variantes (taille, couleur…) et stock</legend>
          {errors.variantes && <p role="alert" style={{ color: "var(--bad)", margin: "0 0 8px" }}>{errors.variantes}</p>}
          <div className="stack" style={{ gap: 12 }}>
            {f.variantes.map((v, i) => (
              <div key={v.id ?? `n${i}`} className="tile row" style={{ alignItems: "flex-start", padding: 12 }}>
                <div style={{ flex: "2 1 150px" }}>
                  <Field label={`Variante ${i + 1}`} error={errors[`variante.${i}.nom`]}>{(p) => <input {...p} className="input" maxLength={80} value={v.nom} onChange={(e) => setVar(i, { nom: e.target.value })} />}</Field>
                </div>
                <div style={{ flex: "1 1 90px" }}>
                  <Field label="Stock" error={errors[`variante.${i}.stock`]}>{(p) => <input {...p} inputMode="numeric" className="input" value={v.stock} onChange={(e) => setVar(i, { stock: e.target.value })} />}</Field>
                </div>
                <label className="row" style={{ gap: 6, marginTop: 30, cursor: "pointer" }}><input type="checkbox" checked={v.actif} onChange={(e) => setVar(i, { actif: e.target.checked })} /> Active</label>
                <button type="button" className="btn btn-sm btn-danger" style={{ marginTop: 26 }} disabled={f.variantes.length <= 1} onClick={() => set({ variantes: f.variantes.filter((_, j) => j !== i) })} aria-label={`Retirer la variante ${v.nom || i + 1}`}>Retirer</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={() => set({ variantes: [...f.variantes, { nom: "", stock: "0", actif: true }] })}>+ Ajouter une variante</button>
        </fieldset>
        {fail && <ErrorBox message={fail} />}
      </div>
    </Modal>
  );
}
