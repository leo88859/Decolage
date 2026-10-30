import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chargerCatalogue } from "@/components/vitrine/load";
import { SuiviView } from "@/components/vitrine/SuiviView";

export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if ((await chargerCatalogue((await params).slug)).etat === "absent") notFound();
  return <SuiviView />;
}
