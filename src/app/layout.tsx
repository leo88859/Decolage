import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, Space_Grotesk } from "next/font/google";
import { CloudSync } from "@/components/CloudSync";
import { ConsentManager } from "@/components/ConsentManager";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { PrefsApply } from "@/components/PrefsApply";
import { Toasts } from "@/components/ui";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Décollage — De ton idée à ton SaaS. Sans partir de zéro.", template: "%s · Décollage" },
  description:
    "Décris ton idée, choisis parmi 10 designs et assemble ton SaaS : application interactive, page de vente et plan de lancement. Sans IA ni clé API.",
  applicationName: "Décollage",
  openGraph: { siteName: "Décollage", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0a1433" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable} ${serif.variable}`}>
      <body>
        <a href="#contenu" className="sr-only">Aller au contenu</a>
        <Nav />
        <div id="contenu" tabIndex={-1}>{children}</div>
        <Footer />
        <ConsentManager />
        <Toasts />
        <CloudSync />
        <PrefsApply />
      </body>
    </html>
  );
}
