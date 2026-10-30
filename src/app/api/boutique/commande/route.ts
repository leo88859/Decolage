import { adminClient, clientIp, json, invalid, originOk, readJson, tooMany } from "@/lib/boutique/api";
import { validateCommande } from "@/lib/boutique/validate";
import { isCloudConfigured } from "@/lib/env";

const FAKE_OK = { commande: { ref: "CMD-00000000", statut: "nouvelle", paiement: "non_payee" }, rejouee: false };

const SQL_ERRORS: Record<string, [number, string, string]> = {
  E_STOCK_INSUFFISANT: [409, "stock_insuffisant", "Un article n'est plus disponible en quantité suffisante. Mets à jour ton panier."],
  E_PRODUIT_INDISPONIBLE: [409, "produit_indisponible", "Un article du panier n'est plus disponible."],
  E_BOUTIQUE_INTROUVABLE: [404, "boutique_introuvable", "Cette boutique n'existe pas ou n'est pas ouverte."],
  E_MODE_INVALIDE: [400, "mode_invalide", "Ce mode de commande n'est pas proposé par la boutique."],
  E_CLIENT_INVALIDE: [400, "client_invalide", "Les coordonnées sont incomplètes ou invalides."],
  E_QUANTITE_INVALIDE: [400, "quantite_invalide", "Le panier est invalide (quantité entre 1 et 99, 20 lignes au maximum)."],
  E_CLE_INVALIDE: [400, "cle_invalide", "Clé de commande invalide."],
  E_TROP_DE_COMMANDES: [429, "trop_de_commandes", "Cette boutique reçoit trop de commandes en ce moment. Réessaie plus tard."],
};

/**
 * Passe une commande SANS paiement en ligne (publique). Le navigateur n'envoie que les identifiants de variantes et les
 * quantités : prix, stock et total sont relus/recalculés en base par boutique_creer_commande (clé service_role).
 * Anti-spam : Origin, champ piège « site », 5 envois/minute et 30/heure par IP, clé d'idempotence obligatoire.
 */
export async function POST(req: Request) {
  if (!isCloudConfigured()) return json({ error: "Les commandes ne sont pas disponibles pour le moment.", code: "demo" }, 503);
  if (!originOk(req)) return json({ error: "Requête refusée (origine inattendue).", code: "origin" }, 403);
  const body = await readJson(req);
  if (!body.ok) return body.res;
  // Champ piège invisible : un humain ne le remplit jamais. On répond « ok » sans rien enregistrer.
  if (typeof body.body === "object" && body.body !== null && String((body.body as Record<string, unknown>).site ?? "") !== "") return json(FAKE_OK, 201);
  const ip = clientIp(req);
  if (tooMany(ip, 5, 60_000, "cmd-min") || tooMany(ip, 30, 3_600_000, "cmd-h")) return json({ error: "Trop de tentatives. Réessaie dans une minute.", code: "rate_limit" }, 429);

  const v = validateCommande(body.body);
  if (!v.ok) return invalid(v.errors);
  const admin = adminClient();
  if (!admin) return json({ error: "Les commandes ne sont pas encore configurées sur ce site.", code: "server" }, 503);

  const { slug, cle, mode, client, lignes } = v.value;
  const { data, error } = await admin.rpc("boutique_creer_commande", {
    p_slug: slug,
    p_cle: cle,
    p_client: { nom: client.nom, email: client.email, telephone: client.telephone, adresse: client.adresse, note: client.note },
    p_mode: mode,
    p_lignes: lignes,
  });
  if (error) {
    const code = Object.keys(SQL_ERRORS).find((k) => error.message?.includes(k));
    if (code) {
      const [status, c, message] = SQL_ERRORS[code]!;
      return json({ error: message, code: c }, status);
    }
    return json({ error: "Commande impossible pour le moment.", code: "server" }, 500);
  }
  const { rejouee, ...commande } = data as { rejouee: boolean } & Record<string, unknown>;
  return json({ commande, rejouee }, rejouee ? 200 : 201);
}
