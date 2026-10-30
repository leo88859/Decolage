// Liste des paires texte/fond (et composants d'interface) du site, avec leur seuil WCAG.
// Les couleurs viennent des VRAIES variables : on lit le bloc :root de globals.css puis de a11y.css
// (le second l'emporte, comme dans le navigateur), et les accents viennent de accents.ts.
// Quand une couleur est écrite en dur dans une feuille de style (alertes, transparences du blanc sur fond
// sombre), la paire la recopie : le commentaire indique la règle d'origine pour la retrouver.

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { PARCOURS } from "@/data/parcours";
import { CAT_COLORS } from "./accents";
import { ratioOf, THRESHOLD } from "./contrast";

export type Pair = {
  id: string;
  /** Famille, pour le rapport. */
  group: string;
  label: string;
  /** Couleur de l'avant-plan : #hex, rgb(a)() ou var(--nom). */
  fg: string;
  /** Fond : une couleur, ou des calques du plus bas au plus haut. */
  bg: string | string[];
  min: number;
  kind: "texte" | "grand texte" | "composant";
};

// Ordre réel du navigateur : a11y.css est importé en tête de globals.css, donc globals.css a le dernier mot.
export const CSS_FILES = ["src/app/a11y.css", "src/app/globals.css"];

/** Variables CSS déclarées dans les blocs :root, dans l'ordre des fichiers (le dernier gagne). */
export function loadTokens(files: string[] = CSS_FILES, root: string = process.cwd()): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const f of files) {
    let css: string;
    try {
      css = readFileSync(resolvePath(root, f), "utf8");
    } catch {
      continue;
    }
    css = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
      for (const d of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[d[1]!] = d[2]!.trim();
    }
  }
  return tokens;
}

/** Remplace var(--x) par sa valeur (récursif). Lève une erreur si la variable n'existe pas. */
export function resolveColor(expr: string, tokens: Record<string, string>, depth = 0): string {
  if (depth > 8) throw new Error(`Variables circulaires : ${expr}`);
  return expr.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, name: string) => {
    const v = tokens[name];
    if (v === undefined) throw new Error(`Variable CSS inconnue : ${name}`);
    return resolveColor(v, tokens, depth + 1);
  });
}

export type Source = { cats: readonly string[]; parcours: { id: string; couleur: string }[] };
export const currentSource = (): Source => ({ cats: CAT_COLORS, parcours: PARCOURS });

const T = THRESHOLD.text;
const L = THRESHOLD.large;
const U = THRESHOLD.ui;

