"use client";

import { useEffect } from "react";
import { setConsentBrand } from "@/lib/consent/brand";

/** Rendu par une boutique en marque blanche : le bandeau cookies prend le nom commercial du client (rien d'affiché). */
export function ConsentBrand({ nom }: { nom: string }) {
  useEffect(() => {
    setConsentBrand(nom);
    return () => setConsentBrand(null);
  }, [nom]);
  return null;
}
