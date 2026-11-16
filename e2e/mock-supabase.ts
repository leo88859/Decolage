// Faux serveur Supabase (PostgREST + auth minimale) EN MÉMOIRE, pour les tests navigateur.
// Aucune donnée réelle, aucun service distant : tout tourne sur 127.0.0.1. Jamais utilisé hors tests.
import http from "node:http";
import { newProjectFromIdee } from "@/lib/project";
import { THEME_IDS } from "@/lib/boutique/themes";

export const MOCK_PORT = 54399;
export const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
/** PNG 1x1 valide pour le logo et le favicon de test. */
export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type Row = Record<string, unknown>;

export const USERS = {
  pro: { id: "u-pro", token: "tok-pro", plan: "pro" },
  pro2: { id: "u-pro2", token: "tok-pro2", plan: "pro" },
  soloOption: { id: "u-solo-opt", token: "tok-solo-opt", plan: "solo" },
  solo: { id: "u-solo", token: "tok-solo", plan: "solo" },
  free: { id: "u-free", token: "tok-free", plan: "gratuit" },
} as const;

export const MARQUE = { nom: "Maison Aurore", primaire: "#12ab34", accent: "#aa5500" };

const brand = (user_id: string, name: string, color_primary: string, color_accent: string): Row => ({
  user_id, name, color_primary, color_secondary: "#223344", color_accent, color_surface: "#f6f1e7", color_text: "#0b1330",
  logo_data: PNG, favicon_data: PNG, version: 1, updated_at: "2026-11-16T10:00:00Z",
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const boutique = (n: number, slug: string, owner: string, nom: string, theme: string): Row => ({
  id: uuid(n), slug, proprietaire_id: owner, statut: "publiee", nom, description: `Bienvenue chez ${nom}.`,
  couleur_principale: "#1f45e0", couleur_accent: "#ff6b4a", logo: null, adresse: "1 rue de l'Exemple", whatsapp: null, email: null, telephone: null,
  modes: ["retrait"], published_at: "2026-11-01T10:00:00Z", theme, delai_expiration_h: 48, quantite_max_article: 10,
});

export function seed(): Record<string, Row[]> {
  const themes = [...THEME_IDS];
  const boutiques = [
    ...themes.map((t, i) => boutique(i + 1, `marque-${t}`, USERS.pro.id, "Ancien Nom Boutique", t)),
    boutique(20, "libre-classique", USERS.free.id, "Boutique Libre", "classique"),
    boutique(21, "solo-sans-option", USERS.solo.id, "Boutique Solo", "vitrine"),
  ];
  const produits = boutiques.map((b, i) => ({
    id: uuid(100 + i), boutique_id: b.id, categorie_id: null, titre: "Bougie ambre", description: "Cire de soja.", prix_centimes: 1800, images: [], position: 0, created_at: "2026-11-01T10:00:00Z",
  }));
  const variantes_publiques = produits.map((p, i) => ({ id: uuid(200 + i), produit_id: p.id, boutique_id: p.boutique_id, nom: "Standard", position: 0, disponible: true, stock_bas: false }));
  const projet = (nom: string) => newProjectFromIdee({ idee: "boutique de bougies artisanales", type: "boutique", secteur: "artisanat", nom, design: "vitrine" });
  const site = (slug: string, user_id: string, nom: string): Row => {
    const x = projet(nom);
    return { slug, user_id, suspended_at: null, data: { config: x.config, landing: x.landing, pricing: null, contenu: x.contenu } };
  };
  return {
    profiles: Object.values(USERS).map((u) => ({ id: u.id, plan: u.plan })),
    brand_entitlements: [{ user_id: USERS.soloOption.id, enabled: true }, { user_id: USERS.solo.id, enabled: false }],
    brand_configs: [
      brand(USERS.pro.id, MARQUE.nom, MARQUE.primaire, MARQUE.accent),
      brand(USERS.pro2.id, "Autre Marque", "#990000", "#005599"),
      brand(USERS.soloOption.id, "Solo Option", "#7a1fa2", "#e08a00"),
      brand(USERS.solo.id, "Solo Refusée", "#000099", "#009900"),
    ],
    boutiques, categories: [], produits, variantes_publiques,
    sites: [site("bougie-lune", USERS.pro.id, "Bougie Lune"), site("site-libre", USERS.free.id, "Site Libre"), site("autre-site", USERS.pro2.id, "Autre Site")],
  };
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*" };

export function startMockSupabase(): Promise<() => Promise<void>> {
  const db = seed();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", MOCK_URL);
    const send = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json", ...CORS }); res.end(JSON.stringify(body)); };
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
    req.resume();
    if (url.pathname === "/auth/v1/user") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
      const u = Object.values(USERS).find((x) => x.token === token);
      if (!u) return send(401, { message: "invalid" });
      return send(200, { id: u.id, aud: "authenticated", role: "authenticated", email: `${u.id}@exemple.invalid`, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    }
    const rpc = /^\/rest\/v1\/rpc\//.exec(url.pathname);
    if (rpc) return send(200, false); // limites de débit : jamais dépassées
    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    if (!m) return send(404, { message: "inconnu" });
    if (req.method !== "GET") return send(201, []);
    let rows = (db[m[1]!] ?? []).filter((r) => [...url.searchParams].every(([k, v]) => {
      if (["select", "order", "limit", "offset"].includes(k)) return true;
      return v.startsWith("eq.") ? String(r[k]) === v.slice(3) : true;
    }));
    rows = rows.map((r) => ({ ...r }));
    if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
      return rows.length === 1 ? send(200, rows[0]) : send(406, { code: "PGRST116", message: "The result contains 0 rows" });
    }
    send(200, rows);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(() => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections(); })));
  });
}
