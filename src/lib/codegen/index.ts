import { DEMO } from "@/data/demo";
import { DESIGN_BY_ID } from "@/data/designs";
import { TEMPLATE_BY_ID } from "@/data/templates";
import { POLICES, policeOf } from "@/lib/config";
import { PROTO_DESIGN_CSS } from "@/lib/design-css";
import { slug } from "@/lib/export";
import { activePages } from "@/lib/modules";
import { contenuOf } from "@/lib/project";
import { PROTO_CSS } from "@/lib/proto-css";
import { STYLE_EXTRA, STYLE_VARS } from "@/lib/prototype";
import { archOf, ARCHETYPES, HOME_LAYOUT, ROLES } from "@/data/archetypes";
import { ARCH_CSS } from "@/lib/arch-css";
import type { ArchPageKind, PageKind, Project } from "@/lib/types";
import { ARCH_KIT_TSX, ARCH_REACT_CSS, FRAME_TSX, SCREENS_TSX, SITE_TSX } from "./kit-arch";
import { STORE_TS, TYPES_TS } from "./kit-data";
import { RULES_TS } from "./kit-rules";
import { inferTypes, toStored, type FieldType } from "./schema";

type Booking = { date: number; ressource?: number; annule: string[]; debut: string; fin: string; duree: number; jours: number[] };
import { REACT_CSS, SHELL_TSX } from "./kit-ui";
import { VIEWS_TSX } from "./kit-views";
import { CLOUD_TS, CLOUD_TSX, WAITLIST_SQL } from "./kit-cloud";

/** Écrans d'architecture (rendus par components/screens.tsx). */
const ARCH_VIEWS = new Set<string>(Object.values(ARCHETYPES).flatMap((a) => a.screens.map((s) => s.view)));

// Générateur de projet Next.js, sans IA : un kit de composants écrit à l'avance (kit-*.ts) + la
// configuration du projet (nom, couleurs, design, type, pages, données) sérialisée en JSON.
// Le résultat est une vraie application : les données sont enregistrées dans le navigateur.

export type GenFile = { name: string; content: string };
type GenKind = "accueil" | "dashboard" | "table" | "cards" | "grid" | "kanban" | "agenda" | "form" | "todo" | "goals" | "settings" | "pricing" | "login" | "activity" | "waitlist";

/** Pages du prototype et leur équivalent dans le projet généré. Les autres ne sont pas générées. */
export const KIND_MAP: Partial<Record<PageKind, GenKind>> = {
  accueil: "accueil", dashboard: "dashboard", graphique: "dashboard", resultats: "dashboard",
  tableau: "table", liste: "cards", grille: "grid", kanban: "kanban", calendrier: "agenda", mois: "agenda",
  formulaire: "form", relances: "todo", objectifs: "goals", parametres: "settings", profil: "settings",
  tarifs: "pricing", facturation: "pricing", connexion: "login", historique: "activity", notifications: "activity", waitlist: "waitlist",
};
const VIEW: Record<GenKind, string> = {
  accueil: "Home", dashboard: "Dashboard", table: "TableView", cards: "CardsView", grid: "CardsView", kanban: "KanbanView", agenda: "AgendaView",
  form: "FormView", todo: "TodoView", goals: "GoalsView", settings: "SettingsView", pricing: "PricingView", login: "LoginView", activity: "ActivityView", waitlist: "WaitlistView",
};

/** Versions identiques à celles de Décollage : connues pour fonctionner ensemble. */
export const VERSIONS = { next: "16.4.2", react: "19.3.0", typescript: "^5", "@types/react": "^19", "@types/react-dom": "^19", "@types/node": "^24", "@supabase/supabase-js": "^2.118.0" };

const js = (x: unknown) => JSON.stringify(x, null, 2);
const routeId = (id: string) => id.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "page";

type GenPage = { id: string; titre: string; kind: GenKind | ArchPageKind; href: string; nav: boolean; zone?: "site" | "app" };

