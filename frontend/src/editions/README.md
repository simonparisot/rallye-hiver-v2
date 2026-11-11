# Éditions et thèmes

Le Rallye d'Hiver change de thème chaque année. Ce dossier contient tout ce qui
appartient à une édition et rien d'autre : l'habillage, le calendrier, les
textes. Le contenu des intrigues vit en base ; le code des composants ne connaît
aucune édition en particulier.

Jusqu'à l'édition 2026, ces éléments étaient écrits en dur dans les composants.
Ils ont été extraits le 23 août 2026, au moment de préparer 2027, pour que
l'ajout d'une édition ne demande plus de toucher au cœur de l'application.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `types.ts` | Le contrat `Edition` : ce qu'une édition doit déclarer. Chaque champ y est commenté. |
| `2026.ts`, `2027.ts` | Une instance par édition : identifiant de jeu, année, thème, dates, textes. |
| `vocabulaire.ts` | Le vocabulaire neutre du jeu (énigme, parcours, équipe, aide) et les aides `accorder()`, `majuscule()`. |
| `2027-neutre.ts` | L'habillage neutre de 2027 : thème, textes et titre du jeu de l'oie qui ne trahissent pas le thème secret. |
| `themes/2026.css`, `themes/2027.css`, `themes/2027-neutre.css` | Une feuille de style par thème ou habillage, qui ne définit que des variables CSS. |
| `index.ts` | Choisit l'édition servie par le build, gère la bascule entre thème officiel et habillage neutre, applique le thème affiché. |

## Comment ça marche

**Un hook pour ce qui se voit, une constante pour le jeu.** Les composants qui
affichent quelque chose de propre à l'année (logo, textes, titre) lisent
l'édition *affichée* avec `useEdition()`, qui se redessine quand on bascule de
thème (voir plus bas). Ce qui relève du jeu (`gameId`, dates, `enigmeOie` pour
la route du plateau) se lit sur la constante `edition`, ou sur
`editionOfficielle`. Aucun composant ne compare l'année : il lit un champ.

**Les deux feuilles doivent déclarer les mêmes noms.** Les composants lisent
ces variables sans valeur de repli : une variable indéfinie n'est pas ignorée,
elle invalide toute la déclaration qui la contient, et la bordure ou l'ombre
disparaît sans erreur en console. C'est le piège principal de ce mécanisme.
Quand une refonte introduit un nom (`--ombre-affiche`, `--lambrequin-image`,
`--barre-fond`…), il faut le déclarer aussi dans les thèmes des éditions
passées, sans quoi leur build archive se dégrade en silence.

**Le thème passe par un attribut et des variables.** Au démarrage,
`applyEditionTheme()` (appelée dans `src/index.tsx`) pose
`data-edition="<clé>"` sur `<html>` et injecte la balise des polices Google du
thème affiché ; elle est rappelée à chaque bascule. Chaque feuille `themes/<année>.css` définit ses variables sous
`:root[data-edition='<année>']`. Les composants n'utilisent que ces variables
(`--theatre-comedie`, `--theatre-salle`, `--font-display`...), jamais de couleur
ni de police en dur : c'est ce qui permet à une fonctionnalité nouvelle de
suivre le thème sans le connaître.

Le thème affiché par défaut est aussi posé sur `:root` sans attribut, pour
qu'il s'applique avant que le script ait tourné et éviter un flash au
chargement. Pour 2027, c'est l'habillage neutre (`themes/2027-neutre.css`) qui
le porte, et non le thème officiel : un flash du thème officiel suffirait à le
trahir. Quand on change d'édition par défaut, il faut déplacer ce `:root`
d'une feuille à l'autre.

**Un build ne contient qu'une édition active.** `edition` vaut
`EDITIONS[process.env.REACT_APP_EDITION]`, avec l'édition la plus récente par
défaut. La variable est lue à la compilation, pas à l'exécution : un site
déployé sert une édition et une seule.

## Habillage neutre et bascule à chaud

Le thème de 2027 (« Le théâtre ») est secret jusqu'au lancement du 21 décembre
2026, et le reste pour une équipe qui ne l'a pas débloqué. Le même build
contient donc deux habillages :

- l'**habillage neutre** (`2027-neutre.ts`, `themes/2027-neutre.css`,
  clé `2027-neutre`), affiché par défaut partout, page d'accueil et
  administration comprises : même structure d'affiche que le thème officiel,
  sans rouge, sans lambrequin, sans masques (monogramme `public/logo-rallye.svg`),
  avec des polices neutres et des textes qui ne disent rien du thème ;
