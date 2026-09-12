# Ménage du dépôt

Inventaire établi le 23 août 2026, à faire **après** la refonte d'interface —
plusieurs éléments en dépendent.

Chaque ligne a été vérifiée : nombre d'imports réels, contenu du fichier,
comparaison avec le code en service. Les points où le premier inventaire se
trompait sont signalés.

---

## À supprimer sans risque, dès maintenant

Aucun de ces éléments n'est référencé, et aucun ne dépend de la refonte.

| Élément | Constat |
|---|---|
| `frontend/src/logo.svg` | Logo de Create React App, zéro import |
| `frontend/src/App.test.tsx` | Test par défaut cherchant un lien « learn react » inexistant : il échouerait s'il tournait. `setupTests.ts` part avec lui |
| `frontend/.env.local.backup` | Suivi par git, contient `localhost:3001` et `to-be-filled-after-deployment` |
| `tests/visual/` | Dossier vide : créé en préparant la couche visuelle, dont les tests ont finalement été placés dans `tests/e2e/` |
| `run-functional-tests.sh` | Un `cd tests && npm test` enrobé d'échos ; `tests/README.md` documente déjà les commandes |
| `.DS_Store` (racine et `backend/`) | Ignorés par git, encombrent le disque |
| `amazon-cognito-identity-js` | Dépendance de `frontend/package.json`, zéro import — l'authentification passe par l'API |

## Documents dont les conclusions sont appliquées, ou fausses