/** Ce que le générateur produit, et ce qu'il laisse de côté (affiché dans Décollage et le README). */
export function generationPlan(p: Project): { gen: GenPage[]; skipped: string[] } {
  const pages = activePages(p.config);
  const gen: GenPage[] = [];
  const skipped: string[] = [];
  // Architecture dédiée : site public à la racine, espace utilisateur sous /app.
  if (archOf(p.config.templateId).id !== "classic") {
    for (const pg of pages) {
      const k = String(pg.kind);
      if (k.startsWith("site-")) gen.push({ id: pg.id, titre: pg.titre, kind: pg.kind as ArchPageKind, href: pg.id === "accueil" ? "/" : `/${routeId(pg.id)}`, nav: true, zone: "site" });
      else if (ARCH_VIEWS.has(k)) gen.push({ id: pg.id, titre: pg.titre, kind: pg.kind as ArchPageKind, href: pg.id === "app" ? "/app" : `/app/${routeId(pg.id)}`, nav: true, zone: "app" });
      else {
        const kind = KIND_MAP[pg.kind as PageKind];
        if (kind) gen.push({ id: routeId(pg.id), titre: pg.titre, kind, href: `/app/${routeId(pg.id)}`, nav: true, zone: "app" });
        else if (pg.kind !== "detail") skipped.push(pg.titre);
      }
    }
    return { gen, skipped };
  }
  const used = new Set<string>();
  for (const pg of pages) {
    const kind = KIND_MAP[pg.kind as PageKind];
    if (!kind) { if (pg.kind !== "detail") skipped.push(pg.titre); continue; }
    let id = kind === "accueil" ? "" : routeId(pg.id);
    while (id && used.has(id)) id += "-2";
    used.add(id);
    gen.push({ id: id || "accueil", titre: pg.titre, kind, href: id ? `/${id}` : "/", nav: pg.nav || kind === "settings" });
  }
  // Une page « Paramètres » est toujours présente : c'est là que se trouvent l'import et l'export CSV.
  if (!gen.some((g) => g.kind === "settings")) gen.push({ id: "donnees", titre: "Données", kind: "settings", href: "/donnees", nav: true });
  return { gen, skipped };
}

/** Réservations : colonne date et heure, ressource éventuelle, statuts qui libèrent le créneau, horaires par défaut. */
function bookingOf(templateId: string, types: FieldType[], statuts: string[]): Booking | undefined {
  if (templateId !== "rendez-vous" && templateId !== "reservations") return undefined;
  const date = types.indexOf("datetime");
  if (date < 0) return undefined;
  return {
    date,
    ...(templateId === "reservations" ? { ressource: 0 } : {}),
    annule: statuts.filter((s) => /annul|refus/i.test(s)),
    debut: "09:00", fin: "18:00", duree: templateId === "reservations" ? 60 : 30,
    jours: [1, 2, 3, 4, 5, 6],
  };
}

