# Boutique V1 : contrat de l'API (pour l'interface)

Socle serveur : `supabase/0005_boutique.sql` (à exécuter À LA MAIN après 0004), `src/lib/boutique/**`, `src/app/api/boutique/**`.
Tests : `src/lib/boutique/boutique-rls.test.ts` (vrai SQL, PGlite), `validate.test.ts`, `src/app/api/boutique/boutique-routes.test.ts`.
Le modèle navigateur existant (`Boutique` simulée) n'est pas touché.

## Règles générales

- Toutes les réponses : JSON, `cache-control: no-store` (sauf le catalogue public : 15 s). Erreurs : `{ "error": "message en français", "code": "...", "errors"?: { champ: message } }`.
- Écritures (POST/PATCH/DELETE) : en-tête `Origin` obligatoire et identique au site (sinon 403 `origin`). `fetch` du navigateur l'envoie tout seul. Corps `application/json`, 64 Ko maximum.
- Routes « commerçant » : session Supabase (cookies) obligatoire, sinon 401 `auth`. Le propriétaire est toujours la session ; une boutique d'un autre répond 404.
- Sans Supabase configuré : 503 `demo`.
- Noms de champs = colonnes SQL (`prix_centimes`, `couleur_principale`...). Champs inconnus refusés (400 `invalid`) côté commerçant.
- Montants : **centimes entiers** (`prix_centimes: 2599` = 25,99 €). Helpers : `eurosEnCentimes("25,99")`, `formatEuros(2599)`, `totalCentimes(lignes)` dans `src/lib/boutique/money.ts`. Types et libellés : `src/lib/boutique/types.ts` (`STATUT_LABEL`, `PAIEMENT_LABEL`, `TRANSITIONS`).
- Paiement : il n'y a AUCUN paiement en ligne. `paiement` vaut toujours `"non_payee"` (affichage conseillé : « Non payée (commande sans paiement en ligne) »). Jamais « payée ».
- Validation partagée (messages par champ) : `validateBoutique`, `validateProduit`, `validateVariante`, `validateCategorie`, `validateCommande` de `src/lib/boutique/validate.ts` utilisables côté navigateur ; le serveur reste l'autorité.

## Commerçant (authentifié)

