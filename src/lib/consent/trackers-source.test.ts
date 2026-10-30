import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { OPTIONAL_TRACKERS } from "./consent";

// Parcourt le code source et échoue si un script, pixel ou iframe de tiers apparaît sans être déclaré
// dans OPTIONAL_TRACKERS (src/lib/consent/consent.ts) et chargé via loadIfConsented.

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FORBIDDEN: [string, RegExp][] = [
  ["google-analytics", /google-analytics\.com|analytics\.google\.com/i],
  ["googletagmanager", /googletagmanager\.com|\bgtag\s*\(|\bdataLayer\b/i],
  ["facebook / meta pixel", /connect\.facebook\.net|facebook\.com\/tr|\bfbq\s*\(/i],
  ["hotjar", /hotjar/i],
  ["youtube embed", /youtube(-nocookie)?\.com\/embed/i],
  ["publicité Google", /doubleclick\.net|googlesyndication\.com|googleadservices\.com/i],
  ["autres outils d'audience", /plausible\.io|matomo|segment\.(com|io)|mixpanel|amplitude\.com|posthog|clarity\.ms|fullstory|intercom|crisp\.chat|hs-scripts|snap\.licdn|static\.ads-twitter/i],
  ["script externe", /<script[^>]+src=["'`]https?:\/\//i],
  ["iframe externe", /<iframe[^>]+src=["'`]https?:\/\//i],
  ["pixel d'image externe", /<img[^>]+(width|height)=["']?1["']?[^>]+src=["'`]https?:\/\//i],
];

describe("aucun traceur tiers hors du registre OPTIONAL_TRACKERS", () => {
  const files = walk(SRC);
  const declared = OPTIONAL_TRACKERS.flatMap((t) => t.domaines);

  it("le code source est bien parcouru", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("aucun motif de suivi tiers, sauf domaine déclaré dans le registre", () => {
    const hits: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file).split(sep).join("/");
      const text = readFileSync(file, "utf8");
      for (const [nom, re] of FORBIDDEN) {
        const m = text.match(re);
        if (m && !declared.some((d) => m[0].toLowerCase().includes(d.toLowerCase()))) hits.push(`${rel} : ${nom} (${m[0]})`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("le seul tiers connu est Google Fonts (polices des aperçus et des sites publiés), limité à des fichiers précis", () => {
    const ALLOWED = ["lib/config.ts", "lib/site-server.ts"];
    const found = files
      .filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f).split(sep).join("/"))
      .sort();
    expect(found).toEqual(ALLOWED);
  });

  it("le registre est vide aujourd'hui (aucun traceur facultatif) et chaque entrée future a un domaine déclaré", () => {
    expect(OPTIONAL_TRACKERS).toHaveLength(0);
    for (const t of OPTIONAL_TRACKERS) expect(t.domaines.length).toBeGreaterThan(0);
  });
});
