import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, P, V } from "@/components/Legal";
import { LEGAL, PROPOSITIONS } from "@/data/legal";

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function Cgu() {
  return (
    <LegalPage title="Conditions générales d'utilisation" doc="cgu">
      <p>Ces conditions expliquent les règles d&apos;utilisation de {LEGAL.marque} (<P v={LEGAL.site} proposition={PROPOSITIONS.site} />). Les règles d&apos;achat d&apos;une formule payante sont dans les <Link href="/cgv">conditions générales de vente</Link>. Tes données personnelles sont expliquées dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>

      <h2>1. Le service</h2>
      <p>{LEGAL.marque} est un constructeur guidé de micro-SaaS. Tu décris ton idée, tu choisis un design, et le moteur Décollage assemble pour toi, à partir de modèles écrits à l&apos;avance, une application interactive, une page de vente, un plan de lancement et du code exportable. Le service est édité par <V v={LEGAL.editeur} label="Prénom et nom de l'éditeur" /> (voir les <Link href="/mentions-legales">mentions légales</Link>).</p>
      <p>Le moteur ne garantit ni le succès commercial d&apos;un projet, ni qu&apos;il convienne à ton cas précis : il t&apos;aide à démarrer. C&apos;est à toi de vérifier ce que tu publies et ce que tu en fais.</p>

      <h2>2. Utiliser sans compte, ou avec un compte</h2>
      <p>Tu peux essayer le service sans compte : tes projets restent dans ton navigateur. Pour les synchroniser, publier un site ou souscrire une formule, tu crées un compte avec ton adresse e-mail (connexion par lien envoyé par e-mail, sans mot de passe). Tu es responsable de l&apos;accès à ta boîte mail, et tu nous donnes une adresse qui t&apos;appartient. Un compte est personnel.</p>

      <h2>3. Ce que tu peux faire, et ce qui est interdit</h2>
      <ul>
        <li>Créer des projets, les exporter, les modifier, les publier, les utiliser dans ton activité.</li>
        <li>Interdit : publier un contenu illégal, trompeur, haineux ou qui porte atteinte aux droits d&apos;autrui (marques, droit d&apos;auteur, vie privée) ; usurper une identité ; collecter des adresses e-mail sans en informer les personnes ; essayer de perturber ou de contourner la sécurité du service ; en abuser par des requêtes automatisées excessives.</li>
      </ul>

      <h2>4. Tes contenus et tes projets</h2>
      <p>Tu restes propriétaire de ce que tu écris et de tes projets. Tu nous autorises seulement à les stocker, les afficher à l&apos;adresse que tu choisis quand tu publies, et les traiter pour faire fonctionner le service. Tu es responsable de ce que tu publies. Le code exporté t&apos;appartient ; le brancher à des services en ligne (comptes, base de données, paiements) reste à ta charge.</p>

      <h2>5. Sites publiés et listes d&apos;attente</h2>
      <p>Un site publié est visible par tout le monde. Si tu y collectes des adresses e-mail, tu es responsable de ces données : informe tes visiteurs de ce que tu en fais et permets-leur de se désinscrire (voir la <Link href="/confidentialite">politique de confidentialité</Link>). Un site illicite peut être signalé via la page <Link href="/contact">Contact</Link>. En cas de contenu manifestement illicite ou d&apos;abus, l&apos;éditeur peut dépublier le site ; quand c&apos;est possible, on te prévient et on t&apos;explique pourquoi.</p>

      <h2>6. Disponibilité et responsabilité</h2>
      <p>Le service est fourni avec soin, mais peut être interrompu (maintenance, panne, incident chez un prestataire). Exporte régulièrement tes données (Paramètres, « Exporter toutes mes données »). Pour un consommateur, ces conditions ne limitent pas les droits que la loi te donne. Pour un professionnel, la responsabilité de l&apos;éditeur est limitée aux sommes payées au cours des 12 derniers mois, sauf faute lourde, faute dolosive ou dommage corporel.</p>

      <h2>7. Suspension et fin du compte</h2>
      <p>Tu peux supprimer ton compte à tout moment (Paramètres, « Supprimer mon compte ») : cela efface tes données et résilie ton abonnement ; voir la politique de confidentialité pour ce qui est conservé. L&apos;éditeur peut suspendre un compte qui enfreint gravement ces règles, en t&apos;en expliquant la raison quand c&apos;est possible.</p>

      <h2>8. Cookies : ton choix est séparé</h2>
      <p>Accepter ces conditions n&apos;implique aucun consentement aux cookies ou traceurs facultatifs. Ils sont gérés à part (<Link href="/cookies">page Cookies</Link>).</p>

      <h2>9. Modifier ces conditions</h2>
      <p>Si ces conditions changent sur le fond, la date et la version en haut de la page changent, et on te le signale avant que la nouvelle version s&apos;applique à toi lorsque la loi l&apos;exige. Les versions précédentes peuvent être demandées via la page <Link href="/contact">Contact</Link>.</p>

      <h2>10. Droit applicable</h2>
      <p>Ces conditions sont soumises au droit français. Si tu es consommateur, tu peux saisir le tribunal de ton domicile ; voir aussi la médiation dans les conditions de vente.</p>
    </LegalPage>
  );
}
