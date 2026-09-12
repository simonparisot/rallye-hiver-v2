# Projet 3 : le jeu de l'oie partagé, réalisation

**Branche :** `feat/oie`
**Spécification d'origine :** `specs/3-enigme-particuliere.md`
**Bac à sable de vérification :** stack `rallye-hiver-backend-oie-oie`,
API `https://r9c7lyh149.execute-api.eu-west-1.amazonaws.com/oie`, frontend local
sur le port 3003. Rien n'a été déployé sur `test.rallyehiver.fr` ni sur la
production.

---

## Ce que c'est

Une des vingt énigmes de l'édition 2027 se joue sur un plateau de jeu de l'oie
de 63 cases, **commun à toutes les équipes**. C'est ce partage qui fait exister
les interactions du jeu : celle qui tombe dans le puits y reste jusqu'à ce
qu'une autre l'y rejoigne et la repêche.

Chaque équipe lance deux dés une fois par jour, répond à la question de la case
où elle arrive, et ne retrouve le droit de lancer qu'une fois la bonne réponse
donnée. Arriver en case 63 résout l'énigme.

Le thème est celui de l'édition : le théâtre. L'oie devient l'acteur sur son
oie, l'hôtel devient la loge, la mort devient la répétition.

---

## Règles implémentées

### Le tour de jeu

1. L'équipe lance deux dés à six faces. **Les dés sont tirés par le serveur**,
   jamais par le navigateur, et le lancer est journalisé.
2. Elle avance de leur somme et les effets de la case d'arrivée s'appliquent.
3. Une question l'attend sur sa nouvelle case. Tant qu'elle n'y répond pas
   juste, elle ne peut pas relancer. Les tentatives sont illimitées et toutes
   journalisées.
4. Le quota quotidien est `rollsPerDay`, réglable par l'admin à tout moment,
   **1 par défaut**. La journée change à minuit, heure de Paris.

La comparaison des réponses reprend celle des mots de passe d'énigme : casse,
accents, ligatures, espaces et ponctuation ignorés. « Moliere » et « Molière ! »
sont acceptés indifféremment.

### Les cases spéciales

| Case | Nom | Effet |
|---|---|---|
| 9, 18, 27, 36, 45, 54 | L'acteur sur son oie | On avance à nouveau du même total, immédiatement, sans consommer de lancer et sans question sur la case oie |
| 14, 39, 50, 60 | Le souffleur | La question dispose d'un indice, que l'équipe peut demander |
| 19 | La loge | On passe un tour |
| 31 | Le puits | On y reste jusqu'à ce qu'une autre équipe y tombe |
| 52 | La prison | On passe deux tours, sauf si une autre équipe y tombe |
| 58 | La répétition | Retour à la case 0 |
| 63 | Rideau | Arrivée, à atteindre pile |

### La fin de partie

Il faut tomber pile sur la 63. En cas de dépassement, on recule de l'excédent
depuis la 63, et les règles de la case d'arrivée s'appliquent. À la **troisième**
fois qu'une équipe rate la 63 pile, le metteur en scène la place directement en
63.

### Le classement

Arriver en 63 écrit un `TeamEnigmaProgress` `solved: true` avec `solvedAt` sur
l'énigme désignée, et incrémente `solvedEnigmasCount` de l'équipe : le classement
et les statistiques existants la comptent sans traitement particulier.

Le mode d'attribution des points n'étant pas défini, il n'est pas inventé. Tout
ce qui permettra d'appliquer n'importe quelle règle plus tard est enregistré :
rang d'arrivée (`finishRank`), date (`finishedAt`), nombre de lancers
(`totalRolls`), nombre de mauvaises réponses (`wrongAnswers`), nombre d'indices
demandés (`hintedSquares`), nombre d'échecs au 63 (`overshootCount`). Le journal
complet reste dans `oie-events`.

---

## Hypothèses à valider

