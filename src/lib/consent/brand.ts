// Nom commercial du client affiché dans le bandeau cookies d'une boutique en marque blanche.
// Petit magasin côté navigateur : la boutique (layout serveur) le renseigne, le bandeau (layout racine) le lit.
// Sans valeur (null) : le bandeau reste celui de la plateforme, inchangé.

let nom: string | null = null;
const listeners = new Set<() => void>();

export function setConsentBrand(n: string | null) {
  const v = n && n.trim() ? n.trim() : null;
  if (v === nom) return;
  nom = v;
  listeners.forEach((l) => l());
}

export function subscribeConsentBrand(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const getConsentBrand = () => nom;
export const getServerConsentBrand = (): string | null => null;
