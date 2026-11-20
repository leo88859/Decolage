import { expect, test } from "@playwright/test";
import { THEME_IDS } from "@/lib/boutique/themes";
import { MARQUE, PNG } from "./mock-supabase";
import { MENTION, sansDebordement } from "./helpers";

// Boutiques publiées (/b/<adresse>) : rendu réel dans le navigateur, six thèmes, bureau et mobile (projets Playwright « desktop » et « mobile »).
for (const theme of THEME_IDS) {
  test(`boutique en marque blanche, thème ${theme} : nom, logo, couleurs, favicon, aucune mention Décollage`, async ({ page }, info) => {
    await page.goto(`/b/marque-${theme}`, { waitUntil: "domcontentloaded" });
    const racine = page.locator(".vt");
    await expect(racine).toHaveAttribute("data-theme", theme);
    // Nom commercial du client (et non l'ancien nom de la boutique) dans l'en-tête, le pied de page et le titre de l'onglet.
    await expect(page.locator(".vt-brand span")).toHaveText(MARQUE.nom);
    await expect(page.locator(".vt-foot h2")).toHaveText(MARQUE.nom);
    await expect(page).toHaveTitle(new RegExp(MARQUE.nom));
    expect(await page.locator("body").innerText()).not.toContain("Ancien Nom Boutique");
    // Logo du client : image réellement chargée.
    const logo = page.locator("img.vt-logo");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", PNG);
    await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    // Couleurs : variables appliquées ET couleur réellement peinte quelque part (bouton ou bandeau).
    const vars = await racine.evaluate((el) => ({ main: getComputedStyle(el).getPropertyValue("--vt-main").trim(), accent: getComputedStyle(el).getPropertyValue("--vt-accent").trim() }));
    expect(vars).toEqual({ main: MARQUE.primaire, accent: MARQUE.accent });
    const peintes = await page.evaluate(() => {
      const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
      const vus = new Set<string>();
      document.querySelectorAll(".vt *").forEach((e) => { const s = getComputedStyle(e); [s.backgroundColor, s.color, s.borderTopColor, s.borderBottomColor, s.outlineColor].forEach((c) => vus.add(c)); });
      return { main: vus.has(rgb("#12ab34")), accent: vus.has(rgb("#aa5500")) };
    });
    expect(peintes.main || peintes.accent).toBe(true);
    // Favicon et métadonnées du client.
    expect(await page.locator('link[rel~="icon"]').evaluateAll((l) => l.map((x) => x.getAttribute("href")))).toContain(PNG);
    // Aucune mention commerciale de Décollage, ni visible ni dans le HTML.
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(MENTION);
    expect(visible).not.toContain("Créé avec");
    expect(await page.title()).not.toMatch(MENTION);
    if (info.project.name === "mobile") expect(await sansDebordement(page)).toBe(true);
    await page.screenshot({ path: `test-results/captures/boutique-${theme}-${info.project.name}.png`, fullPage: false });
  });
}

test("boutique SANS droit (Découverte) : comportement habituel, mention Créé avec Décollage conservée", async ({ page }) => {
  await page.goto("/b/libre-classique", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".vt-brand span")).toHaveText("Boutique Libre");
  await expect(page.locator(".vt-made")).toContainText("Créé avec Décollage");
});

test("boutique Solo SANS option : droit refusé, mention conservée et aucune marque du client", async ({ page }) => {
  await page.goto("/b/solo-sans-option", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".vt-brand span")).toHaveText("Boutique Solo");
  await expect(page.locator(".vt-made")).toContainText("Créé avec Décollage");
  expect(await page.locator("body").innerText()).not.toContain("Solo Refusée");
});
