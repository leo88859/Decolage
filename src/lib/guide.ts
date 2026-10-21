import { TEMPLATE_BY_ID } from "@/data/templates";
import { slug } from "@/lib/export";
import type { Config, Pricing } from "@/lib/types";

// Guide de mise en production, assemblé à partir de la configuration du projet (règles fixes).

export type GuideStep = {
  id: string;
  titre: string;
  pourquoi: string;
  duree: string;
  actions: string[];
  code?: { label: string; content: string }[];
  liens?: { label: string; url: string }[];
  attention?: string;
};

const ident = (s: string) => slug(s).replace(/-/g, "_") || "element";
const envName = (s: string) => slug(s).replace(/-/g, "_").toUpperCase() || "OFFRE";

/** SQL des tables du SaaS : l'élément principal du modèle, et profils / abonnements si besoin. */
export function schemaSql(cfg: Config): string {
  const t = TEMPLATE_BY_ID[cfg.templateId];
  const table = ident(t.entite.pluriel);
  const auth = cfg.modules.includes("auth");
  const cols = t.entite.champs.map((c) => `  ${ident(c)} text`).join(",\n");
  const parts: string[] = [`-- Tables de « ${cfg.nom} » (modèle ${t.nom}). À coller dans Supabase → SQL Editor → Run.`];

  if (auth) {
    parts.push(`create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text,
  role text not null default '${(cfg.roles[0] ?? "Utilisateur").replace(/'/g, "''")}',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profil : lecture et modification par son propriétaire" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);`);
  }

  parts.push(`create table public.${table} (
  id uuid primary key default gen_random_uuid(),
${auth ? "  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,\n" : ""}${cols},
  created_at timestamptz not null default now()
);
alter table public.${table} enable row level security;
${auth
  ? `create policy "${table} : accès par leur propriétaire" on public.${table}
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`
  : `-- Sans comptes : les visiteurs peuvent seulement AJOUTER (ex. inscription), jamais lire la liste.
create policy "${table} : ajout public" on public.${table} for insert to anon with check (true);`}`);

  if (needsPayment(cfg)) {
    parts.push(`create table public.subscriptions (
  id text primary key,                       -- identifiant de l'abonnement Stripe
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "abonnement : lecture par son propriétaire" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Les écritures se font uniquement depuis le webhook Stripe, avec la clé service_role.`);
  }
  return parts.join("\n\n") + "\n";
}

export const needsPayment = (cfg: Config) => cfg.revenu !== "gratuit" || cfg.modules.includes("abonnement");

const paidOffers = (pricing: Pricing | null) => (pricing?.offres ?? []).filter((o) => o.prix > 0);

export function envTemplate(cfg: Config, pricing: Pricing | null): string {
  const lines = [
    "# Supabase → Project Settings → API",
    "NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
  ];
  if (needsPayment(cfg)) {
    lines.push("SUPABASE_SERVICE_ROLE_KEY=           # secrète : jamais dans le navigateur", "", "# Stripe → Développeurs → Clés API / Webhooks", "STRIPE_SECRET_KEY=sk_test_...", "STRIPE_WEBHOOK_SECRET=whsec_...");
    for (const o of paidOffers(pricing)) lines.push(`STRIPE_PRICE_${envName(o.nom)}=price_...   # ${o.nom} : ${o.prix} € ${o.periode === "unique" ? "une fois" : `/ ${o.periode}`}`);
  }
  lines.push("", "# Adresse publique du site (sans / final)", `NEXT_PUBLIC_APP_URL=https://${cfg.domaine || `${slug(cfg.nom)}.vercel.app`}`);
  return lines.join("\n");
}

