import { expect, test } from "@playwright/test";
import { THEME_IDS } from "@/lib/boutique/themes";
import { MARQUE } from "./mock-supabase";
import { MENTION, ouvrirBandeau, sansIdentifiantsTechniques } from "./helpers";

// Bandeau cookies : nom du client en marque blanche (six thèmes), informations légales conservées, comportement inchangé sans le droit.
for (const theme of THEME_IDS) {
  test(`bandeau cookies, boutique en marque blanche, thème ${theme} : nom du client, infos légales, aucune marque Décollage`, async ({ page }, info) => {
    await page.goto(`/b/marque-${theme}`, { waitUntil: "domcontentloaded" });
    await ouvrirBandeau(page); // bouton ajouté au pied de la boutique
    const dialog = page.locator("dialog.consent");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`${MARQUE.nom} n'utilise aucun cookie ni traceur facultatif`);
    const texte = sansIdentifiantsTechniques(await dialog.innerText());
    expect(texte).not.toMatch(MENTION);
    // Informations légales conservées : les quatre éléments nécessaires, la durée, les liens vers les pages légales.
    await expect(dialog.locator(".consent-list li")).toHaveCount(4);
    await expect(dialog).toContainText("Cookie de session");
    await expect(dialog).toContainText("pendant 6 mois");
    await expect(dialog.getByRole("link", { name: "page Cookies" })).toHaveAttribute("href", "/cookies");
    await expect(dialog.getByRole("link", { name: "confidentialité" })).toHaveAttribute("href", "/confidentialite");
    // Le panneau tient dans l'écran (mobile comme bureau).
    const box = (await dialog.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    await page.screenshot({ path: `test-results/captures/cookies-${theme}-${info.project.name}.png` });
    await dialog.getByRole("button", { name: "Fermer", exact: true }).last().click();
    await expect(dialog).toBeHidden();
  });
}

test("les liens légaux du bandeau en marque blanche mènent aux vraies pages légales", async ({ page }) => {
  await page.goto("/b/marque-vitrine", { waitUntil: "domcontentloaded" });
  await ouvrirBandeau(page);
  await page.locator("dialog.consent").getByRole("link", { name: "page Cookies" }).click();
  await expect(page).toHaveURL(/\/cookies$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("pied de boutique en marque blanche : liens Cookies et Confidentialité présents, sans marque", async ({ page }) => {
  await page.goto("/b/marque-atelier", { waitUntil: "domcontentloaded" });
  const pied = page.locator(".vt-legal");
  await expect(pied.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/cookies");
  await expect(pied.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("href", "/confidentialite");
  expect(await pied.innerText()).not.toMatch(MENTION);
});

test("bandeau cookies SANS droit (boutique Découverte) : inchangé, nom Décollage", async ({ page }) => {
  await page.goto("/b/libre-classique", { waitUntil: "domcontentloaded" });
  await ouvrirBandeau(page, "evenement");
  const dialog = page.locator("dialog.consent");
  await expect(dialog).toContainText("Aujourd'hui, Décollage n'utilise aucun cookie");
  await expect(dialog).not.toContainText(MARQUE.nom);
});

test("bandeau cookies de la plateforme (accueil) : inchangé", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await ouvrirBandeau(page);
  await expect(page.locator("dialog.consent")).toContainText("Aujourd'hui, Décollage n'utilise aucun cookie");
});

test("le nom du client ne persiste pas après avoir quitté la boutique", async ({ page }) => {
  await page.goto("/b/marque-classique", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Cookies", exact: true }).click(); // navigation côté client vers /cookies
  await expect(page).toHaveURL(/\/cookies$/);
  await ouvrirBandeau(page);
  const dialog = page.locator("dialog.consent");
  await expect(dialog).toContainText("Décollage n'utilise aucun cookie");
  await expect(dialog).not.toContainText(MARQUE.nom);
});