| Document | Constat |
|---|---|
| `ACCESS_CONTROL_MATRIX.md` | **Le plus urgent.** Affirme que le contrôle administrateur n'est *pas appliqué*, alors que `requireAdmin()` est appelé dans 18 des 23 handlers concernés. Un lecteur qui s'y fierait croirait à une faille béante et « corrigerait » ce qui fonctionne |
| `TOKEN_REFRESH_ANALYSIS.md` | 16 ko dont la thèse — « pas de rafraîchissement automatique » — est fausse : `AuthContext` rafraîchit cinq minutes avant expiration |
| `MIGRATION_INSTRUCTIONS.md` et `backend/migrate-to-single-env.sh` | Migration effectuée, artefacts à usage unique |
| `ADMIN_CSS_AUDIT.md` | Recommandait de factoriser le CSS admin : `frontend/src/admin/styles/` le fait |
| `DOCUMENTATION_SUMMARY.md` | Index daté du 16/11/2025 citant quatre fichiers disparus et ignorant les six écrits depuis. Un index faux coûte plus qu'il ne rapporte |
| `PERFORMANCE_AUDIT.md` | Son constat principal ne tient plus (React Query déduplique les requêtes d'équipe). Les autres points restent à vérifier avant suppression |

## Après la refonte d'interface

Ces neuf fichiers ne sont importés nulle part : c'est l'ancienne navigation par
routes, abandonnée au profit des panneaux bien avant la refonte 2027. Aucune des
maquettes retenues ne les réutilise.

```
frontend/src/pages/       Landing, Login, Signup, Dashboard,
                          BrowseTeams, CreateTeam, TeamDetail, Content
frontend/src/pages/       Landing.css, Auth.css, Dashboard.css,
                          Team.css, Content.css
frontend/src/components/layout/Layout.tsx
```

Environ 1 100 lignes. Ils portent des `data-testid` posés lors de la passe
d'instrumentation : ces attributs ont été ajoutés sans vérifier que les pages
étaient atteignables, ils partiront avec les fichiers.

**À faire après la refonte**, le temps de s'assurer qu'aucun écran nouveau n'en
reprend une partie.

---

## Fusionner les deux `serverless.yml` — avec précaution

`backend/serverless.yml` et `backend/serverless-test.yml` font 32 ko chacun pour
28 lignes de différence. Leur désynchronisation a déjà failli coûter cher : le
fichier de test, resté en arrière, aurait supprimé onze lambdas en service.
Un fichier unique paramétré par stage supprimerait cette classe de bug.

**Le piège, qui n'est pas dans l'écart de 28 lignes.** Les tables se nomment
`${self:service}-users`, et le service diffère selon l'environnement :

| Environnement | Service | Table réelle |
|---|---|---|
| Production | `rallye-hiver-backend` | `rallye-hiver-backend-users` |
| Test | `rallye-hiver-backend-test` | `rallye-hiver-backend-test-users` |

Un fichier unique adoptant le motif habituel `${self:service}-${sls:stage}-users`
produirait `rallye-hiver-backend-prod-users` — **une table qui n'existe pas**.
CloudFormation en créerait de nouvelles, vides, et la production repartirait de
zéro : 73 équipes et 356 comptes hors circuit. Les `DeletionPolicy: Retain`
posées le 22 août éviteraient la destruction, pas le basculement.

La fusion exige donc un mapping explicite du suffixe par stage, reproduisant
exactement les noms actuels :

```yaml
custom:
  suffixeService:
    prod: ''
    test: '-test'
```

À traiter comme un changement d'infrastructure : comparer le template généré au
template déployé avant d'appliquer, et vérifier qu'aucune table ni pool n'est
*remplacé*.

## Autres regroupements

| Élément | Constat |
|---|---|
| `frontend/ADMIN_README.md` et `ADMIN_APP_SETUP.md` | Deux présentations du même panneau d'administration |
| `FRONTEND_INTEGRATION_GUIDE.md` | 12 ko redocumentant des endpoints que `API_CONTRACT.md` (56 ko) couvre déjà |
| `bucket-policy.json` (racine) | Politique du bucket servant l'application : sa place est dans `platform/` |
| `README.md` (racine) | Sa section déploiement décrit `proto.rallyehiver.fr` ; `platform/dns.md` la remplace avec plus de justesse |
| `DESIGNSYSTEM.md` | Décrit le thème « bande dessinée », donc une édition. Sa place est auprès de `frontend/src/editions/`, où vivent désormais les thèmes |

---

## À trancher

Ces points appellent une décision, pas un constat.

- **`COORDINATION-LOG.md`, 72 ko.** Journal du va-et-vient entre agents : précieux
  comme historique, mort comme référence. Archiver, tronquer, ou laisser courir ?
- **`CLAUDE.md`.** Décrit un workflow à deux agents front et back, servi par
  180 ko de documents de coordination. Est-ce encore la façon de travailler ?
- **`NEWFEATURES.md`.** Spécification du calcul de difficulté. À noter :
  l'implémentation s'en écarte — le taux d'échec est calculé sur les équipes
  actives et non sur le total, et le coefficient d'abandon a disparu. À mettre à
  jour ou à replier dans `SPECIFICATION.md`, mais pas à laisser diverger en
  silence.
- **`backend/PAYMENT_WEBHOOK_DEBUG.md`.** Notes de débogage : toujours
  d'actualité, ou souvenir d'un incident résolu ?
- **`frontend/.env.production` suivi par git.** Les identifiants Cognito sont
  publics par nature, mais ce sont des valeurs de production dans le dépôt.
- **Les deux scripts de déploiement** (`scripts/deploy-frontend.sh` et
  `platform/home/deploy.sh`). Cohérent si chacun reste près de sa cible, à
  unifier sinon.

## À ne pas toucher

- **`statics/`** — dépôt des sources fournies par les organisateurs : le logo des
  deux masques et la photo de scène. Ces fichiers sont *copiés* dans
  `frontend/public/`, d'où l'impression qu'ils ne sont référencés nulle part.
  Les supprimer perdrait les originaux.
- **`tests/e2e/.auth/participant.json`** — correctement ignoré par git, mais
  contient des jetons valides 24 heures et un jeton de rafraîchissement Cognito
  qui permet d'en régénérer bien au-delà. Bénin sur le décor de test ; le jour où
  les tests de navigateur viseront la production, ce fichier contiendra une
  session de production. À ne pas partager, à purger en cas de doute.
