# Abonnements Stripe : fonctionnement prudent

Périmètre : worktree `decollage-etape1`, branche `claude/practical-albattani-bkirw7`, commit `7dcc070`.

Fichiers concernés :
- `src/app/api/stripe/checkout/route.ts` : ouverture du paiement.
- `src/app/api/stripe/webhook/route.ts` : réception des événements Stripe et mise à jour de la formule.
- `src/lib/billing.ts` : règles pures (statuts, UUID, décision de lien).
- `src/app/parametres/page.tsx` : relectures après retour de paiement.

Principe : **on ne crée jamais un second abonnement.** Un nouveau paiement n'est ouvert que si aucun abonnement non terminé n'existe. Dans le doute, on refuse. Stripe reste la source de vérité.

---

## 1. Fonctionnement du checkout

Ordre des contrôles dans `POST /api/stripe/checkout` :

1. Origine vérifiée (`originGuard`), paiement configuré (sinon 503), utilisateur connecté (sinon 401).
2. Formule dans la liste autorisée (sinon 400). Les prix sont choisis côté serveur, jamais envoyés par le navigateur. L'option marque blanche n'existe que pour Solo (sinon 400). Prix non configuré : 503.
3. Confirmations de commande (CGV, accès immédiat, renonciation à la rétractation) vérifiées, puis preuve enregistrée. Si l'enregistrement échoue : 500, paiement non ouvert.
4. Lecture du profil. Erreur de lecture : 503 (`verification_impossible`).
5. Refus (409 `abonnement_existant`) si le profil indique une formule payante, ou un abonnement non terminé.
6. Si un client Stripe est connu : relecture de **tous** les abonnements du client chez Stripe (`status: all`, limite 100). Erreur de lecture, réponse incomplète ou plus de 100 abonnements : 503. Un abonnement non terminé : 409.
7. Si aucun client Stripe n'est connu : création du client (`customers.create`) avec la clé d'idempotence `decollage-customer-<id utilisateur>`, puis enregistrement du lien dans `profiles.stripe_customer_id`. **Si l'enregistrement échoue, le paiement n'est pas ouvert : 503.**
8. Ouverture de la session Stripe (`mode: subscription`). Les métadonnées de l'abonnement contiennent `user_id`, `plan` et `brand_option`. Si Stripe ne renvoie pas d'URL : 502.

Statuts pris en compte (`src/lib/billing.ts`) :

| Statut Stripe | Accès à la formule | Nouveau paiement |
|---|---|---|
| `active`, `trialing`, `past_due` | oui | refusé (409) |
| `unpaid`, `paused`, `incomplete` | non | refusé (409) |
| `canceled`, `incomplete_expired` | non | **autorisé** |
| inconnu, absent ou futur | non | refusé (409) |
| lecture impossible | inchangé | refusé (503) |

Seuls `canceled` et `incomplete_expired` prouvent qu'un abonnement est terminé. Les messages et l'action proposée (portail ou contact) dépendent du statut. Pour `unpaid`, `paused` et `incomplete`, le comportement exact du portail reste **à vérifier en mode test**.

Retour de paiement : Stripe renvoie vers `/parametres?paiement=ok`.

## 2. Mécanisme de récupération du compte (webhook)

`POST /api/stripe/webhook` :

1. Signature vérifiée sur le corps brut (sinon 400). Webhook non configuré : 503.
2. Événements traités : `checkout.session.completed` (mode abonnement) et `customer.subscription.{created,updated,deleted,paused,resumed}`. Les autres sont ignorés (200).
3. L'identifiant d'abonnement est relu chez Stripe (`subscriptions.retrieve`). Le webhook ne fait jamais confiance au seul contenu de l'événement.
4. Recherche du profil par `stripe_customer_id`.
   - **Trouvé** : chemin normal.
   - **Non trouvé** (lien jamais enregistré) : secours. Le webhook relit le client chez Stripe, compare les métadonnées, puis décide (`resolveProfileLink`) :
     - `reparer` : le lien est vide, on l'écrit. La mise à jour ne vise que les lignes où le lien est encore vide.
     - `lier_deja` : le lien est déjà le bon client (cas de course), rien à écrire.
     - `alerter_autre_lien` : le compte est lié à un autre client. Rien n'est modifié, alerte journalisée, 200.
     - `ignorer` : métadonnées absentes ou invalides, client incohérent, compte absent. 200 « ignoré ».
5. Garde-fous : un ancien abonnement qui se termine ne retire pas l'accès du plus récent. Un `user_id` incohérent est ignoré (200). Deux abonnements actifs déclenchent une alerte (rien n'est résilié automatiquement).
6. Analyse de **tous** les prix de l'abonnement. Prix inconnu : jamais de formule payante. Écriture de `plan`, `stripe_subscription_id` et `subscription_status`.
7. Synchronisation de l'option marque blanche, puis des publications selon la formule. Si la synchronisation des publications échoue : 500.
8. Retrait de la ligne « option » si la formule Pro ou Illimité l'inclut déjà (crédit au prorata). Réponse 200 `received: true`.

