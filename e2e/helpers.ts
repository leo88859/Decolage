import type { BrowserContext, Page } from "@playwright/test";
import { MOCK_URL, USERS } from "./mock-supabase";

/** « Décollage » (avec ou sans accent), hors noms techniques de stockage (decollage.data.v2…), qui sont des identifiants légaux de cookies. */
export const MENTION = /d[ée]collage/i;
export const sansIdentifiantsTechniques = (t: string) => t.replace(/decollage[.:][\w.:-]+/gi, "");

/** Connecte le navigateur au faux Supabase : cookie de session au format de @supabase/ssr (jeton de test). */
export async function connecter(context: BrowserContext, user: (typeof USERS)[keyof typeof USERS]) {
  const ref = new URL(MOCK_URL).hostname.split(".")[0];
  const session = { access_token: user.token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + user.token, user: { id: user.id, aud: "authenticated" } };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value, domain: "localhost", path: "/" }]);
}

/** Lit une archive ZIP « stored » (celle que produit le site). */
export function lireZip(buf: Buffer): { name: string; content: string }[] {
  const out: { name: string; content: string }[] = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18), nl = buf.readUInt16LE(p + 26), el = buf.readUInt16LE(p + 28);
    out.push({ name: buf.toString("utf8", p + 30, p + 30 + nl), content: buf.toString("utf8", p + 30 + nl + el, p + 30 + nl + el + size) });
    p += 30 + nl + el + size;
  }
  return out;
}

/** Aucun débordement horizontal (mobile) : la page ne dépasse pas la largeur de l'écran. */
export async function sansDebordement(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

/** Ouvre le bandeau cookies : réessaie tant que la page n'est pas hydratée (le clic ou l'événement n'a d'effet qu'ensuite). */
export async function ouvrirBandeau(page: Page, via: "bouton" | "evenement" = "bouton") {
  const { expect } = await import("@playwright/test");
  await expect(async () => {
    if (via === "bouton") await page.getByRole("button", { name: "Gérer mes cookies" }).first().click({ timeout: 2000 });
    else await page.evaluate(() => window.dispatchEvent(new CustomEvent("decollage:consent-open")));
    await expect(page.locator("dialog.consent")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 25_000 });
}
