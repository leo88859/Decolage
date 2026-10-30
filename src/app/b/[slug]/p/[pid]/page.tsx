import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerCatalogue } from "@/components/vitrine/load";
import { imagesSures } from "@/components/vitrine/logic";
import { ProduitView } from "@/components/vitrine/ProduitView";
import { formatEuros } from "@/lib/boutique/money";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; pid: string }> }): Promise<Metadata> {
  const { slug, pid } = await params;
  const r = await chargerCatalogue(slug);
  const p = r.etat === "ok" ? r.data.produits.find((x) => x.id === pid) : undefined;
  if (r.etat === "absent" || (r.etat === "ok" && !p)) notFound();
  if (r.etat !== "ok" || !p) return { title: "Produit", robots: { index: false } };
  const description = (p.description || `${p.titre} chez ${r.data.boutique.nom}, ${formatEuros(p.prix_centimes)}.`).slice(0, 160);
  const img = imagesSures(p.images)[0];
  return { title: `${p.titre} · ${r.data.boutique.nom}`, description, openGraph: { title: p.titre, description, images: img ? [img] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ slug: string; pid: string }> }) {
  const { slug, pid } = await params;
  const r = await chargerCatalogue(slug);
  if (r.etat === "absent") notFound();
  if (r.etat !== "ok") return null;
  if (!r.data.produits.some((x) => x.id === pid)) notFound();
  return (
    <>
      <Link className="vt-crumb" href={`/b/${slug}`}>← Tous les produits</Link>
      <ProduitView produitId={pid} />
    </>
  );
}
