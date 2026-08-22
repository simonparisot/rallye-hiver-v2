# Domaines et distributions

État au 2026-08-23, après la séparation du site vitrine et de l'application de jeu.

| Domaine | Sert | Distribution | Origine |
|---|---|---|---|
| `rallyehiver.fr` | Site vitrine | `E2BGPNXDN8XXQX` | `s3://home.rallyehiver.fr` |
| `www.rallyehiver.fr` | Redirection 301 vers le domaine nu | `E2BGPNXDN8XXQX` | — |
| `2026.rallyehiver.fr` | Application de jeu, édition 2026 | `E2M1D4SPTNMDIK` | `s3://proto.rallyehiver.fr` |
| `test.rallyehiver.fr` | Application de jeu, environnement de test | `E104E5O2KDVFJN` | compte `rallye-test` |

Certificat : `*.rallyehiver.fr` + `rallyehiver.fr`, dans `us-east-1` — région
imposée par CloudFront. Le caractère générique couvre les sous-domaines des
éditions à venir : aucun certificat à demander pour `2027.`.

## Le principe

Le domaine nu appartient au Rallye, pas à une édition. Chaque édition vit sous
son propre sous-domaine et y reste indéfiniment, comme les archives `2012.` à
`2025.`. Ouvrir l'édition 2027 consistera donc à créer `2027.rallyehiver.fr`
sans toucher à `2026.`, qui continuera de servir son édition.

## Conséquence à ne pas oublier

L'API n'autorise **qu'une seule origine** dans son en-tête CORS, et
`Access-Control-Allow-Credentials: true` interdit le joker `*`. Le paramètre
`/rallye-hiver/prod/cors-origin` doit donc nommer le domaine de l'édition en
cours — aujourd'hui `https://2026.rallyehiver.fr`.

Le site vitrine, lui, n'appelle aucune API : du HTML servi tel quel.

Une erreur sur ce paramètre rend l'application inutilisable sans que rien ne le
signale côté serveur : les appels d'API réussissent, c'est le navigateur qui
bloque. Les tests de partage entre origines de `tests/prod/health.test.js`
existent pour cela.
