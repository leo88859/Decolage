#!/usr/bin/env node
// Suite PostgreSQL RÉELLE (plusieurs connexions simultanées). Ne tourne QUE sur une base de TEST, locale ou dans un conteneur.
//
// Règles de sécurité (non négociables) :
//   - Refuse toute URL dont le nom d'hôte contient « supabase » (production ou projet Supabase) : code 2.
//   - Sans TEST_PG_URL : n'exécute RIEN, affiche « non exécuté » et sort avec le code 0 (la CI reste verte).
//   - L'URL est fournie par l'environnement ; elle n'est jamais affichée ni écrite dans le dépôt.
//   - Pilote : psql s'il est installé ; sinon le paquet « pg » local, désigné par TEST_PG_MODULE (dossier du paquet).
//     Aucune dépendance npm n'est ajoutée au projet.
//
// Usage : TEST_PG_URL=postgres://... [TEST_PG_MODULE=/chemin/vers/node_modules/pg] node supabase/tests/run-tests.mjs
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function verifierUrl(raw) {
  if (!raw || !raw.trim()) return { ok: false, code: 0, message: "non exécuté : TEST_PG_URL absent (aucune base touchée)" };
  let host;
  try {
    host = new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return { ok: false, code: 2, message: "TEST_PG_URL invalide (format attendu : postgres://...)" };
  }
  if (host.includes("supabase")) {
    return { ok: false, code: 2, message: "REFUS : hôte Supabase détecté. Cette suite ne tourne jamais sur une base Supabase." };
  }
  return { ok: true, code: 0, message: "" };
}

/** Pilote « psql » : une connexion par appel. */
function psqlDisponible() {
  return spawnSync("psql", ["--version"]).status === 0;
}
function viaPsql(url, fichier) {
  return new Promise((resolveP) => {
    const p = spawn("psql", [url, "-X", "-v", "ON_ERROR_STOP=1", "-q", "-f", fichier], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolveP({ code, err: err.slice(-400), notices: [] }));
  });
}

/** Pilote « pg » : une connexion par appel, fichier exécuté en une seule requête (multi-instructions, protocole simple). */
async function viaNode(url, fichier) {
  const dossier = process.env.TEST_PG_MODULE;
  const pg = createRequire(import.meta.url)(resolve(dossier));
  const client = new pg.Client({ connectionString: url });
  const notices = [];
  client.on("notice", (n) => notices.push(String(n.message)));
  try {
    await client.connect();
    await client.query(readFileSync(fichier, "utf8"));
    return { code: 0, err: "", notices };
  } catch (e) {
    return { code: 1, err: String(e?.message ?? e).slice(-400), notices };
  } finally {
    await client.end().catch(() => {});
  }
}

const piloter = (url, fichier) => (psqlDisponible() ? viaPsql(url, fichier) : viaNode(url, fichier));

async function main() {
  const url = process.env.TEST_PG_URL ?? "";
  const v = verifierUrl(url);
  if (!v.ok) {
    console.log(v.message);
    process.exit(v.code);
  }
  if (!psqlDisponible() && !(process.env.TEST_PG_MODULE && existsSync(resolve(process.env.TEST_PG_MODULE)))) {
    console.log("Aucun pilote : installer psql, ou définir TEST_PG_MODULE vers le paquet « pg ». Aucune base touchée.");
    process.exit(3);
  }

  let echecs = 0;
  const lignes = [];
  // 1. Scénarios séquentiels (une connexion chacun), dans l'ordre des noms de fichiers.
  const dossier = join(here, "scenarios");
  for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) {
    const r = await piloter(url, join(dossier, f));
    lignes.push(`${r.code === 0 ? "OK  " : "ECHEC"} ${f}`);
    for (const n of r.notices) lignes.push(`      ${n}`);
    if (r.code !== 0) {
      echecs++;
      lignes.push(`      ${r.err}`);
    }
  }

  // 2. Concurrence réelle : à chaque tour, deux sessions lancent l'expiration EN MÊME TEMPS, puis une vérification.
  //    Chaque tour recrée ses données (scénario 02) et les nettoie (verifier.sql). Nombre de tours : TEST_CONC_ROUNDS (défaut 5).
  const exp = join(here, "concurrence", "expirer.sql");
  const preparation = join(dossier, "02_expiration_preparation.sql");
  const tours = Math.max(1, Number(process.env.TEST_CONC_ROUNDS ?? 5));
  if (existsSync(exp)) {
    for (let t = 1; t <= tours; t++) {
      const prep = await piloter(url, preparation);
      if (prep.code !== 0) {
        echecs++;
        lignes.push(`ECHEC concurrence tour ${t} : préparation`);
        lignes.push(`      ${prep.err}`);
        continue;
      }
      const [a, b] = await Promise.all([piloter(url, exp), piloter(url, exp)]);
      const verif = await piloter(url, join(here, "concurrence", "verifier.sql"));
      const ok = a.code === 0 && b.code === 0 && verif.code === 0;
      lignes.push(`${ok ? "OK  " : "ECHEC"} concurrence tour ${t}/${tours} (2 sessions simultanées)`);
      for (const n of verif.notices) lignes.push(`      ${n}`);
      if (!ok) {
        echecs++;
        lignes.push(`      ${a.err} ${b.err} ${verif.err}`);
      }
    }
  }

  // 3. Limites anti-abus concurrentes : 3 sessions même contact (2 réussites attendues), 2 sessions dernière unité (1 réussite).
  const prepLimites = join(here, "concurrence", "limites_preparation.sql");
  const contact = join(here, "concurrence", "limite_contact.sql");
  const stock = join(here, "concurrence", "stock_unique.sql");
  const verifLimites = join(here, "concurrence", "verifier_limites.sql");
  if (existsSync(contact)) {
    for (let t = 1; t <= tours; t++) {
      const prep = await piloter(url, prepLimites);
      if (prep.code !== 0) {
        echecs++;
        lignes.push(`ECHEC limites tour ${t} : préparation`);
        lignes.push(`      ${prep.err}`);
        continue;
      }
      const reussites = await Promise.all([piloter(url, contact), piloter(url, contact), piloter(url, contact)]);
      const stocks = await Promise.all([piloter(url, stock), piloter(url, stock)]);
      const verif = await piloter(url, verifLimites);
      const ok = [...reussites, ...stocks].every((r) => r.code === 0) && verif.code === 0;
      lignes.push(`${ok ? "OK  " : "ECHEC"} limites concurrentes tour ${t}/${tours} (contact : 3 sessions ; stock : 2 sessions)`);
      for (const n of verif.notices) lignes.push(`      ${n}`);
      if (!ok) {
        echecs++;
        lignes.push(`      ${[...reussites, ...stocks].map((r) => r.err).join(" ")} ${verif.err}`);
      }
    }
  }

  console.log(lignes.join("\n"));
  console.log(echecs === 0 ? "Suite PostgreSQL : tout est vert sur la base de TEST." : `Suite PostgreSQL : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