export function generateNextProject(p: Project, now = new Date()): GenFile[] {
  const cfg = p.config;
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const demo = DEMO[cfg.templateId];
  const contenu = contenuOf(p);
  const entite = contenu?.entite ?? { nom: t.entite.nom, pluriel: t.entite.pluriel, champs: t.entite.champs };
  const statuts = contenu?.statuts ?? demo.statuses;
  const n = entite.champs.length;
  // Données de départ : celles saisies dans Décollage si elles existent, sinon les exemples.
  const savedRows = p.appData?.rows.filter((r) => r.v.length === n);
  const saved = savedRows?.map((r) => r.v);
  const brut = saved?.length ? saved : (contenu?.lignes ?? demo.rows);
  // Type de chaque colonne, puis exemples convertis en vraies valeurs (dates ISO, nombres).
  const types = inferTypes(entite.champs, demo.status, brut, now);
  const exemples = brut.map((r) => r.map((v, j) => toStored(v, types[j] ?? "text", now)));
  const booking = bookingOf(cfg.templateId, types, statuts);
  const unique = cfg.templateId === "liste-attente" && types.includes("email") ? types.indexOf("email") : undefined;
  // Notes, leçons et documents écrits dans Décollage, rattachés aux mêmes lignes (ids « ex1 », « ex2 »…).
  const savedNotes = p.appData?.notes;
  const notes = savedRows?.length && savedNotes ? Object.fromEntries(savedRows.flatMap((r, k) => (savedNotes[String(r.id)] ? [[`ex${k + 1}`, savedNotes[String(r.id)]!]] : []))) : {};
  const { gen, skipped } = generationPlan(p);
  const a = archOf(cfg.templateId);
  const isArch = a.id !== "classic";
  const isScreen = (g: GenPage) => g.zone === "app" && ARCH_VIEWS.has(String(g.kind));
  const extras = gen.filter((g) => g.zone === "app" && !isScreen(g));
  const arch = isArch ? {
    id: a.id, frame: a.frame, home: HOME_LAYOUT[cfg.design ?? ""] ?? "centre", accounts: cfg.modules.includes("auth"), roles: { ...ROLES[cfg.templateId] },
    site: gen.filter((g) => g.zone === "site").map((g) => ({ id: g.id, titre: g.titre, href: g.href })),
    screens: gen.filter(isScreen).map((g) => ({ id: g.id, titre: g.titre, view: String(g.kind), href: g.href })),
    extras: extras.map((g) => ({ id: g.id, titre: g.titre, kind: g.kind, href: g.href, nav: true })),
  } : null;
  const name = slug(cfg.nom) || "mon-saas";
  const design = cfg.design ? DESIGN_BY_ID[cfg.design] : undefined;
  const font = policeOf(cfg);
  const fonts = [...new Set([font.url, cfg.style === "luxe" ? POLICES.elegante.url : ""].filter(Boolean))];
  const features = (contenu?.fonctionnalites ?? t.copy.features).map(([a, b]) => [a.replaceAll("{nom}", cfg.nom), b.replaceAll("{nom}", cfg.nom)] as [string, string]);

  const saas = {
    nom: cfg.nom, initiales: cfg.initiales, description: cfg.description, cible: cfg.cible || t.nom,
    // v2 : dates et nombres enregistrés en format réel (ISO, notation point).
    storageKey: `${name}-donnees-v2`,
    entite, types, statut: demo.status, statuts, exemples,
    ...(booking ? { booking } : {}),
    ...(unique !== undefined ? { unique } : {}),
    pages: (arch ? extras : gen).map((g) => ({ id: g.id, titre: g.titre, kind: g.kind, href: g.href, nav: g.nav })),
    fonctionnalites: features,
    heroTitre: contenu?.copy.heroTitre.replaceAll("{nom}", cfg.nom) ?? t.copy.heroTitre,
    revenu: cfg.revenu,
    offres: p.pricing.offres.map((o) => ({ nom: o.nom, prix: o.prix, periode: o.periode === "unique" ? "une fois" : o.periode, points: o.features.filter((f) => f.trim()) })),
    csvSeparateur: (cfg.reglages["csv.separateur"] ?? "").startsWith("Virgule") ? "," : ";",
    ...(Object.keys(notes).length ? { notes } : {}),
    ...(arch ? { arch } : {}),
  };

  const htmlClass = `s-${cfg.style} shell-${design?.shell ?? "side"} dash-${design?.dash ?? "kpi-chart"} anim-${design?.anim ?? "rise"}`;
  const css = `/* Généré par Décollage. Couleurs et design : modifie les variables ci-dessous. */
:root{--p:${cfg.couleurs.primaire};--a:${cfg.couleurs.accent};${STYLE_VARS[cfg.style]}${font.url ? `;--ff:${font.famille}` : ""}}
${PROTO_CSS}
${arch ? ARCH_CSS : ""}
${STYLE_EXTRA[cfg.style]}
${(cfg.design && PROTO_DESIGN_CSS[cfg.design]) || ""}
${REACT_CSS}
${arch ? ARCH_REACT_CSS : ""}
`;

  const layout = `import type { Metadata } from "next";
${arch ? "" : `import { Shell } from "@/components/Shell";\n`}import "./globals.css";

export const metadata: Metadata = { title: ${js(cfg.nom)}, description: ${js(cfg.description)} };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className=${js(htmlClass)}>
      <head>
${fonts.map((u) => `        <link rel="stylesheet" href=${js(u)} />`).join("\n")}
      </head>
${arch ? `      <body className="arch">{children}</body>` : `      <body>
        <Shell>{children}</Shell>
      </body>`}
    </html>
  );
}
`;

  const page = (g: (typeof gen)[number]) => {
    // Liste d'attente : la page publique passe par la base de données quand elle est configurée.
    const cloudPage = g.kind === "waitlist" && unique !== undefined;
    const view = cloudPage ? "WaitlistPage" : VIEW[g.kind as GenKind];
    const props = g.kind === "accueil" ? "" : ` titre=${js(g.titre)}${g.kind === "grid" ? " grid" : ""}`;
    return `import type { Metadata } from "next";
import { ${view} } from "@/components/${cloudPage ? "cloud" : "views"}";

export const metadata: Metadata = { title: ${js(`${g.titre} · ${cfg.nom}`)} };

export default function Page() {
  return <${view}${props} />;
}
`;
  };
  const hasHome = gen.some((g) => g.kind === "accueil");
  const first = gen.find((g) => g.kind !== "accueil");
  const pageFiles: GenFile[] = arch ? archPageFiles(gen, cfg.nom, isScreen, page) : gen.filter((g) => g.kind !== "accueil").map((g) => ({ name: `app/${g.id}/page.tsx`, content: page(g) }));
  // Page de détail d'une fiche (/fiche?id=…), ouverte depuis les listes.
  if (!arch) pageFiles.push({ name: "app/fiche/page.tsx", content: `import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailView } from "@/components/views";

export const metadata: Metadata = { title: ${js(`Fiche · ${cfg.nom}`)} };

export default function Page() {
  return (
    <Suspense fallback={<p className="mut">Chargement…</p>}>
      <DetailView />
    </Suspense>
  );
}
` });
  if (!arch) pageFiles.push({
    name: "app/page.tsx",
    content: hasHome
      ? page(gen.find((g) => g.kind === "accueil")!)
      : `import { redirect } from "next/navigation";\n\nexport default function Page() {\n  redirect(${js(first?.href ?? "/donnees")});\n}\n`,
  });

  const pkg = {
    name, version: "0.1.0", private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: VERSIONS.next, react: VERSIONS.react, "react-dom": VERSIONS.react, ...(unique !== undefined ? { "@supabase/supabase-js": VERSIONS["@supabase/supabase-js"] } : {}) },
    devDependencies: { typescript: VERSIONS.typescript, "@types/react": VERSIONS["@types/react"], "@types/react-dom": VERSIONS["@types/react-dom"], "@types/node": VERSIONS["@types/node"] },
  };
  const tsconfig = {
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
      module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "react-jsx", incremental: true,
      plugins: [{ name: "next" }], paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
    exclude: ["node_modules"],
  };

  return [
    { name: "package.json", content: js(pkg) + "\n" },
    { name: "tsconfig.json", content: js(tsconfig) + "\n" },
    { name: "next.config.mjs", content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\n\nexport default nextConfig;\n` },
    { name: ".gitignore", content: "node_modules\n.next\nout\n*.tsbuildinfo\nnext-env.d.ts\n.env*\n!.env.example\n" },
    ...(unique !== undefined ? cloudFiles(cfg.nom) : []),
    { name: "README.md", content: readme(p, gen, skipped, name, entite.pluriel, booking, unique) },
    { name: "app/layout.tsx", content: layout },
    { name: "app/globals.css", content: css },
    // Icône d'onglet aux initiales et aux couleurs du projet (détectée automatiquement par Next.js).
    { name: "app/icon.svg", content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cfg.couleurs.primaire}"/><stop offset="1" stop-color="${cfg.couleurs.accent}"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><text x="32" y="41" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="800" fill="#fff">${cfg.initiales.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3)}</text></svg>\n` },
    ...pageFiles,
    ...(arch
      ? [
          { name: "components/arch-kit.tsx", content: ARCH_KIT_TSX },
          { name: "components/site.tsx", content: SITE_TSX },
          { name: "components/frame.tsx", content: FRAME_TSX },
          { name: "components/screens.tsx", content: SCREENS_TSX },
        ]
      : [{ name: "components/Shell.tsx", content: unique !== undefined ? cloudShell(SHELL_TSX) : SHELL_TSX }]),
    { name: "components/views.tsx", content: VIEWS_TSX },
    { name: "lib/types.ts", content: TYPES_TS },
    { name: "lib/rules.ts", content: RULES_TS },
    { name: "lib/store.ts", content: STORE_TS },
    { name: "lib/config.ts", content: `// Généré par Décollage à partir de ton projet. Tu peux modifier ces valeurs.\nimport type { SaasConfig } from "@/lib/types";\n\nexport const SAAS: SaasConfig = ${js(saas)};\n` },
  ];
}

