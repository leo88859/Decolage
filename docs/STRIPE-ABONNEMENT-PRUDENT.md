# Abonnements Stripe : approche prudente

Principe : **on ne crée jamais un nouvel abonnement si un abonnement existant, incomplet ou de statut inconnu peut encore être actif.** Seuls `canceled` et `incomplete_expired` (prouvés terminés, chez nous ou chez Stripe) libèrent le paiement. Tout refus explique la situation, rappelle « tu ne seras pas facturé deux fois : nous ne créons pas de second abonnement » et propose une action sûre.

Code : `src/lib/billing.ts` (règles, messages), `src/app/api/stripe/{checkout,portal,webhook}/route.ts`, `src/app/parametres/page.tsx` (interface). Tests (Stripe simulé) : `src/app/api/stripe-abonnement-prudent.test.ts`, `src/app/api/securite-audit.test.ts`.

## Table de décision

« Accès » = ce que le webhook enregistre dans `profiles.plan` (inchangé). « Checkout » = ouverture d'un nouveau paiement.

| Statut Stripe | Accès à la formule | Checkout | Message (résumé) | Action proposée |
|---|---|---|---|---|
| `active` | oui (formule du prix) | refusé, 409 `abonnement_existant` | abonnement existant et actif | Ouvrir le portail de gestion (+ Contact) |
| `trialing` | oui | refusé, 409 | idem (actif) | Portail (+ Contact) |
| `past_due` | oui (délai pour régulariser) | refusé, 409 | dernier paiement échoué, vérifier le moyen de paiement | Portail (+ Contact) |
| `unpaid` | non (Gratuit, sites suspendus) | refusé, 409 | abonnement impayé ; si le portail ne règle rien, contacter | Portail (+ Contact). Ce que le portail permet : **à vérifier en mode test** |
| `paused` | non (Gratuit) | refusé, 409 | abonnement en pause ; si la reprise n'est pas proposée, contacter | Portail (+ Contact). Reprise via le portail : **à vérifier en mode test** |
| `incomplete` | non | refusé, 409 | premier paiement non finalisé ; ne pas en prendre un autre ; contacter si cela ne se débloque pas | **Contact seulement** (aucune promesse de portail ; ce que le portail permet pour `incomplete` : **à vérifier en mode test**) |
| `incomplete_expired` | non | **autorisé** | (aucun) | Paiement normal |
| `canceled` | non | **autorisé** | (aucun) | Paiement normal |
| inconnu / absent / futur | non (jamais de formule devinée) | refusé, 409 | état non reconnu, blocage par précaution | **Contact** |
| lecture impossible (Stripe ou base en panne, plus de 100 abonnements) | inchangé | refusé, 503 `verification_impossible` | impossible de vérifier, rien débité | **Réessayer dans un instant** (+ portail si abonnement déjà pris) |

Sans client Stripe enregistré (`stripe_customer_id` vide), le portail n'est jamais proposé : l'action devient « Contact ».
Plusieurs abonnements chez Stripe : le statut le plus significatif est affiché (ordre `active`, `trialing`, `past_due`, `unpaid`, `paused`, `incomplete`, puis inconnu).
Réponse de l'API : `{ error, code, action: "portail" | "contact" | "reessayer", statut }`. Contact : page `/contact` (aucune adresse écrite en dur dans le code de facturation).

## Écarts constatés dans le code (avant ce travail)

- Le refus était un message unique, quel que soit le statut, avec le seul bouton « portail » : inadapté à `incomplete` et à un statut inconnu (promesse implicite que le portail règle tout). **Corrigé.**
- `verification_impossible` n'avait pas d'écran dédié (message dans la fenêtre de commande). **Corrigé** : encadré avec « Réessayer » (désactivé 8 s) et accès au portail.
- Aucun écart de statut entre `billing.ts` et le webhook : `isActiveStatus` (`active`, `trialing`, `past_due`) donne l'accès, tous les autres statuts donnent Gratuit ; `subscriptionBlocksCheckout` ne libère que `canceled` et `incomplete_expired`. Le webhook enregistre `stripe_subscription_id` et `subscription_status` pour chaque statut, y compris inconnu.
- Le portail n'attrapait pas les erreurs Stripe (erreur 500 brute). **Corrigé** : message propre + renvoi vers Contact.
- Cas d'un abonnement actif au prix inconnu : le webhook l'enregistre (Gratuit, sans deviner la formule) ; le checkout est alors bloqué, le portail reste utilisable ; l'utilisateur voit « abonnement actif » alors que sa formule affichée est Gratuit : **à traiter par le patron** (vérifier le prix dans Stripe / variables `STRIPE_PRICE_*`).
- Événements gérés : `checkout.session.completed` (abonnement), `customer.subscription.{created,updated,deleted,paused,resumed}`. Les statuts `incomplete` → `incomplete_expired` arrivent par `customer.subscription.updated`/`deleted` (à confirmer en mode test que l'événement est bien émis à l'expiration).

