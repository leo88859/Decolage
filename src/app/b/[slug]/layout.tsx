import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "@/components/vitrine/CartProvider";
import { ContactLinks, VitrineHeader } from "@/components/vitrine/Chrome";
import { chargerCatalogue } from "@/components/vitrine/load";
import { readableOn, safeColor, textOnWhite } from "@/components/vitrine/logic";
import { themeOf } from "@/lib/boutique/themes";
import "@/components/vitrine/vitrine.css";

/** Titres des pages enfants (panier, suivi) : « … · Décollage » par défaut ; avec la marque blanche, le nom de la boutique. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await chargerCatalogue(slug);
  if (r.etat === "ok" && r.data.marque_blanche === true) return { title: { template: `%s · ${r.data.boutique.nom}`, default: r.data.boutique.nom } };
  return {};
}

// Jamais figée au build : le catalogue vient de la base à chaque requête.
export const dynamic = "force-dynamic";

export default async function VitrineLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await chargerCatalogue(slug);
  if (r.etat === "absent") return <>{children}</>; // chaque page déclenche la 404 elle-même (code HTTP correct)
  if (r.etat === "indisponible") {
    return (
      <div className="vt" style={{ "--vt-main": "#1a1a1f", "--vt-on-main": "#ffffff", "--vt-accent": "#1a1a1f", "--vt-ink": "#1a1a1f" } as CSSProperties}>
        <main className="vt-main vt-wrap" id="vt-contenu" tabIndex={-1}>
          <h1>Boutique momentanément indisponible</h1>
          <p>Nous n&apos;arrivons pas à charger cette boutique pour le moment. Réessaie dans quelques minutes.</p>
        </main>
      </div>
    );
  }
  const { boutique: b } = r.data;
  // Booléen calculé côté serveur (formule + option) ; absent ou autre chose que true : la mention reste affichée.
  const masquer = r.data.marque_blanche === true;
  const main = safeColor(b.couleur_principale, "#1f45e0");
  const accent = safeColor(b.couleur_accent, "#ff6b4a");
  const style = { "--vt-main": main, "--vt-on-main": readableOn(main), "--vt-accent": accent, "--vt-ink": textOnWhite(main) } as CSSProperties;

  return (
    <CartProvider catalogue={r.data}>
      <div className="vt" data-theme={themeOf(b.theme)} style={style}>
        <a href="#vt-contenu" className="vt-skip">Aller au contenu</a>
        <VitrineHeader />
        <main className="vt-main" id="vt-contenu" tabIndex={-1}>
          <div className="vt-wrap">{children}</div>
        </main>
        <footer className="vt-foot">
          <div className="vt-wrap">
            <div>
              <h2 style={{ fontSize: "1.05rem" }}>{b.nom}</h2>
              {b.adresse ? <p style={{ margin: "4px 0" }}>{b.adresse}</p> : null}
              <ContactLinks b={b} />
              <p style={{ marginTop: 12 }}><Link href={`/b/${b.slug}/suivi`}>Suivre ma commande</Link></p>
            </div>
            {masquer ? null : (
              <p className="vt-made">
                Créé avec <Link href="/">Décollage</Link>
              </p>
            )}
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
