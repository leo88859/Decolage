# Confidentialité : export des données et consentement de la liste d'attente (étape 5)

Ce document décrit ce que le code fait réellement. Rien ici n'a été testé en production : les tests utilisent des bases simulées
et PGlite (PostgreSQL en mémoire). La migration `supabase/0011_waitlist_consentement.sql` est **préparée, NON exécutée** sur la vraie base.

## 1. Export des données du compte

Route : `GET /api/account/export` (bouton « Télécharger mes données » dans Paramètres). Code : `src/lib/account-export.ts`.

- Connexion obligatoire (401 sinon), jamais les données d'un autre compte, en-tête `Cache-Control: no-store`,
  fichier `decollage-mes-donnees-AAAA-MM-JJ.json` (`-page-N` pour les pages suivantes).
- Le client utilisé est celui de la **session** de la personne : la RLS de la base ne lui montre que ses lignes. En plus, chaque requête est
  filtrée sur son identifiant (ou sur ses boutiques / ses sites) et chaque ligne reçue est revérifiée côté serveur (colonne de propriétaire lue
  puis retirée de l'export).
- Les colonnes sont nommées une par une, jamais `select *` : plusieurs tables n'accordent le droit de lecture que colonne par colonne
  (par exemple `commandes`, qui refuse `jeton_hash` et `cle_idempotence`). Un test PGlite le prouve.

### Bloc `donnees_du_proprietaire` (ses propres données)

| Section | Contenu |
|---|---|
| `compte` | identifiant, e-mail, date de création, dernière connexion |
| `profil` | formule, favoris, statut d'abonnement, dates |
| `projets` | identifiant, contenu, date de mise à jour |
| `sites_publies` | adresse, projet, contenu, dates, date de suspension |
| `boutiques`, `categories`, `produits`, `variantes` | catalogue complet |
| `marque_blanche` | `configuration` (nom, couleurs, logo, favicon, version) et `droit` (activé ou non, date) |
| `acceptations_des_conditions` | document, version, date, contexte |

### Bloc `donnees_commerciales_acheteurs_et_inscrits` (données sur d'AUTRES personnes)

| Section | Contenu |
|---|---|
| `commandes` | référence, nom, e-mail, téléphone et adresse de l'acheteur, note, mode, statut, total, dates |
| `lignes_commande` | produit, variante, prix, quantité |
| `inscrits_liste_attente` | adresse e-mail, date d'inscription, statut de consentement (`recueilli` / `a_verifier`), date et version du texte |

Ces deux blocs sont séparés parce que les secondes données concernent des tiers que la personne détient pour son activité : elle en
est responsable (voir la politique de confidentialité) et ne doit pas les republier.

### Ce qui n'est PAS exporté, et pourquoi

- Identifiants Stripe (client, abonnement) : conservés par Stripe, qui garde aussi les factures ; ce sont des identifiants techniques.
- Jetons de suivi des commandes, empreintes de jeton, clés d'idempotence : secrets ou données purement techniques.
- Identifiants de propriétaire (`user_id`, `proprietaire_id`), identifiant de variante dans les lignes, version précédente de la marque
  blanche (`previous`), note interne et origine du droit marque blanche : informations techniques ou internes sans utilité pour la personne.
- Connexion (le compte n'a pas de mot de passe ; le lien de connexion est géré par le fournisseur) et adresses IP (jamais écrites en base,
  seulement en mémoire quelques secondes pour limiter le spam).
- Journaux techniques de l'hébergeur et sauvegardes du fournisseur : hors du périmètre de la base applicative.

### Gros volumes

Chaque requête lit au plus 1 000 lignes (100 pour les projets, qui sont lourds). Chaque section est plafonnée **par page** :
5 000 lignes (500 pour projets, sites et boutiques) ; les lignes de commande d'une page sont plafonnées à 25 000.
Si une section dépasse, le fichier le dit (`pagination.sections.<section>.page_suivante` et une remarque) et `?page=2`, `?page=3`… télécharge
la suite (1 à 50). Un numéro invalide donne une erreur 400.

### Tables absentes

Si une table ou une colonne n'existe pas (migration non exécutée) ou si une lecture échoue, la section vaut `null`, elle est listée dans
`sections_indisponibles` et une remarque l'explique ; le reste de l'export est fourni. Les colonnes récentes (thème, expiration, statut de
consentement) sont d'abord demandées, puis, en cas d'erreur, seules les colonnes d'origine.

## 2. Liste d'attente : consentement obligatoire

- La page publique du site (`src/lib/landing.ts`) affiche une case **obligatoire et non pré-cochée** : « J'accepte que mon adresse e-mail soit
  transmise à l'éditeur de « <nom du site> », propriétaire de ce site. Il la reçoit pour pouvoir me prévenir du lancement de ce produit, et pour rien
  d'autre. Ce site est hébergé par Décollage, qui ne m'écrit pas. » (texte et version : `src/lib/waitlist-consent.ts`).
- Le **serveur** refuse toute inscription sans case cochée : réponse **400** (page « Consentement nécessaire »), sans appel à la base.
  La fonction SQL `waitlist_inscrire_consent` refuse aussi (`consentement_requis`) : deux verrous indépendants du navigateur.
- La base enregistre `consentement_statut = 'recueilli'`, `consentement_le` (horodatage) et `consentement_texte` (version du texte affiché).
  Des contraintes imposent la cohérence (statut recueilli = date et version présentes ; statut à vérifier = ni date ni version).
- L'éditeur voit le statut de chaque inscrit dans l'onglet « En ligne » et dans l'export CSV (colonnes ajoutées quand la migration est appliquée).
- Limite : le nom donné à l'inscrit pour désigner « l'éditeur » est le nom du site ; Décollage ne connaît pas l'identité légale de l'éditeur
  (nom, société). Le texte renvoie à la politique de confidentialité pour exercer les droits.

### Déploiement : ordre à respecter

Tant que la migration 0011 n'est pas exécutée, la fonction `waitlist_inscrire_consent` n'existe pas et **aucune inscription n'est enregistrée**
(la page affiche l'erreur habituelle) : c'est volontaire, car sans la base on ne pourrait pas prouver le consentement. L'ancien chemin de
repli (insertion directe sans consentement) a été supprimé. **Exécuter 0011 avant de déployer ce code.** La migration supprime l'ancienne
fonction `waitlist_inscrire(text, text)`. Elle ne touche à aucune politique RLS ni à aucun droit de table, et peut être rejouée.

## 3. Pas de double confirmation par e-mail

Aucun fournisseur d'e-mails n'est connecté : Décollage n'envoie aucun message. Il n'y a donc **pas** de confirmation du type « clique sur
le lien reçu » (double opt-in). Conséquences :

- n'importe qui peut saisir l'adresse d'un tiers et cocher la case : la case prouve qu'une personne a coché, pas que l'adresse lui appartient ;
- le propriétaire du site qui écrit à ses inscrits (hors de Décollage) doit donc le faire avec prudence, mentionner la source de l'adresse et
  offrir une désinscription ;
- le texte ne promet ni confirmation ni désinscription automatique. Si un fournisseur d'e-mails est connecté plus tard, ajouter un statut
  `confirme` et un jeton de confirmation sera la suite logique.

## 4. Anciens inscrits

Décision validée : **aucun ancien inscrit n'est jamais marqué comme ayant consenti automatiquement.**

- La migration ajoute `consentement_statut` avec la valeur par défaut `a_verifier` : tous les inscrits existants prennent ce statut,
  sans date ni version de texte. Aucune ligne n'est supprimée ni modifiée dans ses autres colonnes ; aucune campagne n'est déclenchée.
- L'interface affiche « À vérifier » et rappelle de ne pas les considérer comme consentants.
- Une personne déjà inscrite qui se réinscrit en cochant la case passe à `recueilli` (consentement réellement donné) ; un consentement
  déjà recueilli n'est jamais modifié par une nouvelle inscription.
- Que faire d'eux (demander un nouveau consentement, supprimer) reste une décision du propriétaire du site ; l'inscrit peut être supprimé
  depuis l'onglet « En ligne ».

## 5. Tests

- `src/lib/account-export.test.ts` : sections, séparation des deux blocs, absence de clés sensibles, colonnes nommées, isolation,
  table absente, repli sur colonnes d'origine, plafond et pagination (base simulée en mémoire).
- `src/lib/waitlist-consentement-0011.test.ts` : migrations 0001 à 0010 puis 0011 dans PGlite : anciens inscrits, contraintes, fonction,
  RLS, export avec les vrais droits de colonnes, isolation entre deux comptes, 0011 sans effet sur les RLS (lecture du fichier).
- `src/app/api/waitlist/[slug]/waitlist-route.test.ts`, `src/lib/waitlist-consent.test.ts`, `src/app/api/routes.test.ts` : refus 400,
  inscription valide, case dans la page publique, route d'export (401, page invalide, `no-store`, nom de fichier).
- Non couvert : le comportement sur la vraie base Supabase (PostgREST, vrais rôles, vraies sauvegardes), à vérifier après exécution de 0011.
