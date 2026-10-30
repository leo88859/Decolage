// Droit d'utiliser la marque blanche : liste d'identifiants autorisés (variable d'environnement serveur
// WHITE_LABEL_USER_IDS, pour les tests) ; la source normale est la table brand_entitlements. Fonctions pures.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** « id1, id2 ; id3 » -> identifiants valides en minuscules. Le reste est ignoré. */
export function parseAllowList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => UUID.test(s));
}

export function isAllowListed(userId: string, raw: string | undefined | null): boolean {
  return parseAllowList(raw).includes(userId.toLowerCase());
}