## 3. Contrôles de métadonnées

Le lien n'est jamais déduit d'une simple correspondance d'e-mail. Il faut que les métadonnées de l'abonnement **et** celles du client désignent exactement le même compte.

- **`user_id` de l'abonnement** : absent ou vide → `metadonnees_absentes`. Présent mais pas un UUID (toute version, regex) → `metadonnees_invalides`. Dans les deux cas : aucun appel au client Stripe, aucune écriture, 200 « ignoré ».
- **Client relu chez Stripe** (seulement si l'UUID est valide). Client supprimé ou sans `user_id` → `client_incoherent`.
- **Égalité exacte** entre `subscription.metadata.user_id` et `customer.metadata.user_id` (comparaison stricte, sensible à la casse). Différence → `client_incoherent`, 200 « ignoré ». Un UUID en majuscules ne correspond pas à sa version en minuscules : le cas est ignoré, ce qui est le côté sûr.
- **Compte** : le profil doit avoir pour `id` exactement ce `user_id`. Sinon → `compte_absent` (compte supprimé ou inconnu).
- **Chemin normal** (profil trouvé par `stripe_customer_id`) : pas de relecture du client. Seul contrôle : si `subscription.metadata.user_id` est présent et différent de `profile.id`, l'événement est ignoré (200) et journalisé.

Cas d'ignorance (200 « ignoré », aucune écriture) : métadonnées absentes, métadonnées invalides, client incohérent, compte absent, `user_id` incohérent, événement non géré, ancien abonnement, lien déjà pris par un autre client (alerte).

## 4. Traitement des erreurs

**Checkout**

- **503** : lecture du profil impossible ; lecture des abonnements impossible ou incomplète ; enregistrement du lien client impossible (aucune session créée) ; prix non configuré ; option marque blanche mal configurée.
- **500** : enregistrement de la preuve de commande impossible. Rien n'est débité.
- **502** : Stripe n'a pas renvoyé d'URL de paiement.
- Erreur Stripe à l'ouverture de la session : message neutre, statut selon `stripeErrorMessage`. Le détail reste dans les journaux serveur.

**Webhook**

- **500 « Traitement impossible »** (Stripe rejouera l'événement) : lecture Supabase en erreur (« lecture impossible ≠ client inconnu »), lecture ou réparation du lien en erreur, écriture du profil en erreur, synchronisation des publications non appliquée, retrait de la ligne option en erreur, et **toute erreur Stripe** (relecture de l'abonnement ou du client) qui tombe dans le bloc `catch`.
- **200 « ignoré »** (cas permanents, Stripe ne rejouera pas) : voir section 3.
- **400** : signature absente ou invalide.
- **503** : webhook non configuré.

**Alerte de réconciliation manuelle**

Quand le compte est déjà lié à un autre client Stripe, le webhook journalise `ALERTE réconciliation manuelle` et répond 200. **Rien n'est modifié, et Stripe ne rejouera pas l'événement.** Il faut vérifier à la main dans Stripe quel client est le bon, puis corriger le lien ou résilier l'abonnement en trop.

Même principe pour `ALERTE double abonnement` : l'action est manuelle.

## 5. Idempotence

- **Client Stripe** : `customers.create` utilise la clé `decollage-customer-<id utilisateur>`. Deux demandes simultanées sans client connu obtiennent le même client. Après un 503 sur le lien, une nouvelle tentative réutilise ce même client : pas de doublon.
- **Session de paiement** : la clé combine utilisateur, formule, option, prix, empreinte du retour et fenêtre de 10 minutes. Deux clics ou deux onglets sur la même formule dans la même fenêtre donnent la même session. Deux formules ou deux fenêtres donnent deux sessions distinctes (limite documentée section 7).
- **Retrait de l'option** : clé `decollage-drop-brand-<id de l'élément>`.
- **Rejeu d'un événement webhook** : même résultat, pas de double écriture. Test `(10)` : une seule écriture du lien.
- **Lien jamais écrasé par le webhook** : la réparation n'écrit que si le lien est encore vide (`.is(null)`). Un lien vers un autre client déclenche une alerte, pas une écriture.
- **Point à relire** : l'enregistrement du lien dans le checkout (`upsert` sur `profiles`) n'a **pas** cette condition « encore vide ». Il est exécuté seulement si le checkout ne voit pas de client connu (voir section 7).

## 6. Tester en mode test avec Stripe CLI

Règles :
- **Clés de test uniquement** (`sk_test_...`, `pk_test_...`). Jamais de clé de production, ni dans le code, ni dans un fichier versionné, ni dans la documentation.
- **Jamais de vraie carte.** Utiliser les cartes de test publiques de Stripe, par exemple `4242 4242 4242 4242` (date future, code quelconque).
- Le secret de signature du webhook local (`whsec_...`) est fourni par la CLI. Il se met dans une variable d'environnement locale, jamais dans le dépôt.

Procédure :

1. Lancer l'application en local, configurée en mode test.
2. Dans un autre terminal : `stripe listen --forward-to http://localhost:3000/api/stripe/webhook` (adapter le port si besoin). Garder ce terminal ouvert.
3. Parcours réel : ouvrir le checkout depuis Paramètres, payer avec la carte de test. Vérifier dans la base de **test** : `stripe_customer_id`, `plan`, `stripe_subscription_id`, `subscription_status`.
4. Récupération : dans la base de **test**, remettre `stripe_customer_id` à vide sur le compte de test, puis rejouer l'événement depuis le tableau de bord Stripe en mode test. Attendu : lien réparé, formule accordée, 200.
5. `stripe trigger <événement>` (par exemple `customer.subscription.updated`) : la CLI crée des objets de test **sans** métadonnée `user_id`. Attendu à vérifier : 200 « ignoré ». Cela prouve la signature et le routage, pas la récupération du compte. Utiliser le parcours réel (étape 3) pour la récupération.
6. Double clic rapide sur la même formule : une seule session (même URL), un seul client Stripe.
7. Pour les statuts `unpaid`, `paused`, `incomplete` : provoquer le statut avec les cartes de test de Stripe (échec au renouvellement, authentification 3D Secure abandonnée) ou depuis le tableau de bord de test (mise en pause). Noter ce que le portail permet réellement. Ce point n'a pas été vérifié dans le code.

Tests automatisés (`npm test`) : ils **n'appellent ni Stripe ni Supabase**.
- `src/app/api/stripe-liaison-client.test.ts` : Stripe et Supabase sont simulés (aucun réseau, aucune clé).
- `src/app/api/stripe-e2e-pglite.test.ts` : base PostgreSQL en mémoire (PGlite), Stripe simulé. Aucune base distante.

## 7. Risques résiduels

- **Course entre lecture et réparation** : le webhook lit le profil, puis répare le lien seulement s'il est encore vide. Si un lien est posé entre les deux, la réparation ne fait rien et le webhook continue. Il n'écrase rien.
- **Course dans le checkout** : l'enregistrement du lien n'a pas de condition « encore vide ». Si le webhook pose un lien entre la lecture du profil et cet enregistrement, le checkout peut le remplacer. **À relire et à corriger si nécessaire.**
- **Anciens clients sans métadonnées** : leurs événements sont ignorés (200). Aucun accès n'est accordé automatiquement. Une réconciliation manuelle est nécessaire.
- **Client Stripe créé sans lien après un 503** : le client existe chez Stripe, avec `user_id` dans ses métadonnées. La nouvelle tentative le réutilise. Si l'utilisateur ne réessaie jamais, le client reste sans lien. Sans abonnement, il n'y a rien à récupérer.
- **Webhook très tardif (au-delà de 60 s)** : la page relit la formule environ 60 s au total (2, 3, 4, 6, 8, 10, 12, 15 s), puis s'arrête. Elle affiche alors « Paiement reçu, activation en attente. Si rien dans 5 min, contacte-nous. » Le délai de 5 minutes est un texte, non appliqué par le code. Le délai de rejeu de Stripe n'est pas mesuré ici.
- **Double abonnement** : deux sessions différentes payées avant tout paiement peuvent donner deux abonnements actifs. Le webhook alerte et ne résilie rien. Résiliation ou remboursement manuels.
- **Clé d'idempotence** : Stripe conserve les clés pendant une durée annoncée (24 h, à confirmer). Une même clé avec des paramètres différents peut provoquer une erreur : l'utilisateur voit « réessaie », sans débit.

## 8. Journaux

Écritures relevées dans `checkout/route.ts` et `webhook/route.ts` (par `grep` sur `console.log`, `console.error`, `console.warn`) :

- Identifiants Stripe : `evt_`, `sub_`, `cus_`, `si_`, identifiants de prix. Autorisés.
- UUID de compte (`userId`, `decision.userId`). Autorisé.
- Noms de formule, statuts Stripe, raisons de décision (`metadonnees_absentes`, etc.). Autorisés.
- Types et codes d'erreur Stripe (`e.type`, `e.code`). Autorisés.
- **Aucun e-mail, aucun secret** écrit directement. Un test vérifie que le journal de réconciliation ne contient pas « @ ».

**Points à relire :**
- `checkout/route.ts` ligne 68 : `e.message` d'une erreur Stripe est journalisé. Un message Stripe peut reprendre une valeur saisie (par exemple un e-mail). **Non vérifié** : à relire.
- `webhook/route.ts` ligne 120 : `e.message` (erreur Stripe ou Supabase) est journalisé. Risque faible, à relire de la même façon.
- Autres routes Stripe (`portal`, `option`) : `e.type` et `e.code` seulement.
