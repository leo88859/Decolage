import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chargerCatalogue } from "@/components/vitrine/load";
import Link from "next/link";
import { PanierView } from "@/components/vitrine/PanierView";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if ((await chargerCatalogue(slug)).etat === "absent") notFound();
  return (
    <>
      <Link className="vt-crumb" href={`/b/${slug}`}>← Continuer mes achats</Link>
      <PanierView />
    </>
  );
}
