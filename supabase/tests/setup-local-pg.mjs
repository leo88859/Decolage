#!/usr/bin/env node
// Met en place un PostgreSQL LOCAL, jetable et isolé pour la suite de tests réels (supabase/tests/run-tests.mjs).
//
// Garde-fous :
//   - Serveur lié à 127.0.0.1 uniquement, authentification « trust » : acceptable UNIQUEMENT sur un poste de test.
//   - Aucune connexion à un hôte distant. Refus si PG_DATA est absent ou si la base cible n'est pas locale.
//   - Migrations 0001 à 0011 seulement. 0010b (pg_cron) et 0011b (retrait après déploiement) NE sont PAS appliquées.
//   - Ne lit aucun secret. Ne touche à aucune base Supabase.
//
// Variables : PG_BIN (dossier contenant initdb et pg_ctl), PG_DATA (dossier de données, créé s'il n'existe pas),
//             PG_PORT (défaut 54329), TEST_PG_MODULE (dossier du paquet « pg », pour le client Node).
// Commandes : node setup-local-pg.mjs up | down
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const racineSupabase = resolve(here, "..");
const exe = (n) => (process.platform === "win32" ? `${n}.exe` : n);
const PORT = Number(process.env.PG_PORT ?? 54329);
const BASE = "decollage_test";
const HOTE = "127.0.0.1";
const MIGRATIONS = ["0001_schema.sql", "0002_conformite.sql", "0003_marque_blanche.sql", "0004_limites_serveur.sql", "0005_boutique.sql", "0006_regle_gratuit.sql", "0007_durcissement.sql", "0008_suspendus_et_expiration.sql", "0009_theme_boutique.sql", "0010_expiration_antiabus.sql", "0011_waitlist_consentement.sql"];
const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

function lancer(binaire, args) {
  const r = spawnSync(join(process.env.PG_BIN ?? "", exe(binaire)), args, { encoding: "utf8" });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

async function client(url) {
  const pg = createRequire(import.meta.url)(resolve(process.env.TEST_PG_MODULE));
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
}

async function up() {
  const bin = process.env.PG_BIN;
  const data = process.env.PG_DATA;
  if (!bin || !existsSync(join(bin, exe("initdb")))) throw new Error("PG_BIN absent ou sans initdb");
  if (!data) throw new Error("PG_DATA absent (dossier de données jetable)");
  if (!process.env.TEST_PG_MODULE || !existsSync(resolve(process.env.TEST_PG_MODULE))) throw new Error("TEST_PG_MODULE absent (paquet pg)");
  mkdirSync(data, { recursive: true });
  if (!existsSync(join(data, "PG_VERSION"))) {
    const i = lancer("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
    if (i.status !== 0) throw new Error(`initdb a échoué : ${i.out.slice(-300)}`);
  }
  // Déjà démarré ? (pg_ctl status : 0 = en marche). Sinon démarrage avec sorties IGNORÉES : le serveur hérite des tubes,
  // et spawnSync attendrait indéfiniment qu'ils se ferment.
  if (lancer("pg_ctl", ["-D", data, "status"]).status !== 0) {
    const r = spawnSync(join(bin, exe("pg_ctl")), ["-D", data, "-o", `-p ${PORT} -h ${HOTE}`, "-l", join(data, "server.log"), "-w", "start"], { stdio: "ignore" });
    if (r.status !== 0) throw new Error("pg_ctl start a échoué (voir server.log dans PG_DATA)");
  }

  const admin = await client(`postgres://postgres@${HOTE}:${PORT}/postgres`);
  const existe = await admin.query("select 1 from pg_database where datname = $1", [BASE]);
  if (existe.rowCount === 0) await admin.query(`create database ${BASE}`);
  await admin.end();

  const c = await client(`postgres://postgres@${HOTE}:${PORT}/${BASE}`);
  try {
    const deja = await c.query("select to_regclass('public.boutiques') is not null as ok");
    if (!deja.rows[0].ok) {
      await c.query(STUB);
      for (const f of MIGRATIONS) await c.query(readFileSync(join(racineSupabase, f), "utf8"));
      console.log(`Migrations appliquées : ${MIGRATIONS.length} (0001 à 0011).`);
    } else {
      console.log("Base déjà migrée : aucune migration rejouée.");
    }
    await c.query("insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a', 'test@test.invalide') on conflict do nothing");
  } finally {
    await c.end();
  }
  console.log(`PRÊT. URL de test (aucun secret) : postgres://postgres@${HOTE}:${PORT}/${BASE}`);
  console.log(`Lancer la suite : TEST_PG_URL=postgres://postgres@${HOTE}:${PORT}/${BASE} TEST_PG_MODULE=... node supabase/tests/run-tests.mjs`);
}

function down() {
  const data = process.env.PG_DATA;
  if (!data) throw new Error("PG_DATA absent");
  const s = lancer("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(s.status === 0 ? "Serveur de test arrêté." : `Arrêt : ${s.out.slice(-200)}`);
}

const cmd = process.argv[2];
try {
  if (cmd === "up") await up();
  else if (cmd === "down") down();
  else console.log("Usage : node supabase/tests/setup-local-pg.mjs up | down");
} catch (e) {
  console.error(`ECHEC : ${e.message}`);
  process.exit(1);
}
