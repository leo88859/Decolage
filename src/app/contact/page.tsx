import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/Legal";
import { LEGAL, supportContact } from "@/data/legal";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  const adresse = supportContact();
  return (
    <LegalPage title="Contact" doc="contact">
      {adresse ? <p>Pour toute question, tu peux écrire à <a href={`mailto:${adresse}`}>{adresse}</a>.</p> : null}
      {LEGAL.telephone ? <p>Téléphone : {LEGAL.telephone}</p> : null}

      <h2>Pour que ta demande avance vite</h2>
      <p>Indique l&apos;adresse e-mail de ton compte et ce que tu veux. Selon ta demande :</p>
      <ul>
        <li><b>Question sur ton abonnement ou un paiement</b> : la date du paiement et la formule concernée. Pour résilier, pas besoin de nous écrire : Paramètres, « Gérer mon abonnement ».</li>
        <li><b>Rétractation</b> : voir <Link href="/remboursement">Remboursement</Link>.</li>
        <li><b>Données personnelles (accès, suppression, opposition, désinscription d&apos;une liste d&apos;attente)</b> : précise le droit que tu exerces ; pour une désinscription, indique le site et ton adresse. Voir la <Link href="/confidentialite">politique de confidentialité</Link>.</li>
        <li><b>Signaler un site publié</b> : l&apos;adresse du site et ce qui pose problème.</li>
        <li><b>Problème d&apos;accessibilité</b> : la page concernée et la difficulté rencontrée. Voir <Link href="/accessibilite">Accessibilité</Link>.</li>
      </ul>
      <p className="mut small">Aucun délai de réponse n&apos;est promis ici. Ne nous envoie jamais ton numéro de carte bancaire par e-mail.</p>
    </LegalPage>
  );
}