/** Coquille de la liste d'attente : avec la base branchée, le badge et le compteur ne parlent plus du stockage local. */
function cloudShell(shell: string): string {
  const swaps: [string, string][] = [
    ['import { storageError, useStore } from "@/lib/store";', 'import { storageError, useStore } from "@/lib/store";\nimport { cloudState } from "@/lib/cloud";'],
    ['<span className="mut xs">{state.items.length} {SAAS.entite.pluriel.toLowerCase()}</span>', '{cloudState === "local" ? <span className="mut xs">{state.items.length} {SAAS.entite.pluriel.toLowerCase()}</span> : <Link href="/proprietaire" className="mut xs">Inscriptions en ligne →</Link>}'],
    ['title="Les données restent dans ce navigateur">● Données enregistrées dans ce navigateur</div>', 'title={cloudState === "local" ? "Les données restent dans ce navigateur" : "Les inscriptions publiques vont dans la base ; les autres pages restent dans ce navigateur"}>{cloudState === "local" ? "● Données enregistrées dans ce navigateur" : "● Inscriptions enregistrées en ligne"}</div>'],
  ];
  return swaps.reduce((s, [a, b]) => {
    if (!s.includes(a)) throw new Error("Coquille : passage introuvable pour la liste d'attente");
    return s.replace(a, b);
  }, shell);
}