La spécification ne tranche pas ces points. Voici ce qui est implémenté ; tout
est modifiable, la plupart en une ligne du module de règles.

### 1. La case de l'oie fait rejouer du même total

Règle classique : on avance à nouveau de la même somme, tout de suite, sans
consommer de lancer, et la question posée est celle de la case d'arrivée finale.
Aucune question n'est jamais posée sur une case oie, puisqu'on ne s'y arrête pas.

### 2. Le premier neuf ne s'enchaîne pas (ajout par rapport au brief)

Depuis la case 0, un total de 9 tombe sur l'oie de la case 9, qui renvoie neuf
cases plus loin, sur une autre oie, et ainsi de suite jusqu'à la 63. **L'énigme
était gagnée au premier lancer, une fois sur neuf.** Constaté au tout premier
essai sur le bac à sable : dés 4 et 5, arrivée immédiate.

Le jeu de l'oie classique porte depuis toujours la règle qui répare cela : un
premier neuf fait de 6 et 3 mène en case 26, un premier neuf fait de 5 et 4 mène
en case 53, et la chaîne des oies ne s'applique pas. Elle est reprise ici,
attachée à la case 0 plutôt qu'au nombre de lancers, pour qu'un retour à la case
0 par la répétition ne rouvre pas le raccourci.

**À valider :** c'est une règle que le brief ne demandait pas. La seule autre
issue serait d'accepter qu'une équipe sur neuf gagne l'énigme du premier coup.

### 3. La loge fait perdre un jour de lancer, la prison deux

« Passer un tour » dans un régime de lancers quotidiens est modélisé par une date
de prochain lancer autorisé. Tomber sur la loge le jour D bloque la fin de la
journée D et toute la journée D+1 ; la prison bloque D, D+1 et D+2.

Avec le quota par défaut d'un lancer par jour, cela revient exactement à perdre
un lancer (la loge) ou deux (la prison), puisque celui du jour D vient d'être
consommé pour arriver là.

**À valider si le quota augmente :** avec trois lancers par jour, la loge coûtera
les lancers restants du jour plus ceux du lendemain, soit plus qu'un tour. Il
faudra choisir entre garder la journée comme unité de peine, ou compter en
lancers.

### 4. Le puits laisse répondre mais pas lancer

Une équipe dans le puits peut répondre à la question de sa case ; elle ne peut
pas lancer tant qu'une autre équipe n'y est pas tombée. Celle qui arrive libère
celle qui s'y trouvait et prend sa place. Même mécanique pour la prison, qui a
en plus une durée.

Quand plusieurs motifs de refus s'appliquent en même temps (une question en
attente et le puits, par exemple), c'est la question qui est annoncée en premier :
c'est la seule chose que l'équipe puisse faire avancer.

### 5. Ni la case 0, ni la 63, ni la 58 ne portent de question

On ne s'arrête sur aucune des trois : la 0 est le départ, la 63 termine la
partie, la 58 renvoie aussitôt à la 0. Les six cases oie non plus, pour la même
raison. Il reste **55 questions** à écrire.

### 6. Le souffleur est gratuit

Un bouton « Demander au souffleur », sans coût ni contrepartie. La demande est
enregistrée (`hintedSquares`, et une ligne dans le journal), de sorte qu'un mode
d'attribution des points pourra en tenir compte plus tard.

### 7. L'arrivée ne pose pas de question

Atteindre la 63 termine la partie immédiatement.

### 8. Le rang d'arrivée est figé à l'arrivée

`finishRank` est calculé au moment où l'équipe atteint la 63, en comptant celles
déjà arrivées. Deux équipes qui arriveraient dans la même seconde pourraient en
théorie recevoir le même rang ; `finishedAt` permet de le recalculer.

### 9. Les équipes de test sont masquées, sauf à elles-mêmes

