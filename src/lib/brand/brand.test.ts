import { describe, expect, it } from "vitest";
import { isAllowListed, parseAllowList } from "./access";
import { brandContrast, onPrimary } from "./contrast";
import { brandToCssObject, brandToCssVars } from "./css";
import { normalizeHost, resolveBrandFromHost, type BrandDomainRow } from "./hosts";
import { DEFAULT_BRAND, FAVICON_MAX_BYTES, LOGO_MAX_BYTES } from "./types";
import { dataUrl, jpegBytes, pngBytes, webpBytes } from "./test-utils";
import { sniffImage, validateBrand, validateColor, validateFavicon, validateLogo, validateName } from "./validate";

const textUrl = (mime: string, text: string) => `data:${mime};base64,${Buffer.from(text).toString("base64")}`;

describe("nom de la marque", () => {
  it("accepte 1 à 40 caractères et nettoie les espaces", () => {
    expect(validateName("  Ma   Marque ")).toEqual({ ok: true, value: "Ma Marque" });
    expect(validateName("a").ok).toBe(true);
    expect(validateName("é".repeat(40)).ok).toBe(true);
  });
  it("refuse vide, trop long, non texte", () => {
    expect(validateName("").ok).toBe(false);
    expect(validateName("   ").ok).toBe(false);
    expect(validateName("x".repeat(41)).ok).toBe(false);
    expect(validateName(42).ok).toBe(false);
    expect(validateName(null).ok).toBe(false);
  });
  it("refuse les balises (XSS) et les caractères invisibles ou de contrôle", () => {
    expect(validateName("<script>alert(1)</script>").ok).toBe(false);
    expect(validateName("<img src=x onerror=alert(1)>").ok).toBe(false);
    expect(validateName("a>b").ok).toBe(false);
    expect(validateName("abc\u0000def").ok).toBe(false);
    expect(validateName("abc‮evil").ok).toBe(false);
    expect(validateName("zero​width").ok).toBe(false);
  });
});

describe("couleurs", () => {
  it("accepte #rrggbb et normalise en minuscules", () => {
    expect(validateColor("#2F5BFF")).toEqual({ ok: true, value: "#2f5bff" });
  });
  it("refuse tout le reste", () => {
    for (const bad of ["#fff", "2f5bff", "#2f5bf", "#2f5bffaa", "red", "rgb(0,0,0)", "#2f5bff;}", "url(x)", "#gggggg", "", null, 12, {}]) {
      expect(validateColor(bad).ok, String(bad)).toBe(false);
    }
  });
});

