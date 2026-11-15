# Conservation des données de la liste d'attente

## Finalité

Prévenir les inscrits du lancement d'un site, et pour rien d'autre. Chaque inscription est faite après une case de consentement
cochée par la personne ; la date et la version du texte sont enregistrées.

## Statuts

- **recueilli** : la personne a coché la case. Date et version du texte enregistrées.
- **a_verifier** : inscrit avant la case de consentement. Aucun consentement n'a été enregistré. Ce statut n'est jamais changé automatiquement.

## Règles

1. **Aucune campagne commerciale** à un inscrit `a_verifier` tant que son accord n'est pas établi (aucune preuve de consentement).
2. **Pas de service d'e-mails** : Décollage n'envoie aucun message aux inscrits. Le propriétaire contacte lui-même ses inscrits.
3. **Suppression individuelle** : le propriétaire supprime un inscrit depuis sa liste, à la demande de la personne ou quand il ne peut pas prouver son accord.
4. **Rappel visible** : la liste affiche le nombre d'inscrits « à vérifier » et rappelle la règle.
5. **Pas de purge automatique** pour l'instant (décision validée) : la suppression reste manuelle.

## Durée de conservation

- **Principe** : aucune conservation indéfinie. Une inscription n'a de sens que pendant la préparation du lancement.
- **Durée proposée (à valider)** : **12 mois** après l'inscription, ou dès que le lancement du site est effectif, selon le premier terme.
  Au-delà, le propriétaire doit supprimer les inscrits concernés.
- **Application** : manuelle (le propriétaire, depuis sa liste). Décollage ne supprime rien automatiquement. Une purge automatique
  pourra être décidée plus tard, avec information des personnes concernées.
- **Exports** : l'export CSV contient le statut de consentement ; il ne doit servir qu'à la finalité ci-dessus.

## À décider par le responsable

- Valider la durée proposée (12 mois) ou en choisir une autre.
- Décider si la durée doit être indiquée sur la page de confidentialité publique.
