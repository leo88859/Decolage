import { COPIES, TYPE_WORD } from "@/data/copies";
import { DEMO } from "@/data/demo";
import { designFor } from "@/data/designs";
import { detectFonctions, motsDeclencheurs } from "@/lib/fonctions";
import { IDEAS } from "@/data/ideas";
import { PRENOMS, SECTEUR_BY_ID, SECTEUR_GENERAL, SECTEURS, VILLES, type Secteur } from "@/data/secteurs";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { matchIdeas, norm, stem, tokens } from "@/lib/match";
import type { Contenu, TemplateId } from "@/lib/types";

// Remplissage d'un SaaS à partir d'une idée, SANS IA : détection du type de SaaS et du secteur
// par mots-clés, puis assemblage de textes et de données à partir des packs écrits à l'avance.
// Même idée = même résultat.

// ─── Détection du type de SaaS ───
const TYPE_KEYWORDS: [TemplateId, string[]][] = [
  ["liste-attente", ["liste d'attente", "waitlist", "prelancement", "pre-lancement", "beta", "avant-premiere", "inscription au lancement"]],
  ["tickets", ["support", "ticket", "sav", "reclamation", "panne", "depann", "assistance", "incident", "probleme technique"]],
  ["documents", ["devis", "factur", "document", "contrat", "attestation", "pdf", "generer des"]],
  ["formulaires", ["formulaire", "sondage", "questionnaire", "enquete", "feedback", "vote", "recolter des avis", "avis client"]],
  ["portail-client", ["portail", "espace client", "dossier", "livrable", "avancement", "suivi de dossier"]],
  ["suivi-gains", ["argent", "budget", "depens", "gain", "revenu", "epargn", "economis", "financ", "thune"]],
  ["boutique", ["vendre", "vend", "vente", "boutique", "shop", "e-commerce", "ecommerce", "produit", "commande", "panier", "catalogue", "acheter", "achat", "click and collect"]],
  ["reservations", ["louer", "location", "salle", "materiel", "equipement", "emprunt", "pret de", "place de", "terrain", "vehicule"]],
  ["rendez-vous", ["reserv", "rendez", "rdv", "creneau", "agenda", "booking", "prendre rendez"]],
  ["crm", ["prospect", "crm", "relanc", "pipeline", "commercial", "fidelis", "carte de fidelite", "gestion des clients", "fichier client"]],
  ["formation", ["formation", "apprendre", "apprend", "lecon", "e-learning", "tutoriel", "masterclass", "programme en ligne", "cours en ligne"]],
  ["abonnement", ["abonnement", "membre", "communaute", "exclusif", "fan", "contenu premium", "box mensuelle", "patreon"]],
  ["annuaire", ["annuaire", "repertoire", "trouver un", "trouver des", "comparer", "carte des", "recens", "liste des"]],
  ["projets", ["projet", "equipe", "jalon", "collabor", "chantier"]],
  ["ressources", ["ressource", "bibliotheq", "modele", "kit", "telecharg", "fiche", "partager des"]],
  ["taches", ["tache", "todo", "to-do", "organis", "productiv", "routine", "rappel", "planifier", "planning"]],
];