Comme partout ailleurs dans l'application, une équipe marquée `isTestTeam`
n'apparaît pas parmi les pions des autres équipes. Elle se voit elle-même, sans
quoi elle ne pourrait pas jouer.

---

## Décisions d'architecture

### Essai isolé, code délimité

Tout le backend vit dans `backend/src/functions/oie/`, ses types dans
`backend/src/types/oie.ts`, tout le frontend dans `frontend/src/oie/` — page
d'administration comprise. Supprimer l'essai, c'est supprimer deux répertoires,
un fichier de types et une dizaine d'entrées dans les fichiers serverless.

Aucun champ n'est ajouté à `Enigma`, `Team` ni `TeamEnigmaProgress`.

### Un seul point d'entrée : le champ `enigmeOie` de l'édition

`frontend/src/editions/2027.ts` déclare :

```typescript
enigmeOie: {
  enigmaId: process.env.REACT_APP_OIE_ENIGMA_ID || '',
  route: '/oie',
  titre: "Le jeu de l'oie du théâtre",
}
```

Sans ce champ, ni la route `/oie`, ni l'entrée d'administration, ni le lien
depuis la liste des énigmes n'existent : une autre édition ignore tout de
`src/oie/`. Le champ est facultatif sur l'interface `Edition`
(`frontend/src/editions/types.ts`).

`enigmaId` est lu dans l'environnement de build pour ne pas avoir à recompiler
quand l'énigme est recréée. Le plateau reste jouable sans lui ; seul le lien
depuis la liste des énigmes disparaît.

### Les règles dans un module pur

`backend/src/functions/oie/rules.ts` ne connaît ni AWS, ni horloge, ni hasard :
la date et le générateur lui sont fournis. C'est ce qui permet de vérifier le
changement de journée à minuit heure de Paris et la troisième tentative ratée
du 63 sans attendre trois jours. Tous les handlers y délèguent, si bien que les
règles existent en un seul endroit.

### Toute la logique côté serveur

Le navigateur affiche ce que l'API répond et lui renvoie les clics. Il ne tire
aucun dé, n'applique aucun effet de case et ne connaît aucune réponse.

### Concurrence

Chaque état d'équipe porte un numéro de `version`, et chaque écriture est
conditionnée à la version lue. Deux membres d'une même équipe peuvent cliquer
« Lancer les dés » au même instant : un seul lancer est compté, le second reçoit
un 409 avec un message qui invite à recharger.

La libération d'une équipe du puits ou de la prison est elle aussi
conditionnelle (`inPuits = true`), pour que deux arrivées simultanées ne puissent
pas libérer deux fois ni libérer la nouvelle venue.

### L'énigme dans la liste

L'énigme « jeu de l'oie » est une `Enigma` ordinaire, créée par l'admin, sans PDF
ni mot de passe utiles. Dans `EnigmasPanel.tsx`, quand l'`enigmaId` correspond à
celui de l'édition, l'entrée porte un badge « Plateau partagé » et mène à `/oie`
au lieu d'ouvrir l'énoncé et le champ de mot de passe. C'est la seule
modification du composant : trois conditions et un badge.

---

## Ce qui est fait

### Backend

| Fichier | Rôle |
|---|---|
| `src/types/oie.ts` | Types du plateau, de l'état d'équipe et du journal |
| `src/functions/oie/rules.ts` | Machine à états pure : cases, déplacement, dates, normalisation des réponses |
| `src/functions/oie/store.ts` | Accès DynamoDB, écritures conditionnelles, journal |
| `src/functions/oie/view.ts` | Ce qu'un joueur a le droit de voir |
| `src/functions/oie/context.ts` | Garde d'accès et narration du fil |
| `src/functions/oie/get.ts` | `GET /oie` |
| `src/functions/oie/answer.ts` | `POST /oie/answer` |
| `src/functions/oie/roll.ts` | `POST /oie/roll` |
| `src/functions/oie/prompter.ts` | `POST /oie/prompter` |
| `src/functions/oie/admin/board.ts` | `GET` et `PUT /admin/oie/board` |
| `src/functions/oie/admin/teams.ts` | `GET /admin/oie/teams`, `POST /admin/oie/teams/{teamId}/reset` |

