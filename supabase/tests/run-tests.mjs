#!/usr/bin/env node
// Suite PostgreSQL RÉELLE (plusieurs connexions simultanées). Ne tourne QUE sur une base de TEST, locale ou dans un conteneur.
//
// Règles de sécurité (non négociables) :
//   - Refuse toute URL dont le nom d'hôte contient « supabase » (production ou projet Supabase) : code 2.
//   - Sans TEST_PG_URL : n'exécute RIEN, affiche « non exécuté » et sort avec le code 0 (la CI reste verte).
//   - Ne lit jamais de secret depuis le dépôt. L'URL est fournie par l'environnement, et n'est jamais affichée.
//   - Utilise psql (déjà présent sur la machine du testeur). Aucune dépendance npm ajoutée.
//
// Usage : TEST_PG_URL=postgres://... node supabase/tests/run-tests.mjs
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function verifierUrl(raw) {
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

/** Lance psql sur un fichier SQL. Ne renvoie que le code et la fin de l'erreur (jamais l'URL). */
function psql(url, args) {
  return new Promise((resolve) => {
    const p = spawn("psql", [url, "-X", "-v", "ON_ERROR_STOP=1", "-q", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, err: err.slice(-400) }));
  });
}

async function main() {
  const url = process.env.TEST_PG_URL ?? "";
  const v = verifierUrl(url);
  if (!v.ok) {
    console.log(v.message);
    process.exit(v.code);
  }
  if (spawnSync("psql", ["--version"]).status !== 0) {
    console.log("psql introuvable : installer le client PostgreSQL pour lancer la suite (aucune base touchée).");
    process.exit(3);
  }

  let echecs = 0;
  // 1. Scénarios séquentiels (une connexion chacun), dans l'ordre des noms de fichiers.
  const dossier = join(here, "scenarios");
  for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql")).sort()) {
    const r = await psql(url, ["-f", join(dossier, f)]);
    console.log(`${r.code === 0 ? "OK  " : "ECHEC"} ${f}`);
    if (r.code !== 0) {
      echecs++;
      console.log(r.err);
    }
  }

  // 2. Concurrence réelle : deux sessions lancent l'expiration EN MÊME TEMPS, puis une vérification.
  const exp = join(here, "concurrence", "expirer.sql");
  if (existsSync(exp)) {
    const [a, b] = await Promise.all([psql(url, ["-f", exp]), psql(url, ["-f", exp])]);
    const verif = await psql(url, ["-f", join(here, "concurrence", "verifier.sql")]);
    const ok = a.code === 0 && b.code === 0 && verif.code === 0;
    console.log(`${ok ? "OK  " : "ECHEC"} concurrence (2 sessions simultanées)`);
    if (!ok) {
      echecs++;
      console.log(a.err, b.err, verif.err);
    }
  }

  console.log(echecs === 0 ? "Suite PostgreSQL : tout est vert sur la base de TEST." : `Suite PostgreSQL : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
