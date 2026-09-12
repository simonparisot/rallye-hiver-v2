# Tests fonctionnels — Rallye d'Hiver

Suite exécutable sur trois environnements, avec des garanties différentes selon
la cible. Les tests parlent à l'API déployée : ils vérifient le comportement
réel du rallye, pas des mocks.

## Démarrage

```bash
cd tests
npm install
cp .env.test.example .env.test   # puis compléter les mots de passe
npm test                         # suite complète sur l'environnement de test
```

## Commandes

| Commande | Cible | Effet |
|---|---|---|
| `npm test` | test | Tout : API, scénarios, santé |
| `npm run test:api` | test | Contrat de l'API (crée des comptes en série) |
| `npm run test:scenarios` | test | Les 12 scénarios du rallye |
| `npm run test:health` | test | Santé, sans effet de bord |
| `npm run test:prod` | **production** | Santé uniquement, strictement en lecture |
| `npm run test:prod:scenarios` | **production** | Les 12 scénarios, sur le décor de test |
| `npm run provision` | test | Crée le décor permanent (comptes + équipe) |
| `npm run sweep` | test | Supprime les comptes jetables orphelins |
| `npm run test:e2e` | test | Les scénarios par le navigateur (desktop + mobile) |
| `npm run test:e2e:visual` | test | Régression visuelle |
| `npm run test:e2e:update` | test | Régénère les captures de référence |

Les variantes `provision:prod` et `sweep:prod` existent pour la production.

## Les trois niveaux d'écriture

Le fichier `config/environments.js` attribue à chaque environnement une capacité,
et chaque suite déclare ce dont elle a besoin. Un test ne peut pas écrire là où
il n'en a pas le droit : la suite s'interrompt avant le premier appel HTTP.

- **`read`** — aucune trace. Santé du site, disponibilité, contrôle des accès.
- **`scoped`** — écriture confinée à l'équipe de test et à des participants
  jetables dont l'adresse suit un motif réservé, avec effacement des traces.
  C'est le niveau des 12 scénarios, et le maximum autorisé en production.
- **`full`** — écriture libre. Environnement jetable uniquement.

Trois protections se cumulent en production : la capacité plafonne à `scoped`,
toute écriture exige `ALLOW_PROD_WRITES=1`, et `assertScopedResource` refuse
d'agir sur une adresse hors du motif réservé — un compte de participant est
rejeté même si un test s'égarait.

## Ce que couvrent les 12 scénarios

En tant que membre d'une équipe (`scenarios/01`, `scenarios/02`) : authentification,
affichage d'une énigme, affichage d'un parcours, mot de passe erroné, mot de passe
correct, complétion d'un parcours, téléchargement d'une énigme, téléchargement d'un
parcours, statistiques du tableau de bord.

À l'arrivée d'un participant (`scenarios/03`) : création de compte, demande
d'adhésion, acceptation par un membre établi.

En complément (`scenarios/04`) : cloisonnement du back-office. L'authorizer ne
vérifie pas `isAdmin` — ce contrôle est fait handler par handler via
`requireAdmin()`. Un endpoint d'administration qui oublierait cet appel serait
ouvert à tout participant connecté ; ces tests vérifient que muni d'un jeton
ordinaire, aucun endpoint `/admin/*` ne répond.

Hors périmètre, comme convenu : la création d'équipe et le paiement Stripe.

## Le jeu de l'oie (édition 2027)

`api/oie.test.js` et `e2e/oie.spec.ts` couvrent l'énigme jouée sur un plateau
partagé. Le quota est d'un lancer par jour et par équipe : un test qui lancerait
les dés à chaque exécution rendrait la suite non rejouable. Les deux fichiers
sont donc construits en deux temps.

Ce qui ne coûte rien tourne toujours : forme de `GET /oie`, absence des questions
et des réponses dans la charge utile, place des cases spéciales, refus opposés à
un visiteur anonyme et à une action impossible, cloisonnement de `/admin/oie/*`.

Ce qui consomme un lancer n'est exécuté qu'avec un compte d'administration
configuré (`TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`), parce qu'il faut pouvoir
remettre l'équipe en case 0 avant et après par `POST /admin/oie/teams/{id}/reset`.
Sans ce compte, ces cas sont ignorés avec un avertissement plutôt que d'échouer.

La machine à états elle-même — enchaînement des cases oie, rebond sur la 63,
troisième échec, puits, prison, mort, changement de journée à minuit heure de
Paris — est couverte par des tests unitaires côté serveur, sans réseau :
`cd backend && npm test`.

## Le décor, et ce qu'il devient

`scripts/provision.js` installe un décor **permanent** : deux comptes stables et
une équipe de test marquée payée, conservée d'un run à l'autre. Il est idempotent.

Les scénarios, eux, ne créent que des participants **jetables**, supprimés en fin
de test — compte Cognito, enregistrement en base, appartenance à l'équipe — même
si une assertion échoue. La progression de l'équipe de test est remise à zéro
après chaque run : sans quoi une énigme résolue le resterait, et les tentatives
fausseraient le calcul de difficulté en production.

Tout compte créé via `createEphemeralUser` — ou déclaré par `registerForCleanup`
pour une création directe — est supprimé automatiquement en fin de suite, y
compris si un test a échoué. `scripts/sweep.js` reste le filet de rattrapage
pour un processus interrompu avant l'exécution du `afterAll`.

## Tests de navigateur

Playwright pilote un vrai navigateur contre le site déployé. Deux profils :
`desktop` (Chromium, 1440×900) et `mobile` (WebKit, iPhone 13) — WebKit parce
qu'une large part des participants joue sur iPhone, et que Safari s'écarte
parfois de Chromium, notamment sur l'affichage des PDF.

Prérequis, une seule fois : `npx playwright install chromium webkit`.

La session est ouverte une fois par `e2e/auth.setup.ts`, via l'API, puis
partagée par tous les tests. Le formulaire de connexion, lui, est exercé pour
lui-même dans `auth.spec.ts` : le rejouer avant chaque scénario rendrait toute
la suite dépendante de son habillage, que la refonte 2027 va changer.

Chaque test surveille la console et le réseau : une erreur JavaScript ou une
réponse serveur en échec fait échouer le test, même si le scénario aboutit
visuellement.

### Points d'accroche

Les sélecteurs s'appuient sur des `data-testid` (`<zone>-<élément>`), jamais sur
les libellés ni les classes CSS — ceux-ci seront réécrits en 2027, les rôles
non. Les éléments répétés portent un identifiant issu de la donnée
(`enigma-card-3`), jamais l'indice de boucle, qui changerait au moindre tri.

### Régression visuelle

Les captures de référence vivent dans `e2e/visual.spec.ts-snapshots/`. Les
animations sont neutralisées pour les rendre reproductibles. Quand la nouvelle
interface sera arrêtée, elles se régénèrent d'un bloc avec
`npm run test:e2e:update`.

## Défauts connus

Les tests marqués `[défaut connu]` utilisent `test.failing` : ils décrivent le
comportement attendu d'une API correcte et resteront « attendus en échec »
jusqu'à correction. Le jour où le handler est corrigé, ils virent au rouge pour
signaler qu'il faut les repasser en tests normaux.
