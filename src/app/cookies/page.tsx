import type { Metadata } from "next";
import Link from "next/link";
import { ManageCookiesButton } from "@/components/ConsentManager";
import { LegalPage } from "@/components/Legal";
import { LEGAL } from "@/data/legal";
import { CONSENT_MONTHS, OPTIONAL_TRACKERS } from "@/lib/consent/consent";

export const metadata: Metadata = { title: "Cookies et stockage local" };

export default function Cookies() {
  return (
    <LegalPage title="Cookies et stockage local" doc="cookies">
      <p>
        {OPTIONAL_TRACKERS.length === 0
          ? `Aujourd'hui, ${LEGAL.marque} n'utilise aucun cookie ni traceur facultatif : pas de mesure d'audience, pas de publicité, pas de pixel, pas de vidéo intégrée depuis un autre site. C'est pour cela qu'aucune bannière ne s'affiche.`
          : `${LEGAL.marque} utilise des services facultatifs : ils ne se chargent qu'avec ton accord, que tu peux donner ou retirer ci-dessous.`}
      </p>
      <p>Si on ajoute un jour un traceur facultatif, on te demandera ton accord avant de le charger, refuser sera aussi simple qu&apos;accepter, et tu pourras changer d&apos;avis ici à tout moment. Ton choix n&apos;a aucun lien avec l&apos;acceptation des conditions d&apos;utilisation.</p>
      <p><ManageCookiesButton className="btn btn-ghost btn-sm" /></p>

      <h2>Ce qui est utilisé, parce que le service en a besoin</h2>
      <div className="tablewrap" tabIndex={0} role="region" aria-label="Tableau (défilement horizontal possible)">
        <table>
          <thead><tr><th>Nom</th><th>Type</th><th>À quoi ça sert</th><th>Quand</th><th>Durée</th></tr></thead>
          <tbody>
            <tr><th scope="row">sb-…-auth-token (parfois en morceaux .0, .1) et sb-…-code-verifier</th><td>Cookie</td><td>Te garder connecté·e (Supabase). Le second sert pendant la connexion par lien.</td><td>Seulement après que tu as demandé à te connecter. Rien n&apos;est posé lors d&apos;une visite anonyme.</td><td>400 jours au maximum (valeur par défaut de la bibliothèque), jusqu&apos;à la déconnexion. Pas de suivi.</td></tr>
            <tr><th scope="row">decollage.data.v2</th><td>Stockage local</td><td>Tes projets, favoris, formule et préférences (animations, densité).</td><td>Dès que tu utilises le service, même sans compte.</td><td>Sans limite, jusqu&apos;à ce que tu l&apos;effaces (Paramètres, « Tout effacer »).</td></tr>
            <tr><th scope="row">decollage.owner</th><td>Stockage local</td><td>Ne jamais mélanger les projets de deux comptes sur le même navigateur.</td><td>Après connexion.</td><td>Effacé à la déconnexion.</td></tr>
            <tr><th scope="row">decollage.consent</th><td>Stockage local</td><td>Se souvenir de ton choix sur les cookies facultatifs.</td><td>Seulement si tu fais un choix dans le panneau.</td><td>{CONSENT_MONTHS} mois, puis on te redemande.</td></tr>
            <tr><th scope="row">decollage-app:…</th><td>Stockage local</td><td>Données d&apos;exemple saisies dans l&apos;application de démonstration d&apos;un site publié.</td><td>Quand tu utilises cette démonstration.</td><td>Sans limite, jusqu&apos;à ce que tu l&apos;effaces dans ton navigateur.</td></tr>
          </tbody>
        </table>
      </div>
      <p>Ces éléments sont strictement nécessaires au service que tu demandes : ils ne demandent pas de consentement. Ils ne contiennent aucun identifiant publicitaire.</p>

      <h2>Ce qui n&apos;est pas utilisé</h2>
      <ul>
        <li>Mesure d&apos;audience : aucune.</li>
        <li>Publicité et pixels de suivi : aucun.</li>
        <li>Vidéos ou contenus intégrés depuis d&apos;autres sites : aucun.</li>
        <li>Polices : celles de l&apos;interface sont copiées sur le site à la construction (aucun appel à Google). Exception : si une police autre que « Système » (ou le style « Luxe ») est choisie pour un projet, les aperçus et les sites publiés chargent cette police depuis Google Fonts, qui reçoit alors l&apos;adresse IP. Pas de cookie dans ce cas, mais un contact avec un tiers : voir la <Link href="/confidentialite">politique de confidentialité</Link>.</li>
      </ul>

      <h2>Les supprimer</h2>
      <p>Tu peux supprimer cookies et stockage local depuis les réglages de ton navigateur. Se déconnecter supprime la session. Attention : effacer le stockage local efface les projets non synchronisés avec un compte ; exporte-les avant (Paramètres, « Exporter toutes mes données »).</p>
    </LegalPage>
  );
}