| Route | Corps / entrée | Réponse |
|---|---|---|
| `GET /api/boutique` | | `{ boutiques: Boutique[] }` (les miennes) |
| `POST /api/boutique` | `{ slug, nom, description?, couleur_principale?, couleur_accent?, logo?, adresse?, whatsapp?, email?, telephone?, modes?, statut? }` | 201 `{ boutique }` (brouillon par défaut) |
| `GET /api/boutique/{id}` | | `{ boutique, categories[], produits[] }` ; chaque produit contient `variantes[]` (stock compris, produits inactifs inclus) |
| `PATCH /api/boutique/{id}` | mêmes champs, tous facultatifs (au moins un) | `{ boutique }`. `statut: "publiee"` met en ligne, `"brouillon"` retire |
| `DELETE /api/boutique/{id}` | | `{ ok: true }`. Supprime aussi produits, variantes ET commandes (irréversible : demander confirmation) |
| `POST /api/boutique/{id}/categories` | `{ nom, position? }` | 201 `{ categorie }` |
| `PATCH` / `DELETE /api/boutique/{id}/categories/{cid}` | `{ nom?, position? }` | `{ categorie }` / `{ ok }` (produits conservés, sans catégorie) |
| `POST /api/boutique/{id}/produits` | `{ titre, prix_centimes, description?, images? (https, 5 max), actif?, position?, categorie_id?, variantes?: [{ nom, stock?, actif?, position? }] }` | 201 `{ produit }` avec `variantes`. Sans `variantes` : une variante « Unique », stock 0 |
| `PATCH` / `DELETE /api/boutique/{id}/produits/{pid}` | `{ titre?, description?, prix_centimes?, images?, actif?, position?, categorie_id? }` | `{ produit }` / `{ ok }`. `actif: false` = invisible du public |
| `POST /api/boutique/{id}/produits/{pid}/variantes` | `{ nom, stock?, actif?, position? }` | 201 `{ variante }` |
| `PATCH` / `DELETE .../variantes/{vid}` | `{ nom?, stock?, actif?, position? }` | `{ variante }` / `{ ok }` |
| `GET /api/boutique/{id}/commandes?statut=` | statut facultatif | `{ commandes: Commande[] }` (200 max, récentes d'abord), avec `lignes_commande[]` |
| `PATCH /api/boutique/{id}/commandes/{ref}` | `{ statut }` | `{ commande: { ref, statut, paiement, updated_at } }` |

Boutique : `modes` ⊂ `["retrait","livraison","contact"]` (au moins 1), `whatsapp`/`telephone` : chiffres avec `+` éventuel (espaces tolérés, normalisés), `logo` : URL `https://` (pas d'envoi de fichier dans cette version), couleurs `#rrggbb`, slug 3 à 40 caractères minuscules/chiffres/tirets (mêmes règles et mots réservés que les sites publiés).

Statuts de commande : `nouvelle → confirmee → prete → terminee` ; `annulee` possible depuis nouvelle, confirmee, prete. `terminee` et `annulee` sont définitifs. Un autre passage : 409 `statut_invalide`. Une annulation remet le stock. Seul le statut est modifiable.

Erreurs propres au commerçant : 403 `limite_boutiques` / `limite_sites` / `publication_formule` (formule, migration 0006 : Gratuit 1 boutique en brouillon et AUCUNE publication ; Solo 1, Pro 5, Illimité sans limite ; publier une boutique compte avec les sites publiés. Une boutique dont le propriétaire repasse en Gratuit ou dont l'abonnement est résilié est suspendue : 404 pour le public, données conservées, voir `docs/LIMITES-SERVEUR.md`), 409 `duplicate` (slug pris, nom de catégorie ou de variante déjà utilisé), 400 `invalid` + `errors`, 404 `not_found`.

## Public (sans connexion)

### `GET /api/boutique/catalogue/{slug}`
Boutique **publiée** uniquement (brouillon, inconnue : 404). Réponse :
`{ boutique: { id, slug, nom, description, couleur_principale, couleur_accent, logo, adresse, whatsapp, email, telephone, modes, published_at }, categories: [{ id, nom, position }], produits: [{ id, categorie_id, titre, description, prix_centimes, images, position, variantes: [{ id, nom, stock, position, disponible }] }] }`
Seuls les produits et variantes actifs sont renvoyés. Le panier ne garde que `variante_id` et `quantite`.

### `POST /api/boutique/commande`
Corps :
```json
{ "slug": "chez-awa", "cle": "uuid-ou-16-a-64-car", "mode": "retrait",
  "client": { "nom": "Awa", "email": "awa@exemple.fr", "telephone": "+221...", "adresse": "", "note": "" },
  "lignes": [{ "variante_id": "<uuid>", "quantite": 2 }],
  "site": "" }
```
- `cle` : clé d'idempotence générée UNE fois par panier (ex. `crypto.randomUUID()`) et renvoyée telle quelle en cas de nouvel essai (double clic, réseau coupé) : la commande n'est créée qu'une fois.
- `client.nom` obligatoire ; au moins un `email` ou `telephone` ; `adresse` obligatoire si `mode = "livraison"`.
- `site` : champ piège caché (laisser vide, `display:none`, `tabindex=-1`, `autocomplete=off`). Rempli = faux succès sans enregistrement.
- Tout prix, total, statut ou paiement envoyé est **ignoré** : prix et stock sont relus en base, le total est recalculé.
- 1 à 20 lignes, quantité entière 1 à 99, lignes d'une même variante additionnées.

Réponse 201 : `{ commande: { ref: "CMD-3F9A1C2B", statut: "nouvelle", total_centimes, paiement: "non_payee", mode, jeton_suivi }, rejouee: false }`.
Même `cle` rejouée : 200, `rejouee: true`, même `ref`, **sans** `jeton_suivi` (il n'est donné qu'une fois : l'interface doit le garder, par exemple dans le lien de suivi).

Erreurs : 400 `invalid` (+ `errors`), `mode_invalide`, `client_invalide`, `quantite_invalide`, `cle_invalide` ; 403 `origin` ; 404 `boutique_introuvable` (brouillon ou inconnue) ; 409 `stock_insuffisant`, `produit_indisponible` (produit/variante inactif ou d'une autre boutique) ; 429 `rate_limit` (5 par minute et 30 par heure et par IP) ou `trop_de_commandes` (100 par heure et par boutique) ; 503 si le serveur n'est pas configuré.

### `POST /api/boutique/suivi`
Corps `{ ref, jeton }` (le `jeton_suivi` reçu à la commande). Réponse `{ commande: { ref, statut, paiement, mode, total_centimes, boutique: { nom, slug }, lignes: [{ titre, variante, prix_unitaire_centimes, quantite }] } }`. Mauvais couple : 404 (rien n'est révélé). Les coordonnées du client ne sont jamais renvoyées.

## Garanties côté base (testées)

- Le public ne lit jamais une commande (ni la sienne : le suivi passe par le jeton) ; un commerçant ne lit que les commandes de ses boutiques.
- Le public ne lit pas `proprietaire_id` ; il ne voit que boutiques publiées, produits et variantes actifs.
- La commande est créée par la fonction SQL `boutique_creer_commande` (réservée à la clé serveur) : prix/stock relus, stock décrémenté sous verrou de ligne (pas de survente), tout ou rien, idempotence par `(boutique, cle)`.
- Les lignes copient titre, variante et prix au moment de la commande.
- `commandes.paiement` est contraint à `non_payee` par la base.

## Limites connues (V1)

- Le stock est obligatoire (entier, 0 = épuisé) : pas de « stock illimité ».
- Pas d'envoi de fichiers : logo et images = URL https.
- Aucun e-mail / notification envoyé au commerçant ni au client (le commerçant consulte la liste des commandes).
- Limite par IP en mémoire (par instance serveur), comme la liste d'attente.
- Le contrôle d'origine suppose que la page boutique est servie depuis le domaine du site (ou `NEXT_PUBLIC_APP_URL`) ; un domaine personnalisé demandera d'autoriser son origine.