/** Base de données facultative de la liste d'attente : migration, accès public, espace propriétaire. */
function cloudFiles(nom: string): GenFile[] {
  return [
    { name: ".env.example", content: "# Copie ce fichier en .env.local et remplis les valeurs (voir le README).\n# Valeurs publiques uniquement : ne mets jamais ici la clé service_role ni une clé secrète.\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nNEXT_PUBLIC_LISTE_ID=\n" },
    { name: "supabase/migrations/0001_liste_attente.sql", content: WAITLIST_SQL },
    { name: "lib/cloud.ts", content: CLOUD_TS },
    { name: "components/cloud.tsx", content: CLOUD_TSX },
    { name: "app/proprietaire/page.tsx", content: `import type { Metadata } from "next";\nimport { OwnerView } from "@/components/cloud";\n\nexport const metadata: Metadata = { title: ${js(`Espace propriétaire · ${nom}`)}, robots: { index: false } };\n\nexport default function Page() {\n  return <OwnerView />;\n}\n` },
  ];
}

const SUPABASE_README = String.raw`
## Base de données (Supabase)

Gratuit dans la limite de l'offre Free de Supabase. Aucune clé secrète n'est utilisée : la sécurité est appliquée par la base (règles RLS).

1. Crée un projet sur https://supabase.com (offre Free).
2. Ouvre **SQL Editor**, colle le contenu de CODEsupabase/migrations/0001_liste_attente.sqlCODE et exécute-le. Le script ne supprime aucune donnée.
3. Dans **Project Settings → API**, copie l'URL du projet et la clé publique (*Publishable key*, ou *anon key*). **Jamais la clé service_role / secret.**
4. Copie CODE.env.exampleCODE en CODE.env.localCODE et renseigne CODENEXT_PUBLIC_SUPABASE_URLCODE et CODENEXT_PUBLIC_SUPABASE_ANON_KEYCODE, puis relance CODEnpm run devCODE.
5. Ouvre CODE/proprietaireCODE, crée ton compte et ta liste : l'identifiant de la liste s'affiche. Renseigne-le dans CODENEXT_PUBLIC_LISTE_IDCODE et relance.
6. Une fois ton compte créé, désactive les nouvelles inscriptions de comptes dans Supabase (**Authentication → Sign In / Providers → Allow new users to sign up**) : toi seul en as besoin.

Ce que garantit la base :

- les visiteurs peuvent seulement s'inscrire (fonction CODEinscrireCODE) : ils ne peuvent lire aucune inscription ;
- une adresse ne peut être inscrite qu'une fois par liste, quelle que soit la casse ; un doublon reçoit la même réponse, sans révéler que l'adresse était déjà inscrite ;
- chaque compte ne voit et ne supprime que les inscriptions de ses propres listes.

Limite : il n'y a pas de protection anti-robots (captcha). Surveille ta liste et supprime les inscriptions suspectes depuis CODE/proprietaireCODE.
`.replaceAll("CODE", "`");

