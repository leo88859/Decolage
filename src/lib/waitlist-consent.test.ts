import { describe, expect, it } from "vitest";
import { LAYOUTS, renderLanding } from "@/lib/landing";
import { newProjectFromIdee } from "@/lib/project";
import { LANDING_LAYOUTS } from "@/lib/types";
import { WAITLIST_CONSENT_FIELD, WAITLIST_CONSENT_VERSION, hasConsent, waitlistConsentText } from "@/lib/waitlist-consent";

// Page publique : la case de consentement est présente, obligatoire, et le texte nomme l'éditeur et le but.
const projet = () => newProjectFromIdee({ idee: "boutique de bougies artisanales", type: "boutique", secteur: "artisanat", nom: "Bougie Lune", design: "vitrine" });

describe("liste d'attente : case de consentement dans la page publique", () => {
  it.each(LANDING_LAYOUTS)("mise en page « %s » : case obligatoire, texte clair, aucune case pré-cochée", (layout) => {
    expect(Object.keys(LAYOUTS)).toContain(layout);
    const x = projet();
    const html = renderLanding(x.config, { ...x.landing, layout }, null, { inlineCss: true, contenu: x.contenu, waitlist: { action: "/api/waitlist/mon-site" } });
    const box = html.match(new RegExp(`<input type="checkbox" name="${WAITLIST_CONSENT_FIELD}"[^>]*>`))?.[0] ?? "";
    expect(box).toContain("required");
    expect(box).not.toMatch(/checked/);
    expect(html).toContain("transmise à l’éditeur de « Bougie Lune »");
    expect(html).toContain("prévenir du lancement");
  });

  it("le texte nomme le propriétaire, dit pourquoi et ne promet rien de plus (pas d'e-mail de Décollage, pas de newsletter)", () => {
    const t = waitlistConsentText("Bougie Lune");
    expect(t).toMatch(/éditeur de « Bougie Lune »/);
    expect(t).toMatch(/prévenir du lancement/);
    expect(t).toMatch(/Décollage, qui ne m’écrit pas/);
    expect(t).not.toMatch(/newsletter|offres|partenaires|promotion/i);
  });

  it("le nom du site est échappé dans la page (pas d'injection HTML)", () => {
    const x = projet();
    const html = renderLanding({ ...x.config, nom: '<img src=x onerror=alert(1)>' }, x.landing, null, { inlineCss: true, contenu: x.contenu, waitlist: { action: "/api/waitlist/mon-site" } });
    expect(html).not.toContain("<img src=x onerror");
  });

  it("hasConsent n'accepte que les valeurs d'une case cochée", () => {
    for (const ok of ["oui", "on", "1", "true", " OUI "]) expect(hasConsent(ok)).toBe(true);
    for (const ko of ["", "non", "0", "false", null, undefined, 1, true, "peut-être"]) expect(hasConsent(ko)).toBe(false);
    expect(WAITLIST_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
