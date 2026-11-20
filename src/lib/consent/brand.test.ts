import { describe, expect, it, vi } from "vitest";
import { getConsentBrand, getServerConsentBrand, setConsentBrand, subscribeConsentBrand } from "./brand";

describe("nom commercial du bandeau cookies (marque blanche)", () => {
  it("vide par défaut et côté serveur : le bandeau de la plateforme reste inchangé", () => {
    expect(getConsentBrand()).toBeNull();
    expect(getServerConsentBrand()).toBeNull();
  });
  it("prend le nom du client, prévient les abonnés, puis revient à null", () => {
    const l = vi.fn();
    const off = subscribeConsentBrand(l);
    setConsentBrand("  Maison Aurore ");
    expect(getConsentBrand()).toBe("Maison Aurore");
    setConsentBrand("Maison Aurore"); // inchangé : pas de notification en plus
    expect(l).toHaveBeenCalledTimes(1);
    setConsentBrand(null);
    expect(getConsentBrand()).toBeNull();
    setConsentBrand("   "); // un nom vide n'est jamais utilisé
    expect(getConsentBrand()).toBeNull();
    off();
    setConsentBrand("X");
    expect(l).toHaveBeenCalledTimes(2);
    setConsentBrand(null);
  });
});
