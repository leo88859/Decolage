import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, P, V } from "@/components/Legal";
import { LEGAL, PROPOSITIONS } from "@/data/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" doc="mentions">
      <h2>Éditeur du site</h2>
      <p>
        Le service {LEGAL.marque} (site : <P v={LEGAL.site} proposition={PROPOSITIONS.site} />) est édité par :
      </p>
      <ul>
        <li>Nom (ou raison sociale) : <V v={LEGAL.editeur} label="Prénom et nom de l'éditeur" /></li>
        <li>Statut : <V v={LEGAL.statut} label="Statut juridique" /></li>
        <li>SIRET : <V v={LEGAL.siret} label="Numéro SIRET" /></li>
        <li>Adresse : <V v={LEGAL.adresse} label="Adresse postale" /></li>
        <li>E-mail : <Mail /></li>
        <li>Téléphone : <V v={LEGAL.telephone} label="Numéro de téléphone" /></li>
        <li>TVA : <P v={LEGAL.tva} proposition={PROPOSITIONS.tva} /></li>
      </ul>
      <p>Nom commercial : « {LEGAL.marque} ».</p>

      <h2>Directeur de la publication</h2>
      <p><V v={LEGAL.directeurPublication} label="Directeur de la publication" />.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par {LEGAL.hebergeur.nom}, <P v={LEGAL.hebergeur.adresse} proposition={PROPOSITIONS.hebergeurAdresse} /> ·{" "}
        <a href={LEGAL.hebergeur.site}>{LEGAL.hebergeur.site}</a>.
      </p>
      <p>
        Pour fonctionner, le service fait aussi appel à Supabase (comptes et base de données) et à Stripe (paiements). Tu trouves le détail, y compris
        la localisation des données, dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, les modèles, le code du service et les éléments graphiques de {LEGAL.marque} appartiennent à l&apos;éditeur, sauf mention contraire.
        Ce que tu crées avec le service (tes projets, tes textes, ton logo, le code que tu exportes) reste à toi, comme le prévoient les{" "}
        <Link href="/cgu">conditions d&apos;utilisation</Link>.
      </p>

      <h2>Contact</h2>
      <p>Pour toute question ou signalement : voir la page <Link href="/contact">Contact</Link>.</p>

      <h2>Signaler un contenu</h2>
      <p>Les sites publiés par les utilisateurs sont sous la responsabilité de leurs auteurs. Si tu penses qu&apos;un site publié sur le service est illicite, écris-nous via la page <Link href="/contact">Contact</Link> en indiquant l&apos;adresse du site et ce qui te pose problème.</p>
    </LegalPage>
  );
}