## Protection contre le double abonnement : ce qui l'est, et ce qui ne l'est pas

Protégé par le code :
- Avant chaque paiement : refus si le profil indique une formule payante ou un abonnement non terminé, puis relecture des abonnements du client chez Stripe (source de vérité, `status: all`). Une erreur de lecture ou une réponse incomplète refuse (ne prouve jamais l'absence).
- Deux requêtes simultanées **sans** client Stripe connu : `customers.create` utilise la clé d'idempotence Stripe `decollage-customer-<id utilisateur>` : un seul client, plus de client orphelin dont l'abonnement serait invisible du webhook.
- Deux clics ou deux onglets sur la **même formule** dans la même fenêtre de 10 minutes : `checkout.sessions.create` utilise une clé d'idempotence (utilisateur, formule, prix, retour, fenêtre) : Stripe renvoie **la même session**, payable une seule fois.
- Webhook : un ancien abonnement qui se termine ne retire pas l'accès du plus récent ; rejeu idempotent ; prix inconnu = jamais de formule payante.

**Non protégé (à connaître) :**
- Deux sessions de paiement **différentes** (deux formules, ou deux fenêtres de 10 minutes) ouvertes avant tout paiement, puis payées toutes les deux : la vérification n'a lieu qu'à l'ouverture, et Stripe ne l'empêche pas. Résultat possible : deux abonnements actifs. Le webhook écrit alors le plus récent dans le profil, ne résilie rien, et journalise `[stripe] ALERTE double abonnement : ...` ; résiliation/remboursement **manuels** dans Stripe. Piste (non faite, car elle suppose une action réelle sur Stripe) : à `checkout.session.completed`, résilier automatiquement l'abonnement en trop ; à décider par le patron. Autre piste : `expires_at` court sur les sessions (Stripe accepte au moins 30 minutes, à vérifier en mode test).
- La clé d'idempotence d'une session dure 24 h côté Stripe, mais la fenêtre de 10 minutes la renouvelle ; une même requête avec des paramètres différents (ex. e-mail changé pour la création du client dans les 24 h) peut provoquer une erreur d'idempotence Stripe : l'utilisateur voit « Paiement indisponible, réessaie » sans être débité.

## Parcours utilisateur (page Paramètres → Formule)

1. Refus `abonnement_existant` : encadré rouge avec le message du statut ; boutons selon l'action (« Ouvrir le portail de gestion » seulement si `portail`), toujours « Contacter le support » (page `/contact`) et « Fermer ».
2. Refus `verification_impossible` : encadré avec « Réessayer dans un instant… » (puis « Réessayer », qui rouvre la fenêtre de commande de la même formule) et « J'ai déjà un abonnement : ouvrir le portail ».
3. `incomplete` et état inconnu : explication + Contact, sans portail en action principale.

## Tests Stripe en mode test, pas à pas (à faire par le patron)

Prérequis : clés de **test** (`sk_test_...`), prix de test dans `STRIPE_PRICE_*`, webhook de test (Stripe CLI `stripe listen` ou endpoint de test), portail de test configuré (Paramètres → Facturation → Portail client).
1. Abonnement normal : carte `4242 4242 4242 4242` → formule active, puis re-cliquer « Choisir » depuis un 2e onglet : doit afficher « actif » + portail, sans nouvelle session.
2. `past_due` / `unpaid` : carte `4000 0000 0000 0341` (échec au renouvellement) ou horloge de test (Test clocks) ; noter ce que le portail propose réellement et l'écrire ici.
3. `incomplete` : carte `4000 0027 6000 3184` (authentification 3D Secure requise) en abandonnant l'authentification ; vérifier le statut reçu, le message « paiement non finalisé », ce que le portail permet, et le délai avant `incomplete_expired`.
4. `paused` : mettre en pause depuis le tableau de bord de test ; vérifier message, portail, et que « reprendre » est possible ou non.
5. Statut inconnu : modifier à la main `profiles.subscription_status` d'un compte de test (base de test uniquement) en `zzz` → message « état non reconnu ».
6. Deux clics rapides sur « Choisir Pro » : une seule session (même URL), un seul client Stripe créé.
7. Deux formules ouvertes dans deux onglets, les deux payées : constater les deux abonnements actifs et l'alerte dans les journaux (limite documentée ci-dessus).
8. Réponse Stripe indisponible (clé de test volontairement erronée en local) : message « vérification impossible » et bouton « Réessayer ».