const SITE_COMPONENT: Record<string, string> ={ "site-home": "Home", "site-features": "Features", "site-pricing": "Pricing", "site-login": "Auth", "site-signup": "Auth signup" };

/** Pages d'un SaaS à architecture : site public dans le groupe (site), espace utilisateur sous app/app. */
function archPageFiles(gen: GenPage[], nom: string, isScreen: (g: GenPage) => boolean, generic: (g: GenPage) => string): GenFile[] {
  const head = (titre: string, imp: string) => `import type { Metadata } from "next";\n${imp}\n\nexport const metadata: Metadata = { title: ${js(titre)} };\n\n`;
  const files: GenFile[] = [
    { name: "app/(site)/layout.tsx", content: `import { SiteShell } from "@/components/site";\n\nexport default function SiteLayout({ children }: { children: React.ReactNode }) {\n  return <SiteShell>{children}</SiteShell>;\n}\n` },
    { name: "app/app/layout.tsx", content: `import { AppFrame } from "@/components/frame";\n\nexport default function AppLayout({ children }: { children: React.ReactNode }) {\n  return <AppFrame>{children}</AppFrame>;\n}\n` },
  ];
  for (const g of gen) {
    if (g.zone === "site") {
      const [comp, prop] = (SITE_COMPONENT[String(g.kind)] ?? "Home").split(" ");
      files.push({ name: `app/(site)${g.href === "/" ? "" : g.href}/page.tsx`, content: `${head(g.href === "/" ? nom : `${g.titre} · ${nom}`, `import { ${comp} } from "@/components/site";`)}export default function Page() {\n  return <${comp}${prop ? ` ${prop}` : ""} />;\n}\n` });
    } else if (isScreen(g)) {
      files.push({ name: `app${g.href}/page.tsx`, content: `${head(`${g.titre} · ${nom}`, `import { Screen } from "@/components/screens";`)}export default function Page() {\n  return <Screen view=${js(String(g.kind))} titre=${js(g.titre)} />;\n}\n` });
    } else files.push({ name: `app${g.href}/page.tsx`, content: generic(g) });
  }
  return files;
}

