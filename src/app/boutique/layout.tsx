import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { BoutiqueProvider } from "@/components/boutique-admin/BoutiqueContext";
import { SubNav } from "@/components/boutique-admin/SubNav";

export const metadata: Metadata = { title: "Ma boutique", robots: { index: false, follow: false } };

export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <PageHero
        tone="coral"
        compact
        eyebrow="Ma boutique"
        title={<>Vends tes produits, <span className="serif">à ton rythme</span>.</>}
        lead="Catalogue, stock et commandes au même endroit. Les clients commandent sans payer en ligne : tu t'arranges avec eux pour le paiement."
      />
      <div className="container" style={{ paddingTop: 24 }}>
        <BoutiqueProvider>
          <SubNav />
          {children}
        </BoutiqueProvider>
      </div>
    </main>
  );
}