export function buildGuide(cfg: Config, pricing: Pricing | null): GuideStep[] {
  const auth = cfg.modules.includes("auth");
  const pay = needsPayment(cfg);
  const offers = paidOffers(pricing);
  const domain = cfg.domaine || "ton-domaine.fr";
  const steps: GuideStep[] = [];

  steps.push({
    id: "comptes", titre: "Créer les comptes nécessaires", duree: "30 min",
    pourquoi: "Chaque service a un rôle : le code (GitHub), l'hébergement (Vercel), la base de données et les comptes (Supabase)" + (pay ? ", les paiements (Stripe)" : "") + ".",
    actions: [
      "Crée un compte GitHub (gratuit) : c'est là que vivra le code de ton SaaS.",
      "Crée un compte Vercel en te connectant avec GitHub : il mettra ton site en ligne.",
      "Crée un compte Supabase (offre gratuite pour démarrer).",
      ...(pay ? ["Crée un compte Stripe : tu peux tout tester en mode test sans rien payer ni encaisser."] : []),
      "Facultatif : réserve un nom de domaine chez un registraire (environ 10 à 20 € par an selon l'extension).",
    ],
    liens: [
      { label: "GitHub", url: "https://github.com/signup" },
      { label: "Vercel", url: "https://vercel.com/signup" },
      { label: "Supabase", url: "https://supabase.com/dashboard" },
      ...(pay ? [{ label: "Stripe", url: "https://dashboard.stripe.com/register" }] : []),
    ],
    attention: "Vérifie les conditions des offres gratuites : par exemple, l'offre gratuite de Vercel est réservée aux projets non commerciaux. Dès que tu encaisses de l'argent, prévois l'offre payante.",
  });

  steps.push({
    id: "code", titre: "Obtenir le code de l'application", duree: "Variable",
    pourquoi: "Décollage te donne un prototype, une landing et une configuration. Il faut maintenant construire la vraie application.",
    actions: [
      "Télécharge l'archive du projet (onglet Export) : elle contient la landing, le prototype et decollage.json.",
      "Option sans code : recrée les pages listées dans le README avec un outil no-code qui se branche sur Supabase.",
      "Option avec code : crée une application Next.js et reproduis les pages du prototype, ou confie-le à un développeur avec l'archive.",
      `Pages à prévoir : ${TEMPLATE_BY_ID[cfg.templateId].pages.map((p) => p.titre).join(", ")}${auth ? ", Connexion, Profil" : ""}.`,
    ],
    code: [{ label: "Démarrer une application Next.js (option code)", content: `npx create-next-app@latest ${slug(cfg.nom)}\ncd ${slug(cfg.nom)}\nnpm install @supabase/supabase-js @supabase/ssr${pay ? " stripe" : ""}` }],
    attention: "Décollage ne génère pas encore le code complet de l'application : cette étape reste à faire.",
  });

  steps.push({
    id: "supabase", titre: "Configurer la base de données (Supabase)", duree: "20 min",
    pourquoi: "Supabase stocke les données de tes utilisateurs et protège l'accès avec des règles (RLS) : chacun ne voit que ses données.",
    actions: [
      "Dans Supabase, clique sur « New project ». Choisis une région en Europe (proche de tes utilisateurs, et plus simple pour le RGPD).",
      "Note bien le mot de passe de la base dans un gestionnaire de mots de passe.",
      "Ouvre « SQL Editor », colle le script ci-dessous, puis clique sur « Run ».",
      "Va dans « Project Settings → API » et copie l'URL du projet et la clé « anon » (publique).",
      ...(pay ? ["Copie aussi la clé « service_role » : elle est SECRÈTE et ne doit servir que côté serveur (webhook Stripe)."] : []),
    ],
    code: [{ label: "Script SQL de tes tables", content: schemaSql(cfg) }],
    liens: [{ label: "Tableau de bord Supabase", url: "https://supabase.com/dashboard" }],
  });

  if (auth) {
    steps.push({
      id: "auth", titre: "Activer les comptes utilisateurs", duree: "15 min",
      pourquoi: `Ton SaaS utilise la connexion (${cfg.reglages["auth.methode"] ?? "Email + mot de passe"}). Supabase gère l'inscription, la connexion et les emails.`,
      actions: [
        "Dans « Authentication → Sign In / Providers », vérifie que le fournisseur Email est activé.",
        `Dans « Authentication → URL Configuration », mets l'adresse du site (https://${domain}) comme Site URL, et ajoute https://${domain}/auth/callback dans les Redirect URLs.`,
        "Personnalise les emails (« Email Templates ») avec le nom de ton SaaS.",
        "Avant d'avoir de vrais utilisateurs, configure un service d'envoi d'emails (SMTP) : l'envoi intégré de Supabase est très limité.",
      ],
    });
  }

  if (pay) {
    steps.push({
      id: "stripe", titre: "Brancher les paiements (Stripe)", duree: "45 min",
      pourquoi: "Stripe encaisse les paiements par carte, gère les abonnements et envoie les factures. Ton site ne voit jamais les numéros de carte.",
      actions: [
        "Reste en mode test (interrupteur « Test mode ») tant que tout n'est pas vérifié.",
        offers.length
          ? `Dans « Catalogue de produits », crée un produit par offre payante : ${offers.map((o) => `« ${o.nom} » à ${o.prix} € ${o.periode === "unique" ? "(paiement unique)" : `par ${o.periode}`}`).join(", ")}.`
          : "Dans « Catalogue de produits », crée tes produits et leurs prix (définis-les d'abord dans l'onglet Prix).",
        "Copie l'identifiant de chaque prix (commence par price_…) dans tes variables d'environnement.",
        `Dans « Développeurs → Webhooks », ajoute l'adresse https://${domain}/api/stripe/webhook avec les événements checkout.session.completed et customer.subscription.created / updated / deleted.`,
        "Copie la clé de signature du webhook (whsec_…).",
        ...(cfg.revenu === "abonnement" || cfg.modules.includes("abonnement") ? ["Active le « Portail client » pour que tes abonnés puissent changer d'offre ou résilier seuls (la résiliation en ligne simple est une obligation pour les abonnements)."] : []),
        "Teste un paiement avec la carte de test 4242 4242 4242 4242 (n'importe quelle date future et n'importe quel code).",
      ],
      liens: [{ label: "Tableau de bord Stripe", url: "https://dashboard.stripe.com" }, { label: "Cartes de test Stripe", url: "https://docs.stripe.com/testing" }],
      attention: "Vérifie les frais de Stripe sur sa page de tarifs : ils sont prélevés sur chaque paiement. Pour encaisser, il te faut un statut (par exemple micro-entreprise).",
    });
  }

  steps.push({
    id: "env", titre: "Préparer les variables d'environnement", duree: "10 min",
    pourquoi: "Les clés relient ton code à Supabase" + (pay ? " et Stripe" : "") + ". Elles ne doivent jamais être publiées sur GitHub.",
    actions: [
      "Crée un fichier .env.local à la racine du projet avec le contenu ci-dessous, en remplaçant les valeurs.",
      "Vérifie que .env.local est bien listé dans le fichier .gitignore.",
      "Seules les variables qui commencent par NEXT_PUBLIC_ sont visibles dans le navigateur : n'y mets jamais de clé secrète.",
    ],
    code: [{ label: ".env.local", content: envTemplate(cfg, pricing) }],
  });

  steps.push({
    id: "vercel", titre: "Mettre en ligne (Vercel)", duree: "15 min",
    pourquoi: "Vercel construit ton application à chaque modification sur GitHub et la sert dans le monde entier.",
    actions: [
      "Envoie ton code sur un dépôt GitHub (privé de préférence).",
      "Dans Vercel, clique sur « Add New → Project » et importe ce dépôt.",
      "Avant de lancer le déploiement, ajoute toutes les variables d'environnement (Settings → Environment Variables).",
      "Clique sur « Deploy » : ton site est disponible sur une adresse en .vercel.app.",
    ],
    liens: [{ label: "Nouveau projet Vercel", url: "https://vercel.com/new" }],
  });

  steps.push({
    id: "domaine", titre: "Brancher ton nom de domaine", duree: "30 min (+ propagation)",
    pourquoi: "Une adresse à ton nom inspire confiance et se retient mieux.",
    actions: [
      `Dans Vercel, ouvre « Settings → Domains » et ajoute ${domain}.`,
      "Vercel t'indique les enregistrements DNS à créer chez ton registraire : recopie-les exactement.",
      "Attends la propagation (de quelques minutes à quelques heures) : le cadenas HTTPS s'active tout seul.",
      ...(auth ? [`Mets à jour la Site URL et les Redirect URLs dans Supabase avec https://${domain}.`] : []),
      ...(pay ? [`Mets à jour l'adresse du webhook dans Stripe avec https://${domain}/api/stripe/webhook.`] : []),
      `Mets à jour NEXT_PUBLIC_APP_URL dans Vercel avec https://${domain}, puis redéploie.`,
    ],
  });

  steps.push({
    id: "legal", titre: "Les pages légales", duree: "2 à 3 h",
    pourquoi: "Un site public qui collecte des données doit afficher certaines informations, sinon tu risques une sanction.",
    actions: [
      "Mentions légales : qui édite le site, comment te contacter, qui l'héberge.",
      "Politique de confidentialité : quelles données tu collectes (emails, comptes…), pourquoi, combien de temps, et comment les supprimer.",
      "Conditions d'utilisation : ce que l'utilisateur peut faire, tes responsabilités.",
      ...(pay ? ["Conditions générales de vente : prix, paiement, résiliation, droit de rétractation."] : []),
      "Bandeau cookies : seulement si tu utilises des cookies non indispensables (statistiques, publicité).",
      ...(pay ? ["Pour encaisser de l'argent, il te faut un statut (par exemple micro-entreprise) : renseigne-toi sur les démarches officielles."] : []),
    ],
    liens: [{ label: "CNIL : guide RGPD", url: "https://www.cnil.fr/fr/rgpd-par-ou-commencer" }, { label: "Créer une micro-entreprise", url: "https://www.autoentrepreneur.urssaf.fr" }],
    attention: "Ces pages engagent ta responsabilité : en cas de doute, fais-les relire par un professionnel.",
  });

  steps.push({
    id: "tests", titre: "Tester avant le lancement", duree: "2 h",
    pourquoi: "Le premier visiteur ne doit pas tomber sur une erreur.",
    actions: [
      ...(auth ? ["Crée un compte, déconnecte-toi, reconnecte-toi."] : []),
      "Ajoute, modifie et supprime des données : vérifie qu'elles sont bien enregistrées.",
      ...(auth ? ["Avec deux comptes différents, vérifie que chacun ne voit QUE ses propres données."] : []),
      ...(pay ? ["Fais un paiement test, puis une résiliation : vérifie que l'accès change bien."] : []),
      "Teste sur téléphone (iPhone et Android) et sur un petit écran.",
      "Fais tester le parcours à 3 personnes sans les aider, et note où elles bloquent.",
    ],
  });

  if (pay) {
    steps.push({
      id: "live", titre: "Passer les paiements en réel", duree: "1 h (+ vérification Stripe)",
      pourquoi: "En mode test, aucun argent n'est encaissé. Le passage en réel demande de vérifier ton identité.",
      actions: [
        "Dans Stripe, active ton compte : identité, statut, compte bancaire où recevoir l'argent.",
        "Recrée tes produits et prix en mode réel (ils ne sont pas copiés depuis le mode test).",
        "Crée le webhook en mode réel, puis remplace dans Vercel les clés de test par les clés réelles (sk_live_…, nouveau whsec_…, nouveaux price_…).",
        "Redéploie et fais un vrai petit paiement, puis rembourse-le pour vérifier tout le circuit.",
      ],
    });
  }

  steps.push({
    id: "apres", titre: "Après le lancement", duree: "Chaque semaine",
    pourquoi: "Un SaaS en ligne se surveille : erreurs, sauvegardes, retours des utilisateurs.",
    actions: [
      "Vérifie quelles sauvegardes de base de données sont incluses dans ton offre Supabase.",
      "Consulte régulièrement les journaux d'erreurs dans Vercel.",
      "Relève tes chiffres chaque semaine (onglet Indicateurs) et réponds à chaque retour d'utilisateur.",
    ],
  });

  return steps;
}