describe("images : octets magiques, format et taille", () => {
  it("reconnaît PNG, JPEG et WebP d'après les octets", () => {
    expect(sniffImage(pngBytes())).toBe("png");
    expect(sniffImage(jpegBytes())).toBe("jpeg");
    expect(sniffImage(webpBytes())).toBe("webp");
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it("accepte un logo PNG, JPEG, WebP valide", () => {
    expect(validateLogo(dataUrl("image/png", pngBytes())).ok).toBe(true);
    expect(validateLogo(dataUrl("image/jpeg", jpegBytes())).ok).toBe(true);
    expect(validateLogo(dataUrl("image/webp", webpBytes())).ok).toBe(true);
  });
  it("refuse un faux PNG (texte renommé), un type qui ne correspond pas aux octets", () => {
    expect(validateLogo(textUrl("image/png", "ceci n'est pas une image")).ok).toBe(false);
    expect(validateLogo(dataUrl("image/jpeg", pngBytes())).ok).toBe(false);
    expect(validateLogo(dataUrl("image/png", jpegBytes())).ok).toBe(false);
    expect(validateLogo(dataUrl("image/png", new Uint8Array(0))).ok).toBe(false);
  });
  it("refuse le SVG, quel que soit son déguisement", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    expect(validateLogo(textUrl("image/svg+xml", svg)).ok).toBe(false);
    expect(validateLogo(textUrl("image/png", svg)).ok).toBe(false);
    expect(validateLogo(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`).ok).toBe(false);
    expect(validateFavicon(textUrl("image/svg+xml", svg)).ok).toBe(false);
  });
  it("refuse les schémas autres que data:image (http, javascript, data:text/html)", () => {
    expect(validateLogo("https://exemple.fr/logo.png").ok).toBe(false);
    expect(validateLogo("javascript:alert(1)").ok).toBe(false);
    expect(validateLogo(textUrl("text/html", "<script>1</script>")).ok).toBe(false);
    expect(validateLogo("data:image/png;base64,@@@@").ok).toBe(false);
    expect(validateLogo(12).ok).toBe(false);
  });
  it("applique la limite de taille décodée (200 Ko logo, 50 Ko favicon)", () => {
    expect(validateLogo(dataUrl("image/png", pngBytes(LOGO_MAX_BYTES))).ok).toBe(true);
    expect(validateLogo(dataUrl("image/png", pngBytes(LOGO_MAX_BYTES + 1))).ok).toBe(false);
    expect(validateLogo(dataUrl("image/png", pngBytes(5_000_000))).ok).toBe(false);
    expect(validateFavicon(dataUrl("image/png", pngBytes(FAVICON_MAX_BYTES))).ok).toBe(true);
    expect(validateFavicon(dataUrl("image/png", pngBytes(FAVICON_MAX_BYTES + 1))).ok).toBe(false);
  });
  it("le favicon doit être un PNG", () => {
    expect(validateFavicon(dataUrl("image/jpeg", jpegBytes())).ok).toBe(false);
    expect(validateFavicon(dataUrl("image/webp", webpBytes())).ok).toBe(false);
    expect(validateFavicon(dataUrl("image/png", pngBytes())).ok).toBe(true);
  });
});

describe("marque complète", () => {
  const ok = { ...DEFAULT_BRAND, name: "Acme" };
  it("accepte une marque valide et ignore les champs inconnus (dont user_id)", () => {
    const r = validateBrand({ ...ok, user_id: "00000000-0000-4000-8000-0000000000ff", admin: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.brand).toEqual(ok);
      expect(Object.keys(r.brand)).not.toContain("user_id");
    }
  });
  it("signale chaque champ fautif", () => {
    const r = validateBrand({ ...ok, name: "<b>", primary: "bleu", logo: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["logo", "name", "primary"]);
  });
  it("refuse un corps qui n'est pas un objet", () => {
    expect(validateBrand(null).ok).toBe(false);
    expect(validateBrand("x").ok).toBe(false);
    expect(validateBrand([]).ok).toBe(false);
  });
});

describe("brandToCssVars : jamais de CSS libre", () => {
  it("écrit les couleurs valides", () => {
    const css = brandToCssVars(DEFAULT_BRAND);
    expect(css).toContain("--brand-primary:#2f5bff;");
    expect(css).toContain("--brand-on-primary:");
  });
  it("remplace toute valeur piégée par la valeur par défaut", () => {
    const evil = "#fff;}</style><script>alert(1)</script>";
    const css = brandToCssVars({ ...DEFAULT_BRAND, primary: evil, secondary: "url(javascript:alert(1))", accent: "red;background:url(//x)", surface: "expression(1)", text: "\"onload=\"x" });
    expect(css).not.toMatch(/[<>"'()\\]|script|url|expression|javascript/i);
    expect(css).toContain(`--brand-primary:${DEFAULT_BRAND.primary};`);
    expect(css).toContain(`--brand-secondary:${DEFAULT_BRAND.secondary};`);
  });
  it("ne contient que des déclarations --brand-* à valeurs #rrggbb", () => {
    for (const [k, v] of Object.entries(brandToCssObject({ primary: "{}", secondary: 5, accent: null, surface: undefined, text: "#ABCDEF" }))) {
      expect(k).toMatch(/^--brand-[a-z-]+$/);
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("ne contient ni le nom ni les images", () => {
    expect(brandToCssVars({ ...DEFAULT_BRAND, name: "<script>", logo: "data:image/png;base64,AAAA" } as never)).not.toMatch(/script|data:/);
  });
});

describe("contraste de la marque", () => {
  it("la palette par défaut passe", () => {
    const r = brandContrast(DEFAULT_BRAND);
    expect(r.pairs.every((p) => p.id === "primary-dark" || p.ok)).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it("avertit quand la couleur principale ne passe ni avec le clair ni avec le sombre", () => {
    const r = brandContrast({ ...DEFAULT_BRAND, primary: "#808080", text: "#777777" });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toMatch(/4,5:1/);
  });
  it("n'avertit pas si au moins un des deux textes passe", () => {
    expect(brandContrast({ ...DEFAULT_BRAND, primary: "#ffe08a" }).warnings).toEqual([]); // texte sombre OK
    expect(brandContrast({ ...DEFAULT_BRAND, primary: "#0a1433" }).warnings).toEqual([]); // texte blanc OK
  });
  it("avertit si le texte est illisible sur le fond", () => {
    expect(brandContrast({ ...DEFAULT_BRAND, text: "#f6f1e6" }).warnings.some((w) => /fond/.test(w))).toBe(true);
  });
  it("choisit blanc ou texte sombre sur la couleur principale", () => {
    expect(onPrimary({ ...DEFAULT_BRAND, primary: "#0a1433" })).toBe("#ffffff");
    expect(onPrimary({ ...DEFAULT_BRAND, primary: "#ffe08a" })).toBe(DEFAULT_BRAND.text);
  });
});

describe("résolution d'hôte (non branchée dans proxy.ts)", () => {
  const table: BrandDomainRow[] = [
    { host: "app.client.com", user_id: "u1", verified: true, active: true },
    { host: "attente.client.com", user_id: "u2", verified: false, active: true },
    { host: "resilie.client.com", user_id: "u3", verified: true, active: false },
    { host: "Casse.Client.com.", user_id: "u4", verified: true, active: true },
  ];
  it("normalise : casse, port, point final", () => {
    expect(normalizeHost("APP.Client.com:443")).toBe("app.client.com");
    expect(normalizeHost("app.client.com.")).toBe("app.client.com");
  });
  it("rejette les hôtes invalides", () => {
    for (const bad of ["", null, undefined, "localhost", "127.0.0.1", "[::1]", "a b.com", "a,b.com", "app.client.com/evil", "é.com", "-a.com", "a..com", "x".repeat(64) + ".com", "app.client.com@evil.com"]) {
      expect(normalizeHost(bad as string), String(bad)).toBeNull();
    }
  });
  it("résout seulement un domaine vérifié ET actif", () => {
    expect(resolveBrandFromHost("app.client.com", table)?.user_id).toBe("u1");
    expect(resolveBrandFromHost("APP.CLIENT.COM:3000", table)?.user_id).toBe("u1");
    expect(resolveBrandFromHost("casse.client.com", table)?.user_id).toBe("u4");
  });
  it("ne résout ni un domaine non vérifié, ni désactivé, ni inconnu", () => {
    expect(resolveBrandFromHost("attente.client.com", table)).toBeNull();
    expect(resolveBrandFromHost("resilie.client.com", table)).toBeNull();
    expect(resolveBrandFromHost("autre.com", table)).toBeNull();
    expect(resolveBrandFromHost("evil-app.client.com", table)).toBeNull();
    expect(resolveBrandFromHost("x.app.client.com", table)).toBeNull(); // pas de joker implicite
    expect(resolveBrandFromHost("app.client.com", [])).toBeNull();
  });
});

describe("liste d'identifiants autorisés (WHITE_LABEL_USER_IDS)", () => {
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000B";
  it("lit les UUID valides et ignore le reste", () => {
    expect(parseAllowList(`${A}, ${B};n-importe-quoi  ${A.slice(0, 10)}`)).toEqual([A, B.toLowerCase()]);
    expect(parseAllowList("")).toEqual([]);
    expect(parseAllowList(undefined)).toEqual([]);
  });
  it("n'autorise personne par défaut", () => {
    expect(isAllowListed(A, undefined)).toBe(false);
    expect(isAllowListed(A, "")).toBe(false);
    expect(isAllowListed(A, B)).toBe(false);
    expect(isAllowListed(B, B.toLowerCase())).toBe(true);
  });
});
