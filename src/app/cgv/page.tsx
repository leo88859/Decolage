import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail } from "@/components/Legal";
import { LEGAL } from "@/data/legal";
import { PAID_PLANS, PLANS, prixLabel } from "@/lib/plans";

export const metadata: Metadata = { title: "Conditions générales de vente" };

const limite = (n: number) => (n === Infinity ? "illimités" : String(n));

export default function Cgv() {
  return (
    <LegalPage title="Conditions générales de vente" doc="cgv">
      <h2>1. Qui vend ?</h2>
      <p>
        Le vendeur est {LEGAL.editeur ? <>{LEGAL.editeur} ({LEGAL.marque})</> : LEGAL.marque}{LEGAL.statut ? <>, {LEGAL.statut}</> : null}{LEGAL.siret ? <>, SIRET {LEGAL.siret}</> : null}{LEGAL.adresse ? <>, {LEGAL.adresse}</> : null}{LEGAL.email ? <>, e-mail <Mail /></> : null}. Voir les <Link href="/mentions-legales">mentions légales</Link>.
      </p>

      <h2>2. À qui s&apos;adressent ces conditions ?</h2>
      <p>Elles s&apos;appliquent à la souscription d&apos;une formule payante de {LEGAL.marque}. Les passages marqués « consommateur » (rétractation, médiation) concernent une personne qui achète pour un usage en dehors de son activité professionnelle. Si tu achètes pour ton activité professionnelle, ces droits ne s&apos;appliquent pas, sauf si la loi en dispose autrement ; le reste des conditions s&apos;applique aux deux.</p>

      <h2>3. Les formules et leurs prix</h2>
      <p>Toutes les formules payantes ont toutes les fonctions ; seules les quantités changent.</p>
      <ul>
        <li>{PLANS.gratuit.nom} : {prixLabel("gratuit")}, pour découvrir en aperçu (pas de projet enregistré ni de site publié).</li>
        {PAID_PLANS.map((p) => (
          <li key={p}>{PLANS[p].nom} : {prixLabel(p)}, {limite(PLANS[p].maxProjets)} projet(s) et {limite(PLANS[p].maxSites)} site(s) publié(s) en même temps.</li>
        ))}
      </ul>
      <p>Prix en euros, payés chaque mois. {LEGAL.tva ? <>TVA : {LEGAL.tva}. </> : null} Le prix applicable est celui affiché au moment de ta commande, sur la page de paiement.</p>

      <h2>4. Commander</h2>
      <p>Tu te connectes, tu choisis une formule dans Paramètres, puis tu es redirigé·e vers la page de paiement sécurisée de Stripe. Avant de payer, tu vérifies le récapitulatif ; en payant, tu passes une commande avec obligation de paiement. Avant d&apos;arriver au paiement, tu coches les cases qui te sont proposées : acceptation de ces conditions et, si tu veux utiliser le service tout de suite, demande d&apos;exécution immédiate (voir l&apos;article 8). La commande est confirmée par l&apos;écran de retour et par la facture.</p>

      <h2>5. Paiement, périodicité et renouvellement</h2>
      <p>L&apos;abonnement est <b>mensuel</b> : le premier paiement a lieu à la commande, puis chaque mois à la même date. Il <b>se renouvelle automatiquement</b> chaque mois tant que tu ne résilies pas. Le paiement se fait par carte (ou autre moyen proposé par Stripe) ; nous n&apos;avons jamais accès à ta carte. Une facture est disponible dans l&apos;espace de gestion de l&apos;abonnement.</p>

      <h2>6. Pas d&apos;essai gratuit, codes promotionnels</h2>
      <p>Il n&apos;y a pas de période d&apos;essai gratuite : la formule Gratuite sert à découvrir. Un code promotionnel peut parfois être communiqué ; si tu en as un, tu le saisis sur la page de paiement et la réduction s&apos;affiche avant que tu paies. Sauf code valable affiché sur cette page, les prix de l&apos;article 3 s&apos;appliquent.</p>

      <h2>7. Résilier ou changer de formule, en ligne</h2>
      <p>La résiliation est aussi simple que la souscription et se fait en ligne, à tout moment : Paramètres, « Gérer mon abonnement », puis le portail de Stripe (changement de formule, moyen de paiement, factures, résiliation). Les conditions exactes de prise d&apos;effet (fin de la période déjà payée ou immédiate) et de calcul au prorata dépendent des réglages du portail de Stripe, où elles sont affichées avant que tu valides. Supprimer ton compte résilie immédiatement l&apos;abonnement. Sauf droit légal de rétractation ou erreur de notre part, le mois commencé n&apos;est pas remboursé.</p>

      <h2>8. Droit de rétractation (consommateur)</h2>
      <p>Si tu es consommateur, tu as <b>14 jours</b> à partir de la souscription pour te rétracter, sans donner de motif. Pour cela, écris-nous clairement ta décision (« je me rétracte de ma souscription du … ») via la page <Link href="/contact">Contact</Link>{LEGAL.email ? <> ou à <Mail /></> : null}, avec l&apos;e-mail de ton compte. Le remboursement se fait sur le moyen de paiement utilisé, dans les 14 jours après que nous avons reçu ta décision.</p>
      <p><b>Si tu veux utiliser le service tout de suite</b> : le service commence dès le paiement. Pour cela, la loi demande ton accord préalable exprès à ce que l&apos;exécution commence avant la fin des 14 jours, et ta reconnaissance que tu perds ton droit de rétractation <i>quand le service a été pleinement exécuté</i>. Tu donnes cet accord en cochant la case prévue avant le paiement ; sans cet accord, tu gardes ton droit de rétractation dans tous les cas. Si tu te rétractes après avoir demandé l&apos;exécution immédiate, mais avant que le service soit pleinement exécuté, tu ne paies que la part du service déjà utilisée jusqu&apos;à ta décision. Le détail pratique est sur la page <Link href="/remboursement">Remboursement</Link>.</p>

      <h2>9. Garanties légales</h2>
      <p>Si tu es consommateur, tu bénéficies des garanties légales applicables aux contenus et services numériques (conformité). Elles s&apos;appliquent en plus des présentes conditions et ne peuvent pas être écartées.</p>

      <h2>10. Ce que le service fait, et ses limites</h2>
      <p>Le moteur Décollage assemble des aperçus, des projets et du code à partir de modèles écrits à l&apos;avance. Il ne garantit aucun résultat commercial. Les règles d&apos;utilisation sont dans les <Link href="/cgu">conditions générales d&apos;utilisation</Link>. Pour un professionnel, la responsabilité du vendeur est limitée aux sommes payées au cours des 12 derniers mois, sauf faute lourde, faute dolosive ou dommage corporel.</p>

      <h2>11. Données personnelles</h2>
      <p>Voir la <Link href="/confidentialite">politique de confidentialité</Link>. Pour une commande, nous gardons notamment la date, la version des conditions acceptées et les cases cochées, afin de pouvoir le prouver.</p>

      <h2>12. Réclamation et médiation (consommateur)</h2>
      <p>En cas de problème, écris-nous d&apos;abord via la page <Link href="/contact">Contact</Link>. Si on ne trouve pas de solution, tu peux saisir gratuitement le médiateur de la consommation{LEGAL.mediateur.nom ? <> : {LEGAL.mediateur.nom}{LEGAL.mediateur.site ? <> (<a href={LEGAL.mediateur.site}>{LEGAL.mediateur.site}</a>)</> : null}</> : null}.</p>

      <h2>13. Droit applicable</h2>
      <p>Ces conditions sont soumises au droit français. Un consommateur peut saisir le tribunal de son domicile ; pour un professionnel, le tribunal compétent est celui prévu par la loi.</p>
    </LegalPage>
  );
}
