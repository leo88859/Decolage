import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { projectJson } from "@/lib/export";
import { newProjectFromIdee } from "@/lib/project";
import { MARQUE, USERS } from "./mock-supabase";
import { connecter, lireZip, MENTION } from "./helpers";

// Exports ZIP (vraie route /api/export, vraie session par cookie, faux Supabase) puis réimport dans l'application, dans le navigateur.
const projet = newProjectFromIdee({ idee: "boutique de bougies artisanales", type: "boutique", secteur: "artisanat", nom: "Bougie Lune", design: "vitrine" });
const ORIGINE = "http://localhost:3100";

async function exporter(request: APIRequestContext, kind: "archive" | "next") {
  return request.post("/api/export", { headers: { origin: ORIGINE, "content-type": "application/json" }, data: { kind, project: projet } });
}
const sansMentions = (files: { name: string; content: string }[]) => files.filter((f) => f.name !== "decollage.json" && !f.name.endsWith("/decollage.json")).map((f) => f.content).join("\n").split("decollage.json").join("");

for (const [libelle, user] of [["Pro", USERS.pro], ["Solo avec option", USERS.soloOption]] as const) {
  test(`export ZIP ${libelle} : nom, couleurs, logo de la marque, decollage.json présent, aucune mention Décollage`, async ({ context, page }) => {
    await connecter(context, user);
    const res = await exporter(page.request, "archive");
    expect(res.status()).toBe(200);
    const files = lireZip(await res.body());
    const noms = files.map((f) => f.name);
    expect(noms).toEqual(expect.arrayContaining(["index.html", "style.css", "prototype.html", "README.md", "decollage.json"]));
    const texte = sansMentions(files);
    expect(texte).not.toMatch(MENTION);
    expect(texte).not.toContain("Bougie Lune");
    expect(texte).toContain(user === USERS.pro ? MARQUE.nom : "Solo Option");
    expect(texte).toContain(user === USERS.pro ? MARQUE.primaire : "#7a1fa2");
    // Le manifeste est un vrai export réimportable, sans secret ni donnée de compte.
    const man = files.find((f) => f.name === "decollage.json")!.content;
    expect(JSON.parse(man).format).toBe("decollage-projet");
    expect(man).not.toMatch(/sk_(live|test)_|whsec_|cus_[A-Za-z0-9]{6}|service_role|cle-service|cle-anonyme|tok-|u-pro|u-solo|@exemple/i);
  });
}

test("application générée Next.js (Pro) : NOM et COULEURS personnalisés dans le code, sans Décollage", async ({ context, page }) => {
  await connecter(context, USERS.pro);
  const res = await exporter(page.request, "next");
  expect(res.status()).toBe(200);
  const files = lireZip(await res.body());
  const layout = files.find((f) => f.name.endsWith("app/layout.tsx"))!.content;
  expect(layout).toContain(`siteName: "${MARQUE.nom}"`);
  const tout = files.map((f) => f.content).join("\n");
  expect(tout).toContain(MARQUE.primaire);
  expect(tout).toContain(MARQUE.accent);
  expect(tout).not.toMatch(MENTION);
});

test("export SANS droit : Solo sans option garde la mention, Découverte refusé", async ({ context, page, playwright, baseURL }) => {
  await connecter(context, USERS.solo);
  const res = await exporter(page.request, "archive");
  expect(res.status()).toBe(200);
  const texte = lireZip(await res.body()).map((f) => f.content).join("\n");
  expect(texte).toMatch(/Généré avec Décollage/);
  expect(texte).not.toContain("Solo Refusée");
  // Découverte : pas d'export de fichiers.
  const libre = await playwright.request.newContext({ baseURL });
  await connecter(context, USERS.free);
  const cookies = await context.cookies();
  const ctxLibre = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") } });
  expect((await exporter(ctxLibre, "archive")).status()).toBe(403);
  await libre.dispose();
  await ctxLibre.dispose();
});

test("isolation entre comptes : chacun reçoit SA marque dans /api/brand et dans l'export", async ({ context, page, playwright, baseURL }) => {
  await connecter(context, USERS.pro);
  const a = await (await page.request.get("/api/brand")).text();
  expect(a).toContain(MARQUE.nom);
  expect(a).not.toContain("Autre Marque");
  const cookiesDe = async (u: (typeof USERS)[keyof typeof USERS]) => {
    const c2 = await page.context().browser()!.newContext();
    await connecter(c2, u);
    const cookies = (await c2.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    await c2.close();
    return cookies;
  };
  const autre = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: await cookiesDe(USERS.pro2) } });
  const b = await (await autre.get("/api/brand")).text();
  expect(b).toContain("Autre Marque");
  expect(b).not.toContain(MARQUE.nom);
  const z = lireZip(await (await exporter(autre, "archive")).body()).map((f) => f.content).join("\n");
  expect(z).toContain("Autre Marque");
  expect(z).not.toContain(MARQUE.nom);
  // Sans session : refusé, rien n'est lu.
  const anonyme = await playwright.request.newContext({ baseURL });
  expect((await anonyme.get("/api/brand")).status()).toBe(401);
  expect((await exporter(anonyme, "archive")).status()).toBe(401);
  await autre.dispose();
  await anonyme.dispose();
});

async function reimporter(page: import("@playwright/test").Page, manifeste: string) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "reimport-")), "decollage.json");
  fs.writeFileSync(f, manifeste);
  await page.goto("/parametres", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').first().setInputFiles(f);
}

test("export marque blanche puis RÉIMPORT dans l'application : projet et paramètres conservés", async ({ context, page }) => {
  await connecter(context, USERS.pro);
  const files = lireZip(await (await exporter(page.request, "archive")).body());
  const man = files.find((f) => f.name === "decollage.json")!.content;
  await reimporter(page, man);
  await expect(page.getByText(/1 projet importé/)).toBeVisible();
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem("decollage.data.v2") ?? "{}"));
  const p = stocke.projects.find((x: { config: { nom: string } }) => x.config.nom === MARQUE.nom);
  expect(p).toBeTruthy();
  expect(p.config.couleurs.primaire).toBe(MARQUE.primaire);
  expect(p.config.templateId).toBe(projet.config.templateId);
  expect(p.config.modules).toEqual(projet.config.modules);
});

test("un ancien export (sans marque, projectJson d'origine) se réimporte toujours", async ({ page }) => {
  await reimporter(page, projectJson(projet));
  await expect(page.getByText(/1 projet importé/)).toBeVisible();
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem("decollage.data.v2") ?? "{}"));
  expect(stocke.projects.some((x: { config: { nom: string } }) => x.config.nom === "Bougie Lune")).toBe(true);
});
