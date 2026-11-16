import { expect, test } from "@playwright/test";
import { MARQUE, PNG } from "./mock-supabase";
import { MENTION, sansDebordement } from "./helpers";

// Sites publiés (/s/<adresse>) et démonstration (/s/<adresse>/app) : rendu réel, bureau et mobile.
for (const chemin of ["", "/app"]) {
  test(`site publié en marque blanche (Pro)${chemin ? " : application de démonstration" : " : landing"} : nom, couleurs, logo, favicon, sans Décollage`, async ({ page }, info) => {
    const rep = await page.goto(`/s/bougie-lune${chemin}`, { waitUntil: "domcontentloaded" });
    expect(rep!.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(MARQUE.nom));
    const visible = await page.locator("body").innerText();
    expect(visible).toContain(MARQUE.nom);
    expect(visible).not.toMatch(MENTION);
    expect(visible).not.toContain("Bougie Lune"); // l'ancien nom du projet est remplacé partout
    expect(await page.content()).not.toMatch(MENTION);
    expect(await page.locator('link[rel~="icon"]').evaluateAll((l) => l.map((x) => x.getAttribute("href")))).toContain(PNG);
    // Couleur de la marque réellement appliquée au rendu.
    const peintes = await page.evaluate(() => {
      const vus = new Set<string>();
      document.querySelectorAll("*").forEach((e) => { const s = getComputedStyle(e); [s.backgroundColor, s.color, s.borderTopColor].forEach((c) => vus.add(c)); });
      return { primaire: vus.has("rgb(18, 171, 52)"), accent: vus.has("rgb(170, 85, 0)") };
    });
    expect(peintes.primaire || peintes.accent).toBe(true);
    // Logo du client chargé.
    await expect.poll(() => page.evaluate((src) => [...document.images].some((i) => i.src === src && i.complete && i.naturalWidth > 0), PNG)).toBe(true);
    if (info.project.name === "mobile") expect(await sansDebordement(page)).toBe(true);
    await page.screenshot({ path: `test-results/captures/site${chemin ? "-app" : ""}-${info.project.name}.png` });
  });
}

test("site publié SANS droit (Découverte) : rendu habituel, aucune marque du client", async ({ page }) => {
  await page.goto("/s/site-libre", { waitUntil: "domcontentloaded" });
  const html = await page.content();
  expect(html).toMatch(MENTION);
  expect(html).not.toContain(MARQUE.nom);
});

test("isolation : le site d'un autre compte porte SA marque, jamais celle d'un autre", async ({ page }) => {
  await page.goto("/s/autre-site", { waitUntil: "domcontentloaded" });
  const visible = await page.locator("body").innerText();
  expect(visible).toContain("Autre Marque");
  expect(visible).not.toContain(MARQUE.nom);
});
