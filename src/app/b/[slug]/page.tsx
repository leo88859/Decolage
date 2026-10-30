import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogueView } from "@/components/vitrine/CatalogueView";
import { chargerCatalogue } from "@/components/vitrine/load";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await chargerCatalogue(slug);
  if (r.etat === "absent") notFound(); // lancé ici, le code HTTP est bien 404
  if (r.etat !== "ok") return { title: "Boutique", robots: { index: false } };
  const b = r.data.boutique;
  const description = (b.description || `Découvre les produits de ${b.nom} et commande en ligne.`).slice(0, 160);
  return { title: { absolute: b.nom }, description, openGraph: { title: b.nom, description, type: "website", locale: "fr_FR", images: b.logo ? [b.logo] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await chargerCatalogue(slug);
  if (r.etat === "absent") notFound();
  if (r.etat !== "ok") return null; // le layout affiche l'indisponibilité
  const b = r.data.boutique;
  return (
    <>
      <section className="vt-intro">
        <h1 style={{ fontSize: "1.7rem" }}>{b.nom}</h1>
        {b.description ? <p>{b.description}</p> : null}
        {b.adresse ? <p>{b.adresse}</p> : null}
      </section>
      <CatalogueView />
    </>
  );
}
