import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/Legal";
import { LEGAL } from "@/data/legal";

export const metadata: Metadata = { title: "Accessibilité" };

export default function Accessibilite() {
  return (
    <LegalPage title="Accessibilité" doc="accessibilite">
      <p>On veut que {LEGAL.marque} soit utilisable par le plus grand nombre. Voici, honnêtement, où on en est.</p>

      <h2>Ce qui a été fait</h2>
      <ul>
        <li>Les contrastes de couleurs de l&apos;interface sont testés automatiquement (texte, bordures de champs, anneau de focus) : un test échoue si une paire de couleurs repasse sous le seuil visé (4,5:1 pour le texte courant, 3:1 pour les éléments d&apos;interface).</li>
        <li>Un anneau de focus bien visible au clavier et un lien « Aller au contenu » en haut de page.</li>
        <li>Les animations peuvent être réduites (réglage de l&apos;appareil respecté, et réglage dans Paramètres).</li>
        <li>Les champs de formulaire ont des libellés associés, et la fenêtre « Cookies » est utilisable au clavier (Échap pour fermer).</li>
      </ul>

      <h2>Ce qui n&apos;a pas été fait</h2>
      <ul>
        <li><b>Aucun audit RGAA complet</b> (les 106 critères) n&apos;a été réalisé, et aucune déclaration de conformité n&apos;est publiée. On ne prétend pas respecter le référentiel.</li>
        <li>Pas encore de test systématique avec un lecteur d&apos;écran (NVDA, VoiceOver), ni au zoom à 200 % et 400 %.</li>
        <li>Les sites que tu génères avec {LEGAL.marque} ont leurs propres couleurs et leur propre code : ils n&apos;ont pas été audités. Leur accessibilité dépend aussi de tes choix de couleurs et de contenus.</li>
      </ul>

      <h2>Un problème ?</h2>
      <p>Si une page est difficile ou impossible à utiliser, dis-le-nous via la page <Link href="/contact">Contact</Link> en indiquant la page, ton navigateur et la difficulté. On corrigera ce qui peut l&apos;être.</p>
    </LegalPage>
  );
}
