import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, V } from "@/components/Legal";
import { LEGAL } from "@/data/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

type Ligne = { nom: string; donnees: string; base: string; oblig: string; dest: string; duree: string };

const TRAITEMENTS: Ligne[] = [
  { nom: "Compte et connexion", donnees: "Adresse e-mail. Il n'y a pas de mot de passe : tu te connectes avec un lien envoyé par e-mail.", base: "Exécution du contrat (fournir le compte)", oblig: "Obligatoire pour avoir un compte. Facultatif d'en avoir un : sans compte, tout reste dans ton navigateur.", dest: "Supabase ; service d'envoi d'e-mails de Supabase (à confirmer)", duree: "À définir. Aujourd'hui : tant que le compte existe, sans purge automatique. Proposition à confirmer : suppression après 24 mois d'inactivité, avec un e-mail d'avertissement." },
  { nom: "Session de connexion", donnees: "Jetons de session dans un cookie (voir la page Cookies).", base: "Nécessaire au service demandé (cookie strictement nécessaire)", oblig: "Obligatoire une fois connecté·e", dest: "Supabase", duree: "Cookie : 400 jours (valeur par défaut de la bibliothèque de connexion), jusqu'à la déconnexion. Proposition à confirmer : le raccourcir à 30-90 jours." },
  { nom: "Tes projets et favoris", donnees: "Configuration, textes, logo, prix, feuille de route, journal d'activité, favoris, formule.", base: "Exécution du contrat", oblig: "Nécessaire pour les retrouver sur plusieurs appareils ; sans compte, rien n'est envoyé", dest: "Supabase", duree: "À définir. Aujourd'hui : tant que le projet ou le compte existe. Proposition à confirmer : mêmes règles que le compte (24 mois d'inactivité)." },
  { nom: "Sites que tu publies", donnees: "Contenu public de ton site (textes, tarifs, logo).", base: "Exécution du contrat", oblig: "Facultatif : seulement si tu publies", dest: "Public (Internet) ; Supabase ; Vercel (mise en cache de 60 secondes)", duree: "Jusqu'à ce que tu dépublies ou que tu supprimes ton compte. Attention : supprimer un projet ne dépublie pas encore son site, pense à dépublier d'abord." },
  { nom: "Abonnement et paiement", donnees: "E-mail, identifiant utilisateur, formule, identifiants client et abonnement Stripe, statut de l'abonnement. Ta carte est saisie chez Stripe : nous n'y avons jamais accès.", base: "Exécution du contrat", oblig: "Obligatoire pour souscrire une formule payante", dest: "Stripe ; Supabase", duree: "Supabase : tant que le compte existe. Stripe : voir « Pièces comptables »." },
  { nom: "Pièces comptables (factures, paiements)", donnees: "Factures et justificatifs de paiement conservés chez Stripe.", base: "Obligation légale (comptabilité)", oblig: "Obligatoire pour toute vente", dest: "Stripe ; l'éditeur (comptabilité)", duree: "10 ans proposés, durée usuelle des pièces comptables (à confirmer). Elles ne sont pas supprimées avec le compte." },
  { nom: "Preuve d'acceptation des conditions", donnees: "Compte, date et heure, version des conditions acceptées (et, pour un achat, des cases cochées). Fonction en cours de mise en place, à confirmer.", base: "Intérêt légitime (pouvoir prouver ce qui a été accepté)", oblig: "Obligatoire pour souscrire", dest: "Supabase", duree: "À définir. Proposition à confirmer : rattachée aux délais de prescription (2 à 5 ans)." },
  { nom: "Sécurité et diagnostic", donnees: "Journaux techniques : adresse IP, adresse demandée, navigateur, erreurs.", base: "Intérêt légitime (sécurité, bon fonctionnement)", oblig: "Collectés automatiquement à chaque visite, y compris sans compte", dest: "Vercel ; Supabase (journaux de connexion)", duree: "À définir : dépend des réglages de l'hébergeur, non vérifiés. Proposition à confirmer : 6 à 12 mois maximum." },
  { nom: "Limitation des abus sur les inscriptions", donnees: "Adresse IP gardée en mémoire du serveur environ une minute, jamais écrite en base.", base: "Intérêt légitime (éviter le spam)", oblig: "Automatique lors d'une inscription à une liste d'attente", dest: "Aucun", duree: "Environ 60 secondes" },
  { nom: "Messages envoyés à l'éditeur", donnees: "Ce que tu écris dans ton e-mail, ton adresse.", base: "Intérêt légitime (te répondre) ou exécution du contrat", oblig: "Facultatif", dest: "Fournisseur de messagerie de l'éditeur (à compléter)", duree: "À définir." },
];

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité" doc="confidentialite">
      <p>Ici, on t&apos;explique simplement quelles données {LEGAL.marque} utilise, pourquoi, qui y a accès, combien de temps elles sont gardées et comment faire valoir tes droits. Cette page décrit ce que le code du service fait aujourd&apos;hui ; ce qui n&apos;est pas encore décidé est marqué « à définir » ou « à confirmer ».</p>

      <h2>Qui est responsable de tes données ?</h2>
      <p>
        <V v={LEGAL.editeur} label="Prénom et nom de l'éditeur" /> ({LEGAL.marque}), joignable à <Mail /> ou via la page <Link href="/contact">Contact</Link>.
        Il n&apos;y a pas de délégué à la protection des données désigné à ce jour (à confirmer).
      </p>

      <h2>Sans compte</h2>
      <p>Tu peux utiliser {LEGAL.marque} sans compte : tes projets restent dans ton navigateur (stockage local) et ne nous sont pas transmis. Les journaux techniques de l&apos;hébergeur existent quand même (adresse IP, page demandée).</p>

      <h2>Ce qu&apos;on fait avec tes données</h2>
      <div className="tablewrap" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal possible)">
        <table>
          <thead><tr><th>Traitement</th><th>Données</th><th>Base légale</th><th>Obligatoire ?</th><th>Qui y accède</th><th>Durée</th></tr></thead>
          <tbody>
            {TRAITEMENTS.map((t) => (
              <tr key={t.nom}><th scope="row">{t.nom}</th><td>{t.donnees}</td><td>{t.base}</td><td>{t.oblig}</td><td>{t.dest}</td><td>{t.duree}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Tes données ne sont pas vendues et ne servent pas à de la publicité. Le moteur Décollage applique des règles écrites à l&apos;avance : il ne prend aucune décision automatisée qui aurait des effets juridiques sur toi.</p>

      <h2>Les inscrits aux listes d&apos;attente de sites publiés</h2>
      <p>
        Si tu es utilisateur·rice et que tu publies un site avec une liste d&apos;attente, tu es responsable du traitement des adresses e-mail que tes visiteurs y laissent ; {LEGAL.marque} les héberge et les met à ta disposition pour ton compte (sous-traitant). Elles ne sont visibles que de toi. Aucun message n&apos;est envoyé par {LEGAL.marque} à tes inscrits. Pense à informer tes visiteurs et à pouvoir les désinscrire.
      </p>
      <p>
        Si tu es visiteur·se d&apos;un site publié et que tu as laissé ton e-mail, adresse-toi d&apos;abord au propriétaire du site. Pour l&apos;instant, le formulaire n&apos;offre pas de désinscription automatique : tu peux nous écrire via la page <Link href="/contact">Contact</Link> en indiquant le site et ton adresse.
      </p>
      <p>Si une police de caractères autre que « Système » (ou le style « Luxe ») est choisie, la page concernée charge cette police depuis Google Fonts : Google reçoit alors l&apos;adresse IP et le navigateur de la personne qui la regarde. Cela vaut pour les sites publiés (leurs visiteurs) et aussi pour les aperçus affichés dans {LEGAL.marque} lorsque tu essaies une telle police. C&apos;est le seul service tiers contacté que nous ayons trouvé dans le code. Les polices de l&apos;interface de {LEGAL.marque} elle-même sont, elles, copiées au moment de la construction du site (aucun appel à Google). Remplacer ces polices par des polices hébergées sur le site est à l&apos;étude (à confirmer).</p>

      <h2>Les prestataires (destinataires)</h2>
      <ul>
        <li><b>Supabase</b> : comptes, connexion par lien, base de données (projets, sites publiés, listes d&apos;attente).</li>
        <li><b>Stripe</b> : paiements, abonnements, factures, portail de gestion de l&apos;abonnement.</li>
        <li><b>{LEGAL.hebergeur.nom}</b> : hébergement du site et journaux techniques.</li>
      </ul>
      <p>Un contrat de sous-traitance (DPA) avec chacun est à confirmer par l&apos;éditeur.</p>

      <h2>Transferts hors de l&apos;Union européenne</h2>
      <p>
        {LEGAL.hebergeur.nom} est une société des États-Unis, et Stripe comme Supabase peuvent aussi traiter des données hors de l&apos;Union européenne. La région exacte des serveurs Supabase et les garanties de transfert (clauses contractuelles types, éventuelle certification au Data Privacy Framework) <b>sont à confirmer</b> : nous n&apos;affirmons rien à ce sujet tant que ce n&apos;est pas vérifié.
      </p>

      <h2>Sécurité</h2>
      <ul>
        <li>Connexion par lien à usage unique envoyé par e-mail : il n&apos;y a pas de mot de passe à voler.</li>
        <li>Règles d&apos;accès dans la base : chaque utilisateur ne peut lire que ses propres projets et ses propres inscrits.</li>
        <li>Clés secrètes (Stripe, base de données) gardées côté serveur uniquement ; carte bancaire saisie chez Stripe.</li>
      </ul>
      <p>Aucun système n&apos;est infaillible. En cas de violation de données qui présente un risque pour toi, la loi prévoit d&apos;en informer la CNIL (sous 72 heures) et, selon la gravité, les personnes concernées.</p>

      <h2>Tes droits et comment les exercer</h2>
      <p>Tu peux demander l&apos;accès à tes données, leur rectification, leur effacement, la limitation du traitement, t&apos;y opposer, et récupérer tes données dans un format réutilisable (portabilité). Quand un traitement repose sur ton consentement, tu peux le retirer à tout moment.</p>
      <ul>
        <li><b>Toi-même, dans le service</b> : Paramètres, « Exporter toutes mes données » (fichier JSON), supprimer un projet, dépublier un site, « Supprimer mon compte ».</li>
        <li><b>Par écrit</b> : via la page <Link href="/contact">Contact</Link> ou à <Mail />. Si on a un doute sur ton identité, on peut te demander une preuve. La loi prévoit un délai de réponse d&apos;un mois, prolongeable dans certains cas.</li>
      </ul>
      <p>Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la CNIL : <a href="https://www.cnil.fr/fr/plaintes">www.cnil.fr/fr/plaintes</a>.</p>

      <h2>Supprimer ton compte : ce qui part, ce qui reste</h2>
      <p><b>Supprimé</b> : ton compte et ton e-mail dans la base, ton profil, tes projets, tes sites publiés et leurs listes d&apos;attente. Ton abonnement est résilié immédiatement.</p>
      <p><b>Conservé</b> : le client Stripe (donc l&apos;e-mail et l&apos;identifiant utilisateur qui y figurent) et les factures, parce que la loi impose de garder les pièces comptables. <b>Hors de notre contrôle</b> : ce qui est dans ton navigateur (efface-le avec Paramètres, « Tout effacer », ou les réglages du navigateur), les fichiers que tu as exportés, et les sauvegardes de Supabase dont la durée est à confirmer.</p>

      <h2>Cookies et stockage local</h2>
      <p>Pas de cookie publicitaire, pas de mesure d&apos;audience. Détails sur la page <Link href="/cookies">Cookies</Link>.</p>

      <h2>Changements</h2>
      <p>Si cette page change sur le fond, la date et la version en haut changent. Une version plus ancienne peut être demandée via la page <Link href="/contact">Contact</Link>.</p>
    </LegalPage>
  );
}