Trois tables, `DeletionPolicy: Retain`, déclarées à l'identique dans
`serverless.yml` et `serverless-test.yml` avec les droits IAM correspondants :
`oie-board`, `oie-team-state`, `oie-events`.

### Frontend

| Fichier | Rôle |
|---|---|
| `src/oie/types.ts` | Ce que le serveur envoie |
| `src/oie/api.ts` | Appels joueur et administration |
| `src/oie/OiePage.tsx` | La page `/oie` et sa garde d'accès |
| `src/oie/components/Plateau.tsx` | Les 64 cases en serpentin, les pions |
| `src/oie/components/CarteAction.tsx` | La question, le lancer, ou le motif du blocage |
| `src/oie/components/ResultatLancer.tsx` | L'annonce des dés et des effets |
| `src/oie/components/FilEvenements.tsx` | Le classement et le fil |
| `src/oie/admin/AdminOie.tsx` | La page `/admin/oie` |

Le plateau est dessiné en serpentin sur une grille de huit colonnes plutôt qu'en
spirale : la spirale est belle sur du carton et illisible sur un téléphone. Il
tient à 390 px de large (les libellés des cases disparaissent sous 420 px, la
couleur et l'info-bulle les remplacent), sans défilement horizontal de la page.

Aucune couleur n'est écrite en dur : tout vient des jetons de
`editions/themes/2027.css`. Le bleu de la comédie porte l'action, le bordeaux de
la tragédie porte l'enjeu, l'or est réservé à ce qui fait avancer, donc aux cases
de l'oie et à l'arrivée. Les boutons « Répondre » et « Lancer les dés » prennent
le rouge du rideau, comme le bouton « Tester » des énigmes classiques.

### Données d'essai

`backend/scripts/oie-board-2027.json` porte un plateau complet de 55 questions
fictives sur le théâtre, et `backend/scripts/seed-oie-board.js` le charge.

---

## Ce qui reste à faire

- **Écrire les 55 vraies questions.** Celles du fichier d'essai sont des
  questions de culture théâtrale grand public, à remplacer.
- **Le mode d'attribution des points**, non défini par le commanditaire. Tout ce
  qu'il faudra pour l'appliquer est déjà enregistré.
- **Trancher les hypothèses** listées plus haut, en particulier l'exception du
  premier neuf et le comportement de la loge si le quota passe au-dessus de 1.
- **Le rang d'arrivée** est figé à l'arrivée et non recalculé. Suffisant à
  l'échelle de 70 équipes qui jouent une fois par jour, à revoir si le mode
  d'attribution des points s'appuie dessus finement.
- **Le fil d'événements** montre les trente dernières lignes, sans pagination.

---

## Comment tester

### Sans réseau : les règles

```bash
cd backend && npm ci && npm test
```

44 tests sur la machine à états : nature des cases, enchaînement des oies,
exception du premier neuf, rebond sur la 63, troisième échec, loge, puits,
prison, répétition, quota quotidien, changement de journée à minuit heure de
Paris (heure d'été comprise), motifs de refus.

### Compilation

```bash
cd backend && npx tsc --noEmit     # aucune erreur dans oie/
cd frontend && npx tsc --noEmit && npm run build
```

`backend/npx tsc --noEmit` signale neuf erreurs **antérieures** à ce chantier
(`admin/game/start.ts`, `game/status.ts`, `payments/*`, `teams/*`), dans des
fichiers non touchés ici. `npm run build` du frontend signale trois
avertissements eslint eux aussi antérieurs (`AdminUsers.tsx`, `AuthContext.tsx`).

### Contre une pile déployée

```bash
cd tests
TEST_ENV=oie TEST_TEAM_ID=<id> npm run test:api      # ou jest api/oie
TEST_ENV=oie TEST_TEAM_ID=<id> npx playwright test oie
```

Voir la section « Le jeu de l'oie » de `tests/README.md` pour ce qui tourne
toujours et ce qui exige un compte d'administration.

### Amorcer un environnement neuf

```bash
cd backend
node scripts/seed-oie-board.js --dry-run          # vérifie le fichier sans rien écrire
AWS_PROFILE=<profil> node scripts/seed-oie-board.js \
  --table <service>-oie-board \
  --enigmas-table <service>-enigmas \
  --create-enigma --enigma-number 7
```

Le script crée l'énigme ordinaire qui porte le plateau si elle n'existe pas,
rattache le plateau à son identifiant, et l'affiche. Il est idempotent : une
énigme déjà marquée `isOieBoard` est réutilisée. Reportez ensuite cet
identifiant dans `REACT_APP_OIE_ENIGMA_ID` côté frontend pour que l'entrée de la
liste des énigmes mène au plateau.

---

## Format du JSON d'import des questions

C'est le même fichier pour le script de chargement et pour le bouton « Importer
un JSON » de la page `/admin/oie`. Le bouton « Exporter en JSON » produit
exactement cette forme : il n'y a qu'un format à connaître.

```json
{
  "rollsPerDay": 1,
  "enigmaId": "identifiant de l'énigme du jeu de l'oie",
  "squares": [
    {
      "squareNumber": 2,
      "question": "Quel auteur a écrit Le Malade imaginaire ?",
      "acceptedAnswers": ["Molière", "Jean-Baptiste Poquelin"],
      "flavor": "Texte d'ambiance, facultatif.",
      "hint": "Indice, seulement sur une case du souffleur."
    }
  ]
}
```

Règles du format :

- `squareNumber` va de 0 à 63 ; une case définie deux fois est refusée.
- Une case absente du tableau est conservée vide, elle n'efface rien.
- `acceptedAnswers` accepte plusieurs formulations. La comparaison ignore la
  casse, les accents, les espaces et la ponctuation : inutile de prévoir les
  variantes d'accentuation.
- `hint` n'a d'effet que sur les cases 14, 39, 50 et 60.
- `flavor` est une phrase d'ambiance affichée sous la position de l'équipe.
- Le **type** d'une case n'est jamais lu dans le fichier : il découle de son
  numéro. Écrire `"type": "puits"` sur la case 7 ne fait rien.
- Les cases 0, 63, 58 et les six cases oie n'ont pas besoin de question. Le
  script et la page d'administration signalent toutes les autres qui en
  manqueraient : une case muette laisse relancer sans répondre.

---

## Ce qui a été vérifié sur le bac à sable

Stack `rallye-hiver-backend-oie-oie`, déployée par `./scripts/sandbox.sh deploy
oie`. Rien n'a touché `test.rallyehiver.fr` ni la production.

**Par l'API**

- Une partie complète de la case 0 à la case 63 : neuf lancers, neuf questions,
  arrivée, rang 1.
- Chaque case spéciale, atteinte en repositionnant l'équipe puis en jouant le
  lancer par l'API : souffleur (14), loge (19, trois jours de blocage annoncés),
  prison (52, `inPrison`, trois jours), répétition (58, retour en 0), puits (31,
  `inPuits`, lancer refusé), oie (rejoue du même total).
- Le rebond sur la 63 et la troisième tentative : depuis la case 62, trois
  lancers, deux rebonds puis « le metteur en scène place l'équipe en case 63 ».
- **Le repêchage du puits à deux équipes réelles** : l'équipe A bloquée en 31,
  l'équipe B y tombe, A est libérée, B prend sa place, la ligne « B repêche A du
  puits » apparaît dans le fil et les deux pions sont visibles sur le plateau.
- Le souffleur : indice disponible, demandé, renvoyé, conservé au rechargement,
  et refusé en 404 sur une case ordinaire.
- L'arrivée écrit bien `TeamEnigmaProgress` `solved: true` et porte
  `solvedEnigmasCount` de l'équipe à 1.
- Les quatre endpoints d'administration, dont la remise à zéro.
- `tests/api/oie.test.js` : 14 cas, tous verts.

**Par le navigateur** (frontend local sur le port 3003, contre cette API)

- Le plateau des 64 cases, les cases spéciales colorées et légendées, les pions
  des deux équipes, le fil d'événements et le classement.
- Un tour complet : lancer, annonce des dés (2 et 1, total 3, de la case 0 à la
  case 3), question, réponse fausse refusée sans débloquer le lancer, bonne
  réponse qui le débloque.
- Le régime réel à un lancer par jour : après le lancer et la bonne réponse,
  « Vous avez utilisé tous vos lancers du jour. Revenez demain. »
- L'entrée « Le jeu de l'oie du théâtre » dans la liste des énigmes, avec son
  badge « Plateau partagé », mène bien à `/oie`.
- Aucune erreur de console.
- À 390 px de large : les 64 cases tiennent, la carte d'action reste accessible,
  la page ne défile pas horizontalement.
- `tests/e2e/oie.spec.ts` : 7 cas verts en bureau (Chromium) et 7 en téléphone
  (WebKit, iPhone 13), un cas sauté de chaque côté parce que son préalable
  n'était pas réuni au moment du passage.

---

## Deux points qui dépassent ce chantier

### `versionFunctions: false` dans les deux fichiers serverless

La pile atteignait **542 ressources CloudFormation**, au-delà des 500 acceptées :
le déploiement échouait, et **plus aucune fonction ne pouvait être ajoutée au
projet**, par ce chantier comme par les suivants.

Les 76 `AWS::Lambda::Version` ne servaient à rien ici : aucun alias, aucune
concurrence provisionnée, et API Gateway appelle l'ARN non qualifié de la
fonction. Elles n'étaient référencées que par des sorties CloudFormation.
`versionFunctions: false` ramène la pile à **466 ressources** sans changer le
comportement.

**À valider :** c'est une modification de la configuration partagée, pas un
ajout. Appliquée à la pile de production, elle supprimera les versions publiées
existantes. Rien ne les référence, mais la décision n'est pas la mienne.

### Les instances axios sont exportées

`frontend/src/services/api.ts` et `frontend/src/admin/services/adminAPI.ts`
exportent désormais leur instance axios (un mot ajouté à chacun), pour que
`src/oie/` réutilise les intercepteurs d'authentification et de rafraîchissement
de jeton plutôt que d'en créer de nouveaux. Un essai isolé ne doit pas signifier
une authentification parallèle.

---

## Journal de la fusion avec la refonte 2027

La branche était partie de `origin/main` et non du `main` local : il lui manquait
les cinq commits de la refonte 2027. Quatre conflits, tous résolus en gardant la
version 2027 et en y reportant les ajouts du jeu de l'oie.

- `editions/themes/2027.css` : la feuille provisoire écrite ici est abandonnée au
  profit de celle de la refonte. Elle inventait un jeu de variables `--th-*` là
  où l'édition en a déjà un, `--theatre-*`, posé sur `:root`. `OiePage.css` a été
  réécrit sur ces jetons.
- `editions/2027.ts` : version 2027 conservée, champ `enigmeOie` ajouté, et
  `EnigmeOie` déclaré dans `editions/types.ts`.
- `EnigmasPanel.tsx` et `.css` : version 2027 conservée, reroutage vers le
  plateau et badge réappliqués sur les nouveaux états d'énigme.

`editionCourante` a cédé la place à `edition`, résolu par le registre
`editions/index.ts`, et le plateau n'importe plus le thème lui-même puisque
`App.css` le charge pour toute l'application.
