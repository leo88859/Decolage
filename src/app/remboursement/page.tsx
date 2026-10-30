import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, V } from "@/components/Legal";
import { LEGAL, supportContact } from "@/data/legal";

export const metadata: Metadata = { title: "Remboursement et rétractation" };

export default function Remboursement() {
  return (
    <LegalPage title="Remboursement et rétractation" doc="remboursement">
      <p>Cette page résume, en pratique, quand et comment tu peux être remboursé·e. Elle complète les <Link href="/cgv">conditions générales de vente</Link> et ne retire aucun des droits que la loi te donne.</p>

      <h2>Te rétracter dans les 14 jours (consommateur)</h2>
      <ul>
        <li>Tu as 14 jours à partir de ta souscription pour changer d&apos;avis, sans donner de raison.</li>
        <li>Écris-nous ta décision via la page <Link href="/contact">Contact</Link> ou à <Mail v={supportContact()} label="Contact du support" />, en indiquant l&apos;e-mail de ton compte et la date de ta souscription.</li>
        <li>La loi impose de te rembourser dans les 14 jours après avoir été informé de ta décision, sur le moyen de paiement utilisé.</li>
        <li>Si tu as demandé à utiliser le service tout de suite (case cochée avant le paiement) puis que tu te rétractes, tu ne paies que la part du service déjà utilisée ; le reste t&apos;est remboursé. Une fois le service pleinement exécuté, après ton accord exprès, le droit de rétractation prend fin.</li>
      </ul>

      <h2>Résilier : arrêter les paiements suivants</h2>
      <p>Tu peux résilier en ligne à tout moment (Paramètres, « Gérer mon abonnement »). La résiliation arrête les mois suivants. Sauf droit de rétractation ou erreur de notre part, un mois déjà commencé n&apos;est pas remboursé.</p>

      <h2>Un problème de facturation ou de service</h2>
      <p>Si tu as été débité·e deux fois, débité·e après une résiliation, ou si le service ne fonctionne pas comme décrit, écris-nous via la page <Link href="/contact">Contact</Link> avec ton e-mail et la date du paiement : nous examinons chaque demande. Tes droits légaux (garanties de conformité, remboursement d&apos;un prélèvement indu) restent applicables.</p>

      <h2>Si tu achètes pour ton activité professionnelle</h2>
      <p>Le droit de rétractation des consommateurs ne s&apos;applique pas. Écris-nous quand même en cas de problème : on regarde chaque cas.</p>

      <h2>Comment tu es remboursé·e</h2>
      <p>Le remboursement est fait via Stripe sur le moyen de paiement d&apos;origine. Le délai pour que la somme apparaisse sur ton relevé dépend de ta banque.</p>

      <h2>Contact et médiation</h2>
      <p>Support : <V v={supportContact()} label="Contact du support" />. Si un désaccord persiste, tu peux saisir le médiateur de la consommation : <V v={LEGAL.mediateur.nom} label="Médiateur de la consommation" />{LEGAL.mediateur.site ? <> (<a href={LEGAL.mediateur.site}>{LEGAL.mediateur.site}</a>)</> : null}.</p>
    </LegalPage>
  );
}
