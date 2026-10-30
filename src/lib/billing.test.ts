import { describe, expect, it } from "vitest";
import { analyzeSubscription, resolvePlan } from "@/lib/billing";
import { whiteLabelAllowed } from "@/lib/plans";

const prices = { solo: "price_solo", pro: "price_pro", illimite: "price_ill" };
const BRAND = "price_brand";

describe("analyzeSubscription : tous les éléments, formule principale distincte de l'option", () => {
  it("formule reconnue, quel que soit son rang parmi les éléments", () => {
    expect(analyzeSubscription("active", ["price_solo"], prices, BRAND)).toMatchObject({ plan: "solo", brandOption: false, unknownPrices: [] });
    expect(analyzeSubscription("trialing", [BRAND, "price_pro"], prices, BRAND)).toMatchObject({ plan: "pro", brandOption: true });
    expect(analyzeSubscription("past_due", ["price_ill", BRAND], prices, BRAND).plan).toBe("illimite");
  });

  it("(7) un prix inconnu ou un supplément inconnu n'accorde jamais de formule", () => {
    expect(analyzeSubscription("active", ["price_inconnu"], prices, BRAND)).toMatchObject({ plan: null, unknownPrices: ["price_inconnu"] });
    expect(analyzeSubscription("active", [], prices, BRAND).plan).toBeNull();
    expect(analyzeSubscription("active", [undefined, null], prices, BRAND).plan).toBeNull();
    expect(analyzeSubscription("active", ["price_supp", "price_solo"], prices, BRAND)).toMatchObject({ plan: "solo", unknownPrices: ["price_supp"] });
  });

  it("(7) variables d'environnement vides : un prix ne correspond jamais à « undefined » (pas d'Illimité par défaut)", () => {
    expect(analyzeSubscription("active", ["price_solo"], {}, undefined).plan).toBeNull();
    expect(analyzeSubscription("active", ["price_ill"], { solo: "price_solo" }, undefined).plan).toBeNull();
  });

  it("(8) l'option marque blanche seule n'accorde aucune formule ; avec Solo, la formule reste Solo", () => {
    const seule = analyzeSubscription("active", [BRAND], prices, BRAND);
    expect(seule).toMatchObject({ plan: null, brandOption: true, unknownPrices: [] });
    expect(analyzeSubscription("active", [BRAND, "price_solo"], prices, BRAND).plan).toBe("solo");
    // sans variable STRIPE_PRICE_BRAND, l'option est un prix inconnu : toujours aucune formule
    expect(analyzeSubscription("active", [BRAND], prices, undefined)).toMatchObject({ plan: null, brandOption: false, unknownPrices: [BRAND] });
  });

  it("plusieurs formules : la moins chère", () => {
    expect(analyzeSubscription("active", ["price_ill", "price_pro"], prices, BRAND)).toMatchObject({ plan: "pro", ambiguous: true });
  });

  it("abonnement inactif : Gratuit, sans option", () => {
    for (const status of ["canceled", "incomplete_expired", "unpaid", null, undefined]) {
      expect(analyzeSubscription(status, ["price_ill", BRAND], prices, BRAND)).toMatchObject({ plan: "gratuit", brandOption: false });
    }
  });
});

describe("anciens prix (STRIPE_PRICE_*_LEGACY) : reconnus comme la même formule, sans rien accorder de plus", () => {
  const legacy = { pro: ["price_pro_990", "price_pro_autre"] };
  it("un abonné Pro à l'ancien prix reste Pro (au lieu de tomber en Gratuit)", () => {
    expect(analyzeSubscription("active", ["price_pro_990"], prices, BRAND, legacy)).toMatchObject({ plan: "pro", unknownPrices: [] });
    expect(resolvePlan(analyzeSubscription("active", ["price_pro_990"], prices, BRAND, legacy), { plan: "gratuit", subscriptionId: null }, "sub_1")).toBe("pro");
  });
  it("sans liste (comportement actuel) : l'ancien prix reste un prix inconnu, jamais une formule", () => {
    expect(analyzeSubscription("active", ["price_pro_990"], prices, BRAND)).toMatchObject({ plan: null, unknownPrices: ["price_pro_990"] });
    expect(analyzeSubscription("active", ["price_pro_990"], prices, BRAND, {})).toMatchObject({ plan: null });
  });
  it("un ancien prix Pro n'accorde que Pro ; un prix qui n'est dans aucune liste reste inconnu ; abonnement inactif : Gratuit", () => {
    expect(analyzeSubscription("active", ["price_ill_ancien"], prices, BRAND, legacy)).toMatchObject({ plan: null, unknownPrices: ["price_ill_ancien"] });
    expect(analyzeSubscription("canceled", ["price_pro_990"], prices, BRAND, legacy)).toMatchObject({ plan: "gratuit" });
  });
  it("ancien et nouveau prix Pro ensemble : une seule formule (Pro), pas d'ambiguïté inventée", () => {
    expect(analyzeSubscription("active", ["price_pro_990", "price_pro"], prices, BRAND, legacy)).toMatchObject({ plan: "pro", ambiguous: false });
  });
});

describe("resolvePlan : formule inconnue = jamais de montée en gamme", () => {
  const inconnu = analyzeSubscription("active", ["price_inconnu"], prices, BRAND);
  it("nouvel abonnement inconnu : Gratuit", () => {
    expect(resolvePlan(inconnu, { plan: "gratuit", subscriptionId: null }, "sub_1")).toBe("gratuit");
    expect(resolvePlan(inconnu, { plan: "illimite", subscriptionId: "sub_ancien" }, "sub_1")).toBe("gratuit");
  });
  it("même abonnement déjà connu : formule précédente conservée", () => {
    expect(resolvePlan(inconnu, { plan: "pro", subscriptionId: "sub_1" }, "sub_1")).toBe("pro");
  });
  it("formule reconnue : elle l'emporte", () => {
    expect(resolvePlan(analyzeSubscription("active", ["price_solo"], prices), { plan: "illimite", subscriptionId: "sub_1" }, "sub_1")).toBe("solo");
  });
});

describe("(8) la marque blanche est un droit distinct de la formule", () => {
  it("Solo sans option : non ; Solo avec option : oui ; Pro et Illimité : inclus ; Gratuit : jamais", () => {
    expect(whiteLabelAllowed("solo", false)).toBe(false);
    expect(whiteLabelAllowed("solo", true)).toBe(true);
    expect(whiteLabelAllowed("pro", false)).toBe(true);
    expect(whiteLabelAllowed("illimite", false)).toBe(true);
    expect(whiteLabelAllowed("gratuit", true)).toBe(false);
  });
});