export function buildPairs(src: Source = currentSource()): Pair[] {
  const P: Pair[] = [];
  const add = (group: string, id: string, label: string, fg: string, bg: string | string[], min: number, kind: Pair["kind"]) => {
    P.push({ id, group, label, fg, bg, min, kind });
  };
  const text = (group: string, id: string, label: string, fg: string, bg: string | string[]) => add(group, id, label, fg, bg, T, "texte");
  const large = (group: string, id: string, label: string, fg: string, bg: string | string[]) => add(group, id, label, fg, bg, L, "grand texte");
  const ui = (group: string, id: string, label: string, fg: string, bg: string | string[]) => add(group, id, label, fg, bg, U, "composant");

  const v = (n: string) => `var(--${n})`;
  const cream = v("cream"), paper = v("paper"), cream2 = v("cream-2"), navy = v("navy"), blue = v("blue"), coral = v("coral");
  const W = "#ffffff";
  const wa = (a: number) => `rgba(255, 255, 255, ${a})`;

  // ── Texte courant ──
  const G1 = "Texte courant";
  for (const [bn, b] of [["crème", cream], ["papier", paper], ["blanc", W], ["cream-2", cream2]] as const) {
    text(G1, `ink-${bn}`, `Texte (--ink) sur ${bn}`, v("ink"), b);
    text(G1, `ink2-${bn}`, `Texte secondaire (--ink-2) sur ${bn}`, v("ink-2"), b);
    text(G1, `mut-${bn}`, `Texte discret (--mut : .mut, .hint, .tiny) sur ${bn}`, v("mut"), b);
  }

  // ── Liens et accents de marque ──
  const G2 = "Liens et accents";
  for (const [bn, b] of [["crème", cream], ["papier", paper], ["blanc", W]] as const) {
    text(G2, `eyebrow-${bn}`, `Surtitre, « + » de la FAQ (--coral-ink) sur ${bn}`, v("coral-ink"), b);
    text(G2, `link-${bn}`, `Lien en ligne (--blue-ink) sur ${bn}`, v("blue-ink"), b);
  }
  text(G2, "fav-hover", "Étoile des favoris survolée (--coral-ink) sur papier", v("coral-ink"), paper);

  // ── Boutons ──
  const G3 = "Boutons";
  text(G3, "btn-primary", "Bouton principal : blanc sur bleu", W, blue);
  text(G3, "btn-coral", "Bouton corail : bleu nuit sur corail", navy, coral);
  text(G3, "btn-dark", "Bouton sombre : blanc sur bleu nuit", W, navy);
  text(G3, "btn-ghost-cream", "Bouton secondaire (fantôme) : encre sur crème", v("ink"), cream);
  text(G3, "btn-ghost-hover", "Bouton secondaire survolé", v("ink"), [cream, "rgba(11, 19, 48, 0.04)"]);
  text(G3, "btn-light", "Bouton clair : encre sur blanc", v("ink"), W);
  text(G3, "btn-danger-cream", "Bouton danger (--bad-ink) sur crème", v("bad-ink"), cream);
  text(G3, "btn-danger-paper", "Bouton danger (--bad-ink) sur papier", v("bad-ink"), paper);
  text(G3, "btn-saved", "Bouton « enregistré » : blanc sur vert (--ok)", W, v("ok"));
  text(G3, "fav-on", "Étoile des favoris active : bleu nuit sur corail", navy, coral); // .dg-fav.on
  text(G3, "icon-btn", "Bouton icône : encre sur papier", v("ink"), paper);

  // ── Badges et pastilles ──
  const G4 = "Badges";
  text(G4, "badge", "Badge bleu : --blue-ink sur --blue-soft", v("blue-ink"), v("blue-soft"));
  text(G4, "badge-coral", "Badge corail : --coral-ink sur --coral-soft", v("coral-ink"), v("coral-soft"));
  text(G4, "badge-ok", "Badge succès : --ok-ink sur --ok-soft", v("ok-ink"), v("ok-soft"));
  text(G4, "badge-warn", "Badge attention : --warn-ink sur --warn-soft", v("warn-ink"), v("warn-soft"));
  text(G4, "badge-bad", "Badge erreur : --bad-ink sur --bad-soft", v("bad-ink"), v("bad-soft"));
  text(G4, "badge-dark", "Badge sombre : blanc sur bleu nuit", W, navy);
  text(G4, "badge-line", "Badge à contour : --ink-2 sur crème", v("ink-2"), cream);
  text(G4, "badge-line-paper", "Badge à contour : --ink-2 sur papier", v("ink-2"), paper);
  text(G4, "badge-line-dark", "Badge à contour dans la fiche sombre (blanc)", W, navy);
  text(G4, "pop", "Pastille « populaire » : bleu nuit sur corail", navy, coral);
  text(G4, "demo-mod", "Module de la démo : --blue-ink sur --blue-soft", v("blue-ink"), v("blue-soft"));

  // ── Messages d'état ──
  const G5 = "Erreurs, succès, alertes";
  text(G5, "err-paper", "Message d'erreur de champ (.err, --bad-ink) sur papier", v("bad-ink"), paper);
  text(G5, "err-white", "Message d'erreur de champ (--bad-ink) sur blanc", v("bad-ink"), W);
  text(G5, "err-cream", "Message d'erreur de champ (--bad-ink) sur crème", v("bad-ink"), cream);
  text(G5, "status-ok", "État « enregistré » du constructeur (--ok-ink) sur papier", v("ok-ink"), paper);
  text(G5, "status-dirty", "État « non enregistré » (--coral-ink) sur papier", v("coral-ink"), paper);
  text(G5, "alert-bad", "Alerte erreur (#7d1b27 sur --bad-soft)", "#7d1b27", v("bad-soft")); // .alert-bad
  text(G5, "alert-warn", "Alerte attention (#6b4106 sur --warn-soft)", "#6b4106", v("warn-soft")); // .alert-warn
  text(G5, "alert-info", "Alerte info (#1b2f8f sur --blue-soft)", "#1b2f8f", v("blue-soft")); // .alert-info
  text(G5, "alert-ok", "Alerte succès (#0b5a3a sur --ok-soft)", "#0b5a3a", v("ok-soft")); // .alert-ok
  text(G5, "db-danger", "Action « supprimer » d'un menu (--bad-ink) sur papier", v("bad-ink"), paper);
  text(G5, "toast", "Notification : blanc sur bleu nuit", W, navy);
  text(G5, "toast-icon-ok", "Icône de notification (succès) : blanc sur vert", W, v("ok"));
  text(G5, "toast-icon-bad", "Icône de notification (erreur) : blanc sur rouge", W, v("bad"));
  text(G5, "check-tick", "Coche des cases : blanc sur vert", W, v("ok"));

  // ── Champs de formulaire ──
  const G6 = "Champs";
  text(G6, "input", "Saisie dans un champ : encre sur blanc", v("ink"), W);
  text(G6, "label", "Étiquette de champ (--ink-2) sur papier", v("ink-2"), paper);
  text(G6, "label-white", "Étiquette de champ (--ink-2) sur blanc", v("ink-2"), W);
  text(G6, "ph-input", "Texte indicatif (placeholder) de « Décris ton idée » sur papier", v("placeholder"), paper);
  text(G6, "ph-dark", "Texte indicatif sur zone sombre (accueil, idées)", v("placeholder-on-dark"), [navy, wa(0.12)]);
  text(G6, "seg-off", "Segment non choisi (--mut) sur --cream-2", v("mut"), cream2);
  text(G6, "seg-on", "Segment choisi : encre sur papier", v("ink"), paper);
  text(G6, "chip-on", "Filtre actif : blanc sur bleu nuit", W, navy);
  text(G6, "chip-off", "Filtre inactif : encre sur papier", v("ink"), paper);
  ui(G6, "input-border", "Bordure d'un champ (--ui-line) sur blanc", v("ui-line"), W);
  ui(G6, "input-border-cream", "Bordure d'un champ (--ui-line) sur crème", v("ui-line"), cream);
  ui(G6, "check-border", "Bordure d'une case à cocher (--ui-line) sur blanc", v("ui-line"), W);
  ui(G6, "check-border-paper", "Bordure d'une case à cocher (--ui-line) sur papier", v("ui-line"), paper);
  ui(G6, "check-on", "Case cochée (--ok) sur papier", v("ok"), paper);
  ui(G6, "switch-off", "Interrupteur éteint (--ui-line) sur papier", v("ui-line"), paper);
  ui(G6, "switch-on", "Interrupteur allumé (--blue) sur papier", blue, paper);
  ui(G6, "switch-knob", "Poignée blanche de l'interrupteur éteint sur --ui-line", W, v("ui-line"));
  ui(G6, "ib-box-border", "Bordure de la zone de saisie sombre (blanc 55 %)", wa(0.55), [navy, wa(0.08)]);
  ui(G6, "select-caret", "Flèche des listes (--mut) sur blanc", v("mut"), W);

  // ── Onglets, tableaux, fil d'Ariane ──
  const G7 = "Onglets, tableaux, constructeur";
  text(G7, "tab", "Onglet inactif (--mut) sur crème", v("mut"), cream);
  text(G7, "tab-on", "Onglet actif : encre sur crème", v("ink"), cream);
  ui(G7, "tab-underline", "Soulignement de l'onglet actif (--coral-ink) sur crème", v("coral-ink"), cream);
  text(G7, "th", "En-tête de tableau (--mut) sur papier", v("mut"), paper);
  text(G7, "td", "Cellule de tableau : encre sur papier", v("ink"), paper);
  text(G7, "crumbs", "Fil d'Ariane (--mut) sur crème", v("mut"), cream);
  text(G7, "pj-tab", "Onglet de projet inactif (--ink-2) sur --cream-2", v("ink-2"), cream2);
  text(G7, "pj-tab-on", "Onglet de projet actif : blanc sur bleu nuit", W, navy);
  text(G7, "bz-step", "Étape du constructeur (--mut) sur papier", v("mut"), paper);
  text(G7, "bz-step-on", "Numéro d'étape actif : blanc sur bleu nuit", W, navy);
  text(G7, "bz-step-done", "Numéro d'étape fait : bleu nuit sur corail", navy, coral);
  text(G7, "bz-page-on-mut", "Page choisie du constructeur : légende (blanc 60 %)", wa(0.6), navy);
  text(G7, "bz-recap-dt", "Récapitulatif : libellé (--mut) sur blanc", v("mut"), W);
  text(G7, "bz-link", "Lien « Modifier » : --blue-ink sur blanc", v("blue-ink"), W);
  text(G7, "dg-specs", "Caractéristique de design (--mut) sur crème", v("mut"), cream);
  text(G7, "st-pending", "Étape à venir de la génération (--mut, pleine opacité) sur papier", v("mut"), paper); // .st-steps li
  text(G7, "tp-map", "Mini-étiquette de type : --ink-2 sur --cream-2", v("ink-2"), cream2);
  text(G7, "kbd", "Touche de clavier : encre sur blanc", v("ink"), W);

  // ── Navigation, menus, modales ──
  const G8 = "Navigation, menus, modales, pied de page";
  text(G8, "nav-link", "Lien de navigation (--ink-2) sur crème", v("ink-2"), cream);
  text(G8, "nav-link-hover", "Lien de navigation survolé", v("ink"), [cream, "rgba(11, 19, 48, 0.06)"]);
  text(G8, "nav-link-current", "Lien de la page courante", v("ink"), [cream, "rgba(11, 19, 48, 0.07)"]);
  text(G8, "nav-dark", "Lien de navigation sur bandeau sombre (blanc 75 %)", "rgba(255, 255, 255, 0.75)", [navy, "rgba(10, 20, 51, 0.78)"]);
  text(G8, "nav-dark-hover", "Lien de navigation sombre survolé", W, [navy, wa(0.08)]);
  text(G8, "nav-panel-desc", "Description du menu déroulant (--mut) sur papier", v("mut"), paper);
  text(G8, "nav-panel-desc-hover", "Description d'entrée survolée (--mut) sur crème", v("mut"), cream);
  text(G8, "nav-ic", "Pictogramme de menu : corail sur bleu nuit", coral, navy);
  text(G8, "mm-item", "Menu mobile (--ink-2) sur papier", v("ink-2"), paper);
  text(G8, "acct-av", "Avatar du compte : blanc sur bleu", W, blue);
  text(G8, "acct-menu", "Menu du compte : encre sur papier", v("ink"), paper);
  text(G8, "modal", "Modale : encre sur papier", v("ink"), paper);
  text(G8, "dg-zoom", "Bouton « agrandir » : blanc sur bleu nuit 88 %", W, [W, "rgba(10, 20, 51, 0.88)"]);
  text(G8, "footer", "Pied de page : blanc 70 % sur bleu nuit", "rgba(255, 255, 255, 0.7)", navy);
  text(G8, "footer-hover", "Pied de page, lien survolé", W, navy);
  text(G8, "dg-tray", "Barre de comparaison : blanc sur bleu nuit", W, navy);

  // ── Pages sombres (accueil, sections, panneaux) ──
  const G9 = "Pages et blocs sombres";
  text(G9, "hero-lead", "Accueil : introduction (blanc 72 %) sur bleu nuit", wa(0.72), navy);
  text(G9, "hero-pill", "Accueil : pastille (blanc 85 %)", wa(0.85), [navy, wa(0.07)]);
  large(G9, "hero-serif", "Accueil : mot en italique corail (titre) sur bleu nuit", coral, navy);
  text(G9, "ib-ex", "Accueil : « Essaie avec » (blanc 60 %) sur bleu nuit", wa(0.6), navy);
  text(G9, "ib-ex-btn", "Accueil : boutons d'exemples (blanc 85 %)", wa(0.85), [navy, wa(0.05)]);
  text(G9, "ib-text", "Accueil : saisie blanche dans la zone", W, [navy, wa(0.08)]);
  text(G9, "dz-ex", "Galerie sombre : exemple (blanc 55 %)", wa(0.55), [navy, wa(0.06)]);
  text(G9, "show-cap", "Vitrine : légende (blanc 62 %) sur bleu nuit", wa(0.62), navy);
  text(G9, "show-tab", "Vitrine : onglet (blanc 72 %)", wa(0.72), [navy, wa(0.05)]);
  text(G9, "show-tab-on", "Vitrine : onglet actif, encre sur blanc", v("ink"), W);
  text(G9, "demo-tpl", "Démo : modèle (blanc 75 %)", wa(0.75), [navy, wa(0.06)]);
  text(G9, "demo-plan", "Démo : plan (blanc 80 %)", wa(0.8), [navy, wa(0.06)]);
  text(G9, "demo-step", "Démo : étapes (blanc 60 %)", wa(0.6), [navy, wa(0.06)]);
  text(G9, "demo-step-on", "Démo : étape active, encre sur blanc", v("ink"), W);
  text(G9, "demo-link", "Démo : lien latéral (--mut) sur #f7f5f0", v("mut"), "#f7f5f0");
  text(G9, "sec-dark-mut", "Section sombre : texte discret (blanc 65 %)", wa(0.65), navy);
  text(G9, "sec-dark-eyebrow", "Section sombre : surtitre corail sur bleu nuit", coral, navy);
  text(G9, "cloud", "Nuage de catégories : compteur corail sur bleu nuit", coral, [navy, wa(0.06)]);
  text(G9, "bento-a", "Bloc bento sombre : blanc sur bleu nuit", W, navy);
  text(G9, "bento-a-mut", "Bloc bento sombre : texte discret (blanc 65 %)", wa(0.65), navy);
  text(G9, "bento-b", "Bloc bento corail : bleu nuit sur corail", navy, coral);
  text(G9, "bento-d", "Bloc bento bleu : blanc sur bleu", W, blue);
  text(G9, "bento-e", "Bloc bento crème : encre sur --cream-2", v("ink"), cream2);
  text(G9, "versus-x", "Comparaison : croix (--bad-ink) sur papier", v("bad-ink"), paper);
  text(G9, "versus-ok", "Comparaison : coche verte (#2ecf8f) sur bleu nuit", "#2ecf8f", navy);
  text(G9, "final", "Appel final : bleu nuit sur corail", navy, coral);
  text(G9, "offer-hl", "Offre mise en avant : blanc sur bleu nuit", W, navy);
  text(G9, "offer-hl-acc", "Offre mise en avant : description (blanc 55 %)", wa(0.55), navy);
  text(G9, "offer-hl-price", "Offre mise en avant : « /mois » (blanc 60 %)", wa(0.6), navy);
  text(G9, "offer-hl-off", "Offre mise en avant : fonction absente (blanc 55 %)", wa(0.55), navy);
  text(G9, "offer-hl-tick", "Offre mise en avant : coche verte (#2ecf8f)", "#2ecf8f", navy);
  text(G9, "offer-tick", "Offre : coche verte (--ok-ink) sur papier", v("ok-ink"), paper);
  text(G9, "offer-off", "Offre : fonction absente (--dim) sur papier", v("dim"), paper);
  text(G9, "offer-acc", "Offre : description (--mut) sur papier", v("mut"), paper);
  text(G9, "tp-on-mut", "Carte de type choisie : texte discret (blanc 68 %)", wa(0.68), navy);
  text(G9, "tp-on-map", "Carte de type choisie : mini-étiquette blanche", W, [navy, wa(0.12)]);
  text(G9, "tp-check", "Coche de carte choisie : bleu nuit sur corail", navy, coral);
  text(G9, "wiz-steps", "Parcours : étape à venir (blanc 62 %)", wa(0.62), [navy, wa(0.1)]);
  text(G9, "wiz-on", "Parcours : étape active, bleu nuit sur corail", navy, coral);

  // ── Bandeaux de page (PageHero) ──
  const G10 = "Bandeaux de page";
  text(G10, "phero-navy-lead", "Bandeau bleu nuit : introduction (blanc 80 %)", wa(0.8), navy);
  text(G10, "phero-navy-eyebrow", "Bandeau bleu nuit : surtitre corail", coral, navy);
  large(G10, "phero-navy-serif", "Bandeau bleu nuit : italique corail (titre)", coral, navy);
  text(G10, "phero-navy-facts", "Bandeau bleu nuit : légende de chiffre (blanc 72 %)", wa(0.72), v("navy-2"));
  text(G10, "phero-blue-lead", "Bandeau bleu : introduction (blanc, pleine opacité)", W, blue);
  text(G10, "phero-blue-eyebrow", "Bandeau bleu : surtitre (--eyebrow-on-blue)", v("eyebrow-on-blue"), blue);
  large(G10, "phero-blue-serif", "Bandeau bleu : italique rose pâle (#ffd2c6, titre)", "#ffd2c6", blue);
  text(G10, "phero-blue-facts", "Bandeau bleu : légende de chiffre (blanc, pleine opacité)", W, "#3a64ff");
  text(G10, "phero-coral-lead", "Bandeau corail : introduction (bleu nuit 80 %)", "rgba(10, 20, 51, 0.8)", coral);
  text(G10, "phero-coral-eyebrow", "Bandeau corail : surtitre bleu nuit", navy, coral);
  large(G10, "phero-coral-serif", "Bandeau corail : italique (titre, --phero-coral-serif)", v("phero-coral-serif"), coral);
  text(G10, "phero-coral-facts", "Bandeau corail : légende de chiffre (bleu nuit 80 %)", "rgba(10, 20, 51, 0.8)", "#ff7a5c");
  text(G10, "phero-paper-serif", "Bandeau papier : italique (--coral-ink)", v("coral-ink"), paper);
  text(G10, "phero-del", "Bouton « supprimer » sur bandeau sombre (#ffb4a6)", "#ffb4a6", navy);

  // ── Tableaux de bord, projets, constructeur ──
  const G11 = "Tableaux de bord et projets";
  text(G11, "ov-journey", "Parcours du projet : lien (blanc 80 %)", wa(0.8), navy);
  text(G11, "ov-n-now", "Étape en cours : bleu nuit sur blanc", navy, W);
  text(G11, "ov-n-done", "Étape faite : bleu nuit sur corail", navy, coral);
  text(G11, "ov-n", "Numéro d'étape à venir : blanc sur fond translucide", W, [navy, wa(0.1)]);
  text(G11, "ex-next", "Export : texte discret (blanc 70 %) sur bleu nuit", wa(0.7), navy);
  text(G11, "pr-result", "Résultat prix : blanc sur bleu nuit", W, navy);
  text(G11, "pr-result-blue", "Résultat prix : blanc sur bleu", W, blue);
  text(G11, "pr-result-neg", "Résultat prix négatif : bleu nuit sur corail", navy, coral);
  text(G11, "val-reco", "Recommandation : texte discret (blanc 70 %)", wa(0.7), navy);
  text(G11, "val-opt-on", "Réponse choisie : blanc sur bleu nuit", W, navy);
  text(G11, "st-hl", "Bloc en avant : texte discret (blanc 70 %)", wa(0.7), navy);
  text(G11, "gd-code", "Bloc de code : #e2e8f0 sur bleu nuit", "#e2e8f0", navy);
  text(G11, "bz-spec", "Constructeur : fiche sombre, texte discret (blanc 65 %)", wa(0.65), navy);
  text(G11, "db-open", "Tableau de bord : « Ouvrir » (blanc sur bleu nuit 88 %)", W, [W, "rgba(10, 20, 51, 0.88)"]);
  text(G11, "id-tag", "Numéro de parcours (--coral-ink) sur papier", v("coral-ink"), paper);
  text(G11, "empty", "État vide (--mut) sur fond translucide", v("mut"), [cream, "rgba(255, 253, 248, 0.6)"]);

  // ── Accents de catégories et de parcours ──
  const G12 = "Accents (idées, Apprendre)";
  src.cats.forEach((c, i) => {
    text(G12, `cat-${i}-paper`, `Univers d'idées n°${i + 1} (${c}) en texte sur papier`, c, paper);
    text(G12, `cat-${i}-white`, `Univers d'idées n°${i + 1} : texte blanc sur ${c} (filtre actif)`, W, c);
  });
  src.parcours.forEach((p) => {
    text(G12, `parcours-${p.id}-paper`, `Parcours « ${p.id} » (${p.couleur}) en texte sur papier`, p.couleur, paper);
    text(G12, `parcours-${p.id}-cream`, `Parcours « ${p.id} » en texte sur crème`, p.couleur, cream);
    text(G12, `parcours-${p.id}-white`, `Parcours « ${p.id} » : blanc sur la couleur (étape faite)`, W, p.couleur);
  });

  // ── Graphiques et jauges (3:1) ──
  const G13 = "Graphiques et jauges";
  ui(G13, "meter-blue", "Jauge bleue (--blue) sur --cream-2", blue, cream2);
  ui(G13, "meter-coral", "Jauge corail (--coral-graph) sur --cream-2", v("coral-graph"), cream2);
  ui(G13, "ring-ok", "Anneau « bon » (--ok) sur --cream-2", v("ok"), cream2);
  ui(G13, "ring-mid", "Anneau « moyen » (--blue) sur --cream-2", blue, cream2);
  ui(G13, "ring-low", "Anneau « faible » (--coral-graph) sur --cream-2", v("coral-graph"), cream2);
  ui(G13, "chart-line", "Courbe des métriques (--blue) sur papier", blue, paper);
  ui(G13, "chart-bars", "Barres de la démo (bleu 85 %) sur papier", "rgba(47, 91, 255, 0.85)", paper);
  text(G13, "chart-axis", "Texte d'axe des graphiques (--mut) sur papier", v("mut"), paper);
  ui(G13, "db-step-done", "Étape faite du tableau de bord (--ok) sur --cream-2", v("ok"), cream2);
  ui(G13, "db-step-now", "Étape en cours du tableau de bord (--coral-graph) sur --cream-2", v("coral-graph"), cream2);
  ui(G13, "dots-on", "Niveau (point plein bleu nuit) sur --cream-2", navy, cream2);

  // ── Focus clavier (3:1 sur tous les fonds) ──
  const G14 = "Focus clavier";
  for (const [bn, b] of [["crème", cream], ["papier", paper], ["blanc", W], ["--cream-2", cream2], ["--blue-soft", v("blue-soft")]] as const) {
    ui(G14, `focus-light-${bn}`, `Anneau de focus (--focus-light) sur ${bn}`, v("focus-light"), b);
  }
  for (const [bn, b] of [["bleu nuit", navy], ["--navy-2", v("navy-2")], ["--navy-3", v("navy-3")]] as const) {
    ui(G14, `focus-dark-${bn}`, `Anneau de focus clair (--focus-dark) sur ${bn}`, v("focus-dark"), b);
  }
  ui(G14, "focus-on-blue", "Anneau de focus sur bandeau bleu (--focus-dark)", v("focus-dark"), blue);
  ui(G14, "focus-on-coral", "Anneau de focus sur bandeau corail (--focus-on-coral)", v("focus-on-coral"), coral);

  // ── Divers ──
  text("Divers", "selection", "Texte sélectionné : bleu nuit sur corail", navy, coral);
  text("Divers", "skip-link", "Lien d'évitement visible : blanc sur bleu nuit", W, navy);

  // ── Nouveaux écrans (pages légales, cookies, marque blanche, commande) : couleurs lues dans le CSS des designers ──
  text("Nouveaux écrans", "nx-t0", "Pied de page : texte et liens (#d3d5da sur #0a1433)", "#d3d5da", "#0a1433");
  text("Nouveaux écrans", "nx-t1", "Pied de page : titres (#ffffff sur #0a1433)", "#ffffff", "#0a1433");
  text("Nouveaux écrans", "nx-t2", "Liens des pages légales (#1f45e0 sur #f6f1e7)", "#1f45e0", "#f6f1e7");
  text("Nouveaux écrans", "nx-t3", "Liens du panneau cookies (#1f45e0 sur #fffdf8)", "#1f45e0", "#fffdf8");
  text("Nouveaux écrans", "nx-t4", "Préfixe Note (#1f45e0 sur #e4eaff)", "#1f45e0", "#e4eaff");
  text("Nouveaux écrans", "nx-t5", "Préfixe Attention (#8a5206 sur #fbecd2)", "#8a5206", "#fbecd2");
  text("Nouveaux écrans", "nx-t6", "Bandeau à compléter (#0b1330 sur #fbecd2)", "#0b1330", "#fbecd2");
  text("Nouveaux écrans", "nx-t7", "Repère à compléter (#7c2d12 sur #fde68a)", "#7c2d12", "#fde68a");
  text("Nouveaux écrans", "nx-t8", "En-têtes de tableau (#0b1330 sur #ede5d5)", "#0b1330", "#ede5d5");
  text("Nouveaux écrans", "nx-t9", "Cellules, panneau (#0b1330 sur #fffdf8)", "#0b1330", "#fffdf8");
  text("Nouveaux écrans", "nx-t10", "Boutons du panneau cookies (#0b1330 sur #ffffff)", "#0b1330", "#ffffff");
  text("Nouveaux écrans", "nx-t11", "Texte secondaire du panneau (#5b6280 sur #fffdf8)", "#5b6280", "#fffdf8");
  text("Nouveaux écrans", "nx-t12", "Marque blanche : texte (#0b1330 sur #f6f1e7)", "#0b1330", "#f6f1e7");
  text("Nouveaux écrans", "nx-t13", "Marque blanche : titres (#0a1433 sur #f6f1e7)", "#0a1433", "#f6f1e7");
  text("Nouveaux écrans", "nx-t14", "Marque blanche : texte secondaire (#2b3354 sur #f6f1e7)", "#2b3354", "#f6f1e7");
  text("Nouveaux écrans", "nx-t15", "Marque blanche : secondaire carte (#2b3354 sur #fffdf8)", "#2b3354", "#fffdf8");
  text("Nouveaux écrans", "nx-t16", "Marque blanche : info (#0b1330 sur #e4eaff)", "#0b1330", "#e4eaff");
  text("Nouveaux écrans", "nx-t17", "Marque blanche : info secondaire (#2b3354 sur #e4eaff)", "#2b3354", "#e4eaff");
  text("Nouveaux écrans", "nx-t18", "Marque blanche : succès (#0b1330 sur #dcf3e8)", "#0b1330", "#dcf3e8");
  text("Nouveaux écrans", "nx-t19", "Zone d'import (#2b3354 sur #ede5d5)", "#2b3354", "#ede5d5");
  text("Nouveaux écrans", "nx-t20", "État valide (#0b5a3a sur #fffdf8)", "#0b5a3a", "#fffdf8");
  text("Nouveaux écrans", "nx-t21", "État erreur (#7d1b27 sur #fffdf8)", "#7d1b27", "#fffdf8");
  text("Nouveaux écrans", "nx-t22", "Succès fort (#0e7550 sur #dcf3e8)", "#0e7550", "#dcf3e8");
  text("Nouveaux écrans", "nx-t23", "Message d'erreur (#7d1b27 sur #fbe1e4)", "#7d1b27", "#fbe1e4");
  text("Nouveaux écrans", "nx-t24", "Message d'attention (#6b4106 sur #fbecd2)", "#6b4106", "#fbecd2");
  text("Nouveaux écrans", "nx-t25", "Message d'information (#1b2f8f sur #e4eaff)", "#1b2f8f", "#e4eaff");
  text("Nouveaux écrans", "nx-t26", "Message de succès (#0b5a3a sur #dcf3e8)", "#0b5a3a", "#dcf3e8");
  text("Nouveaux écrans", "nx-t27", "Symbole d'erreur (#fffdf8 sur #7d1b27)", "#fffdf8", "#7d1b27");
  text("Nouveaux écrans", "nx-t28", "Symbole d'attention (#fffdf8 sur #6b4106)", "#fffdf8", "#6b4106");
  text("Nouveaux écrans", "nx-t29", "Symbole d'information (#fffdf8 sur #1b2f8f)", "#fffdf8", "#1b2f8f");
  text("Nouveaux écrans", "nx-t30", "Symbole de succès (#fffdf8 sur #0b5a3a)", "#fffdf8", "#0b5a3a");
  ui("Nouveaux écrans", "nx-u0", "Bordures sur crème (#767c96 sur #f6f1e7)", "#767c96", "#f6f1e7");
  ui("Nouveaux écrans", "nx-u1", "Bordures sur carte (#767c96 sur #fffdf8)", "#767c96", "#fffdf8");
  ui("Nouveaux écrans", "nx-u2", "Bordures sur crème foncé (#767c96 sur #ede5d5)", "#767c96", "#ede5d5");
  ui("Nouveaux écrans", "nx-u3", "Interrupteur activé (#2f5bff sur #fffdf8)", "#2f5bff", "#fffdf8");
  ui("Nouveaux écrans", "nx-u4", "Pastille interrupteur désactivé (#ffffff sur #767c96)", "#ffffff", "#767c96");
  ui("Nouveaux écrans", "nx-u5", "Pastille interrupteur activé (#ffffff sur #2f5bff)", "#ffffff", "#2f5bff");
  ui("Nouveaux écrans", "nx-u6", "Contour des boutons du panneau (#0a1433 sur #ffffff)", "#0a1433", "#ffffff");
  ui("Nouveaux écrans", "nx-u7", "Bordure du bandeau (#8a5206 sur #f6f1e7)", "#8a5206", "#f6f1e7");
  ui("Nouveaux écrans", "nx-u8", "Filet de l'encart, icône d'import (#1f45e0 sur #e4eaff)", "#1f45e0", "#e4eaff");
  ui("Nouveaux écrans", "nx-u9", "Bordure carte cochée (#0e7550 sur #dcf3e8)", "#0e7550", "#dcf3e8");

  return P;
}

export type Row = { pair: Pair; ratio: number | null; ok: boolean; error?: string };

/** Calcule le rapport de chaque paire pour un jeu de variables donné. */
export function evaluate(tokens: Record<string, string>, src: Source = currentSource()): Row[] {
  return buildPairs(src).map((pair) => {
    try {
      const fg = resolveColor(pair.fg, tokens);
      const bg = Array.isArray(pair.bg) ? pair.bg.map((b) => resolveColor(b, tokens)) : resolveColor(pair.bg, tokens);
      const ratio = ratioOf(fg, bg);
      return { pair, ratio, ok: ratio + 1e-9 >= pair.min };
    } catch (e) {
      return { pair, ratio: null, ok: false, error: (e as Error).message };
    }
  });
}
