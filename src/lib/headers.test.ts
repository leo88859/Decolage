import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { notFoundPage, SITE_HEADERS } from "./site-server";

// Lecture de la configuration réelle (pas de serveur lancé) : on vérifie les en-têtes que Next.js produira.
describe("en-têtes anti-clickjacking", () => {
  it("toutes les routes de l'application refusent d'être encadrées", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toBe("frame-ancestors 'none'");
    expect(h["content-security-policy"]).not.toMatch(/script-src|default-src/);
    expect(h["x-content-type-options"]).toBe("nosniff");
  });
  it("aucune route n'assouplit la règle (pas de SAMEORIGIN, pas d'exception)", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(JSON.stringify(rules)).not.toMatch(/SAMEORIGIN|frame-ancestors 'self'/);
  });
  it("les sites publiés (/s/…) ne peuvent pas être encadrés non plus", async () => {
    expect(SITE_HEADERS["x-frame-options"]).toBe("DENY");
    expect(SITE_HEADERS["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(notFoundPage().headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("aperçus : encadrés par srcdoc isolé, jamais par URL", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const files = [
    "../components/LivePreview.tsx",
    "../app/projets/[id]/site/page.tsx",
    "../app/creer/page.tsx",
    "../components/DesignGallery.tsx",
    "../components/DesignThumb.tsx",
    "../components/project/LandingTab.tsx",
  ];
  it("chaque iframe de l'application utilise srcDoc et un sandbox sans allow-same-origin", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/<iframe[^>]*\ssrc=/);
      expect(src, f).not.toContain("allow-same-origin");
    }
  });
});