export function detectType(idee: string): { type: TemplateId; score: number } {
  const t = ` ${norm(idee)} `;
  const words = tokens(idee);
  let best: { type: TemplateId; score: number } | null = null;
  for (const [type, keys] of TYPE_KEYWORDS) {
    let score = 0;
    for (const k of keys) {
      if (k.includes(" ") || k.includes("-") || k.includes("'")) { if (t.includes(k)) score += 3; }
      else if (words.some((w) => w.startsWith(k) || (w.length >= 4 && k.startsWith(w)))) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { type, score };
  }
  if (best) return best;
  // Repli : l'idée du catalogue la plus proche indique le type de produit.
  const m = matchIdeas(idee, IDEAS, 1)[0];
  return { type: m?.idea.template ?? "rendez-vous", score: 0 };
}

export function detectSecteur(idee: string): Secteur {
  const words = tokens(idee);
  let best: { s: Secteur; score: number } | null = null;
  for (const s of SECTEURS) {
    const score = s.mots.reduce((n, m) => n + (words.some((w) => w.startsWith(m) || (w.length >= 4 && m.startsWith(w))) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s ?? SECTEUR_GENERAL;
}

// ─── Utilitaires déterministes ───
export const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const rot = <T,>(arr: T[], k: number) => arr.map((_, i) => arr[(i + k) % arr.length]!);
const euros = (n: number) => (n === 0 ? "Gratuit" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
const lastName = (full: string) => full.split(" ").slice(-1)[0]!;
const firstName = (full: string) => full.split(" ")[0]!;
const email = (full: string) => `${norm(firstName(full)).replace(/[^a-z]/g, "")}@exemple.fr`;

/** Noms proposés pour le SaaS, construits à partir des mots de l'idée. */
export function suggestNames(idee: string, type: TemplateId, secteur: Secteur): string[] {
  const words = tokens(idee);
  const word = words.find((w) => secteur.mots.some((m) => w.startsWith(m))) ?? words.find((w) => w.length >= 4) ?? norm(secteur.nom).replace(/[^a-z]/g, "");
  const root = cap(stem(word).slice(0, 7).replace(/[^a-z0-9]/g, "")) || "Neo";
  const join = (a: string, b: string) => (/[aeiouy]$/i.test(a) && /^[aeiouy]/i.test(b) ? a + b.slice(1) : a + b);
  const [w1, w2] = TYPE_WORD[type];
  const list = [join(root, "io"), `${w1}${root}`, `${root}Hub`, `Mon${root}`, join(root, "ly"), `${root} ${w2}`, `${root}Go`, join(root, "eo")];
  const unique = [...new Set(list.map((n) => n.slice(0, 40)))];
  return rot(unique, hash(idee) % unique.length).slice(0, 6);
}

export function fill(text: string, s: Secteur, nom: string): string {
  return text
    .replaceAll("{nom}", nom)
    .replaceAll("{clients}", s.clients)
    .replaceAll("{client}", s.client)
    .replaceAll("{pros}", s.pros)
    .replaceAll("{metier}", s.metier)
    .replaceAll("{lieu}", s.lieu)
    .replaceAll("{action}", s.action)
    .replaceAll("{douleur}", s.douleur)
    .replaceAll("{benefice}", s.benefice)
    .replaceAll("{offre}", s.offres[0]![0].toLowerCase())
    .replaceAll("{categorie}", s.categories[0]!.toLowerCase())
    .replace(/(^|\s)à les(?=\s)/g, "$1aux")
    .replace(/(^|\s)de les(?=\s)/g, "$1des")
    .replace(/(^|\s)de un(?=\s)/g, "$1d'un")
    .replace(/\s{2,}/g, " ");
}

// Types dont la colonne « statut » est en réalité une catégorie du secteur.
const CATEGORY_STATUS: TemplateId[] = ["annuaire", "suivi-gains", "ressources", "formulaires"];

/** Lignes d'exemple adaptées au secteur, en gardant le format attendu par chaque page (dates, prix, %). */
function rows(type: TemplateId, s: Secteur, h: number): string[][] {
  const demo = DEMO[type].rows;
  const names = rot(PRENOMS, h % PRENOMS.length);
  const offres = rot(s.offres, h % s.offres.length);
  const cats = s.categories;
  const villes = rot(VILLES, h % VILLES.length);
  const company = (i: number) => `${cap(s.lieu)} ${lastName(names[(i + 3) % names.length]!)}`;
  return demo.map((d, i) => {
    const n = names[i % names.length]!;
    const [o, prix] = offres[i % offres.length]!;
    const cat = cats[i % cats.length]!;
    switch (type) {
      case "rendez-vous": return [n, d[1]!, o, d[3]!];
      case "abonnement": return [[`Les bases : ${cat.toLowerCase()}`, `Atelier vidéo : ${o.toLowerCase()}`, `Modèle à télécharger : ${cat.toLowerCase()}`, "Live questions-réponses", `Check-list : ${cat.toLowerCase()}`, `Étude de cas : ${o.toLowerCase()}`][i]!, d[1]!, d[2]!, d[3]!];
      case "annuaire": return [company(i), cat, villes[i % villes.length]!, d[3]!];
      case "liste-attente": return [email(n), d[1]!, d[2]!, d[3]!];
      case "boutique": return [o, euros(prix), d[2]!, d[3]!];
      case "reservations": return [o, d[1]!, firstName(n), d[3]!];
      case "suivi-gains": {
        if (s.id === "budget") return i === 0 ? [d[0]!, "Revenu du mois", cats[0]!, "+850 €"] : [d[0]!, o, cats[1 + (i % (cats.length - 1))]!, `−${euros(prix)}`];
        return [d[0]!, o, cat, `+${euros(prix)}`];
      }
      case "crm": return [n, company(i), d[2]!, d[3]!];
      case "taches": return [[`Préparer : ${o.toLowerCase()}`, `Rappeler ${firstName(n)}`, `Commander pour : ${cat.toLowerCase()}`, "Publier sur les réseaux", "Mettre à jour les tarifs", "Répondre aux messages"][i]!, d[1]!, d[2]!, d[3]!];
      case "formation": return [[`Introduction : ${cats[0]!.toLowerCase()}`, `Les bases : ${cat.toLowerCase()}`, `Exercice pratique : ${o.toLowerCase()}`, `Aller plus loin : ${cat.toLowerCase()}`, `Cas réel : ${o.toLowerCase()}`, "Bilan final"][i]!, d[1]!, d[2]!, d[3]!];
      case "ressources": return [[`Modèle : ${o.toLowerCase()}`, `Guide : ${cat.toLowerCase()}`, `Check-list : ${cat.toLowerCase()}`, `Grille de tarifs`, `Planning type`, `Fiche conseil : ${o.toLowerCase()}`][i]!, d[1]!, cat, d[3]!];
      case "documents": return [`${d[1]} ${lastName(n)}`, d[1]!, d[2]!, d[3]!];
      case "projets": return [[`Lancement : ${cat.toLowerCase()}`, `Nouvelle offre : ${o.toLowerCase()}`, `Refonte du ${s.lieu}`, "Campagne réseaux sociaux", `Partenariat ${villes[0]}`, "Site internet"][i]!, firstName(n), d[2]!, d[3]!];
      case "portail-client": return [o, company(i), d[2]!, d[3]!];
      case "formulaires": return [d[0]!, firstName(n), cat, d[3]!];
      case "tickets": return [[`Question sur : ${o.toLowerCase()}`, "Impossible de me connecter", "Modifier ma réservation", "Erreur de paiement", "Demande de facture", "Suggestion d'amélioration"][i]!, firstName(n), d[2]!, d[3]!];
    }
  });
}

/** Contenu complet d'un SaaS, à partir de l'idée, du type, du secteur et du nom choisis. */
export function buildContenu(idee: string, type: TemplateId, secteurId: string): Contenu {
  const s = SECTEUR_BY_ID[secteurId] ?? SECTEUR_GENERAL;
  const t = TEMPLATE_BY_ID[type];
  const demo = DEMO[type];
  const c = COPIES[type];
  const h = hash(`${norm(idee)}|${type}|${s.id}`);
  // {nom} reste une variable : les textes suivent si le SaaS est renommé plus tard.
  const f = (x: string) => fill(x, s, "{nom}");
  const statuts = CATEGORY_STATUS.includes(type) ? [...s.categories] : [...demo.statuses];
  const scale = 0.8 + (h % 50) / 100; // 0,8 à 1,3 : chaque idée a ses propres chiffres
  return {
    source: "modele",
    type,
    secteur: s.id,
    idee: idee.slice(0, 600),
    entite: { nom: t.entite.nom, pluriel: t.entite.pluriel, champs: t.entite.champs.map((x) => (x === "Client" ? cap(s.client) : x)) },
    lignes: rows(type, s, h),
    statuts,
    kpis: demo.kpis.map(([l, v, u, d]): [string, number, string, number] => [l.replace(/\bclients\b/i, s.clients), v % 1 || u === "%" || u === "/5" ? v : Math.max(1, Math.round(v * scale)), u, d]),
    serie: demo.serie,
    fonctionnalites: c.features.map(([a, b]) => [f(a), f(b)]),
    copy: {
      heroTitre: f(c.heroTitre[h % c.heroTitre.length]!),
      heroSous: f(c.heroSous),
      etapes: c.etapes.map(([a, b]) => [f(a), f(b)]),
      avantages: c.avantages.map(f),
      faq: c.faq.map(([a, b]) => [f(a), f(b)]),
      cta: f(c.cta),
    },
  };
}

/** Cible et description du SaaS pour la configuration. */
export function cibleEtDescription(type: TemplateId, secteurId: string, nom: string) {
  const s = SECTEUR_BY_ID[secteurId] ?? SECTEUR_GENERAL;
  const c = COPIES[type];
  const cible = cap(s.pros);
  const description = fill(c.heroSous, s, nom).slice(0, 220);
  return { cible: cible.slice(0, 120), description };
}

/** Tout en une fois : ce que la page « Créer » affiche dès que l'idée est tapée. */
export function analyse(idee: string) {
  // Les mots qui décrivent une fonction (« rappels », « factures »…) ne doivent pas décider du type de SaaS,
  // sauf s'il ne reste rien d'autre pour le décider.
  const trig = motsDeclencheurs(idee);
  let t = ` ${norm(idee).replace(/[^a-z0-9-]+/g, " ")} `;
  for (const m of trig) if (m.includes(" ")) t = t.replaceAll(m, " ");
  const sans = t.split(" ").filter((w) => w && !trig.has(w)).join(" ");
  const first = trig.size ? detectType(sans) : null;
  const { type, score } = first && first.score > 0 ? first : detectType(idee);
  const secteur = detectSecteur(idee);
  return {
    type, secteur, sure: score > 0 && secteur.id !== "general", noms: suggestNames(idee, type, secteur),
    fonctions: detectFonctions(idee).map((x) => x.f.id),
    design: designFor(type, secteur.id).id,
  };
}
