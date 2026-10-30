# Contrôle d'origine (défense CSRF)

Un seul utilitaire : `src/lib/origin.ts` (`originOk`, `originGuard`). Toutes les routes d'écriture authentifiées par cookies l'utilisent : `/api/sites`, `/api/account`, `/api/stripe/checkout`, `/api/stripe/portal`, `/api/legal/accept` (via `originGuard`), `/api/boutique/**` et `/api/brand/**` (via `authorizeOwner` / `authorize`, qui appellent `originOk(req, { referer: false })`). Exclus : webhook Stripe (signature) et liste d'attente publique. Tests : `src/lib/origin.test.ts`, `src/app/api/securite-audit.test.ts`, tests boutique et marque blanche.

## Différences entre les trois anciennes copies

| Point | `lib/origin.ts` (avant) | `lib/boutique/api.ts` et `lib/brand/api.ts` (avant) | Maintenant |
|---|---|---|---|
| Repli sur le Referer sans en-tête Origin | oui | non (refus) | option : défaut oui ; boutique et marque blanche passent `referer: false` => **refus conservé** |
| Origin `null` | refus | refus | refus |
| Comparaison | origine normalisée (`new URL().origin`) | chaîne exacte de l'Origin contre l'origine de la requête et `appUrl()` tel quel | origine entière (schéma, hôte, port) ; l'en-tête Origin doit être **exactement** une origine (un chemin ou un « / » final est refusé : plus strict que `origin.ts`, jamais envoyé par un navigateur) |
| `NEXT_PUBLIC_APP_URL` avec un chemin | accepté (normalisé) | jamais égal | accepté (normalisé) |
| Origin présent mais invalide, Referer valide | refus | refus | refus |

Aucun comportement n'est affaibli ; aucun test existant n'a eu besoin d'être modifié.

## Liste blanche facultative (désactivée par défaut)

Sans variable, seules l'adresse de la requête et `NEXT_PUBLIC_APP_URL` sont acceptées.

- `ALLOWED_ORIGINS` : origines **exactes** séparées par des virgules, de la forme `https://hote[:port]`. `http://` accepté seulement pour `localhost`, `127.0.0.1`, `[::1]`. Sans chemin, sans identifiants, **sans joker** : une entrée avec `*` ou invalide est ignorée (avertissement dans les journaux) et n'ouvre rien. Usage prévu : futur domaine personnalisé (ajouter `https://www.exemple.fr` et `https://exemple.fr` si les deux servent le site).
- `ALLOWED_VERCEL_PREVIEW` : motif d'aperçus d'un projet précis, forme **`projet-*-equipe.vercel.app`** (un seul joker entouré de tirets, nom du projet ET nom d'équipe littéraux). Accepté : `https://projet-<milieu>-equipe.vercel.app` (milieu en minuscules, chiffres et tirets, sans point), https, sans port. Refusés : `projet-*.vercel.app` (voir risque), `*.vercel.app`, plusieurs jokers, préfixe ajouté (`evil-projet-...`), autre équipe, `...vercel.app.evil.com`, sous-domaine supplémentaire, http, port.
  **À valider avec le nom réel du projet et de l'équipe Vercel** (rien n'est supposé : laisser vide tant que ce n'est pas vérifié ; adresses d'aperçu visibles dans Vercel → Deployments).

### Risques

- Sur Vercel, n'importe qui peut créer un projet nommé `decollage-quelquechose` dans son propre compte : `decollage-quelquechose.vercel.app` n'est donc **pas** une preuve d'appartenance. C'est pourquoi le nom d'équipe est obligatoire dans le motif et pourquoi `decollage-*.vercel.app` est refusé. Une URL `*.vercel.app` d'un autre projet ou d'une autre équipe ne passe jamais.
- Un aperçu accepté peut écrire sur la même base que la production (même Supabase/Stripe si les variables sont partagées) : activer ce motif seulement si les aperçus sont des déploiements de confiance, et mieux vaut leur donner une base de test.
- Les cookies de session de la production ne sont pas envoyés à un autre hôte ; un aperçu a ses propres connexions. Le motif sert donc surtout à tester les écritures depuis un aperçu, pas à partager une session.
- `ALLOWED_ORIGINS` accepte toute origine listée avec les cookies de l'utilisateur : n'y mettre que des domaines que tu contrôles.

## Tests

`src/lib/origin.test.ts` : origine exacte, sous-domaine voisin, hôte plus long, suffixe piégé (`evil-decollage-...vercel.app`, `...vercel.app.evil.com`), Origin `null`/vide/avec chemin, schéma http, port différent, valeurs vides, jokers, motifs trop larges, repli Referer avec et sans `referer: false`. Simulation uniquement (aucune vraie requête de navigateur) : à vérifier une fois en ligne avec un aperçu réel si le motif est activé.
