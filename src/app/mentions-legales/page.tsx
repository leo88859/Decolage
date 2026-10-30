import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail } from "@/components/Legal";
import { LEGAL } from "@/data/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" doc="mentions">
      <h2>Éditeur du site</h2>
      <p>
        Le service {LEGAL.marque} {LEGAL.site ? <>(site : {LEGAL.site}) </> : null}est édité par :
      </p>
      <ul>
        {LEGAL.editeur ? <li>Nom (ou raison sociale) : {LEGAL.editeur}</li> : null}
        {LEGAL.statut ? <li>Statut : {LEGAL.statut}</li> : null}
        {LEGAL.siret ? <li>SIRET : {LEGAL.siret}</li> : null}
        {LEGAL.adresse ? <li>Adresse : {LEGAL.adresse}</li> : null}
        {LEGAL.email ? <li>E-mail : <Mail /></li> : null}
        {LEGAL.telephone ? <li>Téléphone : {LEGAL.telephone}</li> : null}
        {LEGAL.tva ? <li>TVA : {LEGAL.tva}</li> : null}
      </ul>
      <p>Nom commercial : « {LEGAL.marque} ».</p>

      {LEGAL.directeurPublication ? (
        <>
          <h2>Directeur de la publication</h2>
          <p>{LEGAL.directeurPublication}.</p>
        </>
      ) : null}

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par {LEGAL.hebergeur.nom}{LEGAL.hebergeur.adresse ? <>, {LEGAL.hebergeur.adresse}</> : null} ·{" "}
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