- le **thème officiel** (`2027.ts`, `themes/2027.css`, clé `2027`).

Une édition déclare son habillage neutre dans le champ `habillageNeutre` :
thème, textes, titre du jeu de l'oie. Le reste (identifiant de jeu, dates,
route du plateau) est commun aux deux. Une édition sans ce champ s'affiche
toujours sous son thème officiel (c'est le cas de 2026).

**L'API, dans `index.ts` :**

| | |
|---|---|
| `useEdition()` | Hook : l'édition affichée. Le composant se redessine à la bascule. |
| `useThemeOfficiel()` | Hook : le thème officiel est-il affiché ? |
| `setThemeOfficiel(bool)` | Bascule à chaud : attribut, polices, titre, puis les abonnés se redessinent. |
| `editionAffichee()` | Même chose que le hook, hors de React. |
| `editionOfficielle` | L'édition avec son thème officiel, quoi qu'il arrive. |
| `edition` | Constante historique : le jeu est celui de l'édition, mais `theme` et `copy` suivent l'habillage affiché, pour qu'un composant non migré ne montre jamais le logo officiel. |

Il n'y a pas de fournisseur de contexte : l'état vit dans le module et
`useSyncExternalStore` s'y abonne. `App` s'abonne à `useEdition()`, ce qui
redessine tout l'arbre à la bascule, y compris les composants qui lisent
encore `edition`.

**La règle de déblocage** (tâches 6 et 15) est décidée par le serveur :
`themeOfficiel` de `GET /game/status` vaut vrai une fois le jeu lancé, ou,
avant, pour une équipe qui a résolu une énigme préliminaire. Le frontend
l'applique par `setThemeOfficiel()` : au chargement et à chaque relecture du
statut (`SynchroStatutJeu`, dans `services/statutJeu.ts`, monté dans `App`),
juste après la bonne réponse à une préliminaire (`EnigmasPanel`), et avec
`false` à la déconnexion avant le lancement (`AuthContext`). Le dernier verdict
est mémorisé (`localStorage`, clé `rallye-theme-officiel`) pour que le
chargement suivant parte du bon habillage, et l'écran attend la réponse du
statut avant de rien afficher : ni flash du thème officiel pour qui n'y a pas
droit, ni flash de l'habillage neutre pour qui l'a débloqué.

**L'interrupteur provisoire.** `?theme=officiel` dans l'URL
affiche le thème officiel pour la session de l'onglet (`sessionStorage`), et
`?theme=neutre` revient à l'habillage neutre. Il n'est protégé par rien :
quiconque connaît le paramètre voit le thème. **Il est à retirer avant le
lancement du 21 décembre 2026** (décision de Simon : on le garde d'ici là pour
les aperçus). Depuis que la règle existe, la réponse du serveur l'écrase dès
qu'elle arrive : il ne tient plus qu'en l'absence de réponse.

**Le vocabulaire suit l'habillage.** Les mots du jeu trahissent le thème
autant que les couleurs : en 2027, on résout des *intrigues*, on fait des
*tournées*, on joue en *troupe*. Chaque édition et chaque habillage déclarent
donc un `vocabulaire` (type `Vocabulaire`) :

| Clé | Thème officiel 2027 | Neutre (et 2026) |
|---|---|---|
| `enigme` | intrigue | énigme |
| `parcours` | tournée | parcours |
| `equipe` | troupe | équipe |
| `souffleur` | souffleur | aide |
| `monEquipe` | Ma troupe | Mon équipe |

On ne substitue jamais un mot dans une phrase figée : « une tournée » est
féminin, « un parcours » masculin et invariable au pluriel. Chaque nom (`Nom`)
expose ses formes en entier (`singulier`, `pluriel`, `Singulier`, `Pluriel`,
`un`, `ce`, `le`, `du`, `les`, `dePluriel`) et son genre ; les accords passent
par `accorder(nom, féminin, masculin)` :

```tsx
const v = useEdition().vocabulaire;
<div>{v.parcours.pluriel} {accorder(v.parcours, 'réalisées', 'réalisés')}</div>
// « tournées réalisées » / « parcours réalisés »
```

Hors de React (messages d'erreur), `editionAffichee().vocabulaire`.

`node scripts/verifier-vocabulaire.mjs` échoue si un mot du thème (intrigue,
tournée, troupe, souffleur, théâtre, rideau, scène…) est écrit en dur dans un
texte visible du site principal. Il ignore les commentaires, les attributs
invisibles (`className`, `data-testid`…) et les identifiants, et exclut
`src/oie/` (inaccessible avant le lancement), `src/admin/` (réservé aux
organisateurs, qui gardent le vocabulaire du théâtre) et `src/editions/`.
Aucun autre fichier n'en est exclu.
`npm run verifier-editions` lance les deux contrôles.

**Ce que l'habillage neutre ne cache pas.** Le build contient les deux
habillages : le texte « Le théâtre », le chemin `/logo-2027.jpg` (servi
publiquement depuis `public/`) et les illustrations du jeu de l'oie sont
lisibles par qui inspecte le JavaScript ou devine l'URL. L'habillage neutre
protège de la lecture du site, pas de son code source. C'est un secret visuel, choisi comme tel : il suffit tant que personne ne va
lire le code.

**Le piège des variables, en double.** L'habillage neutre est une feuille de
thème comme les autres : il doit déclarer exactement les mêmes variables que
`themes/2027.css`. Toute variable ajoutée au thème officiel doit l'être aussi
à l'habillage neutre (et à 2026), sans quoi elle disparaît en silence sous
l'habillage affiché par défaut — c'est-à-dire pour presque tout le monde. Le
contrôle :

```
node scripts/verifier-variables-theme.mjs
```

compare les variables déclarées par chaque feuille de `themes/` à celles
employées en `var(--x)` (sans valeur de repli) dans `src/**/*.css` et dans les
styles inline des composants, et sort en erreur s'il en manque une.

## Reconstruire une édition passée

`2026.rallyehiver.fr` continue de servir l'édition 2026 indéfiniment. Pour la
redéployer à l'identique, il faut compiler avec la variable :

```
REACT_APP_EDITION=2026 npm run build
```

Sans elle, le build produit l'édition courante, et l'archive prendrait le thème
de l'année. Le script `scripts/deploy-frontend.sh` ne passe pas cette variable
aujourd'hui : elle est à ajouter le jour où l'archive doit être redéployée.

## Les fonctionnalités propres à une édition

Le champ optionnel `enigmeOie` est le modèle à suivre pour un essai limité à une
année : c'est le seul point d'entrée du jeu de l'oie dans l'application. Une
édition qui ne le déclare pas n'a ni la route `/oie`, ni l'entrée
d'administration, ni le lien depuis la liste des intrigues, et n'importe rien de
`src/oie/`. Retirer le champ suffit à faire disparaître la fonctionnalité ; la
conserver dans une édition suivante suffit à la reconduire.

À l'inverse, ce qui a vocation à durer (les indices, par exemple) vit dans le
cœur de l'application et ne passe pas par ce dossier.

## Ajouter l'édition 2028

1. Créer `2028.ts` en copiant `2027.ts` : `gameId`, `year`, `label`, dates,
   textes, clé de thème `'2028'`, polices, logo.
2. Déposer le logo dans `public/` (les logos précédents y restent, chacun sert
   à son édition).
3. Créer `themes/2028.css` sous `:root[data-edition='2028']`, en définissant les
   mêmes variables que les thèmes précédents. Le plus sûr est de partir de
   `themes/2027.css` et de ne changer que les valeurs : les composants attendent
   ces noms-là, et une seule variable oubliée fait disparaître une bordure ou
   une ombre sans rien signaler. Pour vérifier :
   `node scripts/verifier-variables-theme.mjs`. Si le thème de 2028 doit
   rester secret, lui donner aussi un habillage neutre (`habillageNeutre`).
4. Déplacer le `:root,` nu de `themes/2027-neutre.css` vers la feuille
   affichée par défaut en 2028 (son habillage neutre s'il en a un).
5. Importer la feuille et enregistrer l'édition dans `index.ts` : une entrée
   dans `EDITIONS`, et `edition2028` comme valeur par défaut.
6. Régénérer les captures de référence des tests visuels
   (`tests/e2e/visual.spec.ts-snapshots/`), qui portent le thème.

Rien d'autre à toucher : ni les composants, ni le backend, qui ne connaît
l'édition que par `gameId` et par la stack déployée.

## Ce que ce dossier ne couvre pas

- Le backend n'a pas d'équivalent : l'édition y passe par `gameId` et par la
  stack déployée (voir `backend/README.md`).
- Le site vitrine (`platform/home/`) est du HTML statique, avec son propre
  style.
- La direction artistique elle-même (pourquoi ces couleurs, ces polices) est
  documentée dans l'en-tête de chaque feuille `themes/<année>.css`. Le document
  `DESIGNSYSTEM.md` à la racine, qui décrivait la direction bande dessinée de
  2026, a été retiré au profit de ces en-têtes ; son contenu reste dans
  l'historique git.
