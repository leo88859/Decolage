"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * N'affiche pas ses enfants sur les boutiques publiées (/b/…) : la barre de navigation et le pied de page de Décollage
 * ne sont pas dans le HTML de la boutique d'un client (la boutique a sa propre en-tête et son propre pied de page).
 */
export function HorsVitrine({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  return path === "/b" || path.startsWith("/b/") ? null : <>{children}</>;
}