function readme(p: Project, gen: ReturnType<typeof generationPlan>["gen"], skipped: string[], name: string, entite: string, booking?: Booking, unique?: number) {
  const c = p.config;
  const arch = archOf(c.templateId).id === "classic" ? null : archOf(c.templateId);
  return `# ${c.nom}

${c.description}

Projet Next.js généré par Décollage (type « ${TEMPLATE_BY_ID[c.templateId].nom} »${c.design ? `, design ${DESIGN_BY_ID[c.design]?.nom}` : ""}).
Le code est écrit à partir de modèles et de composants préprogrammés, sans IA.

## Ce qui fonctionne

- Ajouter, modifier et supprimer des ${entite.toLowerCase()}, avec recherche, filtres et tri.
- Les données sont **enregistrées dans le navigateur** (localStorage) : elles restent après actualisation et fermeture.
- Import et export **CSV** (page « ${gen.find((g) => g.kind === "settings")?.titre ?? "Données"} »).
- **Saisies vérifiées** avant tout enregistrement (\`lib/rules.ts\`) : champs obligatoires, e-mails, dates, nombres et montants. Une saisie refusée affiche son erreur et n'est pas enregistrée ; un import CSV écarte les lignes invalides.
${booking ? `- **Réservations** : créneaux de ${booking.duree} min, de ${booking.debut} à ${booking.fin}, ${booking.jours.length} jours par semaine (réglables dans \`lib/config.ts\`, clé \`booking\`). Une réservation passée, hors horaires ou sur un créneau déjà pris${booking.ressource !== undefined ? " pour la même ressource" : ""} est refusée ; l'annulation libère le créneau.\n` : ""}${unique !== undefined ? "- **Liste d'attente** : page publique `/inscription`, adresse e-mail vérifiée, une seule inscription par adresse.\n" : ""}${arch ? `- Architecture **« ${arch.nom} »** : ${arch.description}
- Site public : ${gen.filter((g) => g.zone === "site").map((g) => `${g.titre} (\`${g.href}\`)`).join(", ")}.
- Espace utilisateur (\`/app\`) : ${gen.filter((g) => g.zone === "app").map((g) => g.titre).join(", ")}.
` : `- Pages générées : ${gen.map((g) => g.titre).join(", ")}.
`}
## Ce qui n'est pas inclus (à brancher si besoin)

- **Comptes utilisateurs** : pas de connexion réelle.${c.modules.includes("auth") && arch ? " L'inscription crée un *compte local* (nom et email gardés dans ce navigateur, sans mot de passe ni serveur) : il sert à ouvrir l'espace, ce n'est pas une sécurité." : ""} Chaque navigateur a ses propres données ; rien n'est partagé entre appareils.
- **Base de données en ligne** : aucune. Pour partager des données, il faut un service (par exemple Supabase) et adapter \`lib/store.ts\`.${unique !== undefined ? " **Pour la liste d'attente**, une base Supabase est prévue (section « Base de données (Supabase) ») ; tant qu'elle n'est pas configurée, les inscriptions de tes visiteurs restent dans *leur* navigateur et ne te parviennent pas." : ""}${booking ? " **Important pour les réservations** : sans base de données, une réservation faite par un client n'est visible que dans son navigateur ; la protection contre les doubles réservations ne vaut que pour les réservations saisies dans le même navigateur." : ""}
- **Paiements** : non configurés. La page des offres est indicative. Pour encaisser, il faut un prestataire (par exemple Stripe) et un serveur.
${skipped.length ? `- Pages du prototype **non générées** dans cette version : ${skipped.join(", ")}.\n` : ""}
## Lancer le projet

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

\`\`\`bash
npm install
npm run dev
\`\`\`

Puis ouvre http://localhost:3000.

## Mettre en ligne

\`\`\`bash
npm run build
npm run start
\`\`\`

Le projet se déploie sur tout hébergeur compatible Next.js (par exemple Vercel ou Netlify, qui demandent un compte).
${unique !== undefined ? "Sans variable d'environnement, la liste d'attente fonctionne en mode local. Pour recevoir les inscriptions, configure la base de données ci-dessous." : "Aucune variable d'environnement ni clé n'est nécessaire dans cette version."}
${unique !== undefined ? SUPABASE_README : ""}
## Où modifier

- \`lib/config.ts\` : nom, colonnes, statuts, pages et données de départ.
- \`app/globals.css\` : couleurs (\`--p\`, \`--a\`) et style.
${arch ? `- \`components/site.tsx\` : le site public (accueil, fonctionnalités, tarifs, comptes).
- \`components/frame.tsx\` : le cadre de l'espace utilisateur (menu, en-tête).
- \`components/screens.tsx\` : les écrans de l'application.
` : ""}- \`components/views.tsx\` : les pages fonctionnelles${arch ? " communes (tableau, kanban, paramètres…)" : ""}.
- \`lib/store.ts\` : l'enregistrement des données (clé localStorage : \`${name}-donnees-v2\`).
`;
}
