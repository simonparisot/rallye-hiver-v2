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
| `themes/2026.css`, `themes/2027.css` | Une feuille de style par thème, qui ne définit que des variables CSS. |
| `index.ts` | Choisit l'édition servie par le build, et applique son thème au chargement. |

## Comment ça marche

**Une constante, lue partout.** `index.ts` exporte `edition`, l'édition active.
Les composants qui affichent quelque chose de propre à l'année (mise en page,
panneaux d'information, liste des intrigues, plateau du jeu de l'oie, espace
admin) l'importent et lisent `edition.label`, `edition.copy.intro`,
`edition.theme.logo`, etc. Aucun composant ne compare l'année : il lit un champ.

**Les deux feuilles doivent déclarer les mêmes noms.** Les composants lisent
ces variables sans valeur de repli : une variable indéfinie n'est pas ignorée,
elle invalide toute la déclaration qui la contient, et la bordure ou l'ombre
disparaît sans erreur en console. C'est le piège principal de ce mécanisme.
Quand une refonte introduit un nom (`--ombre-affiche`, `--lambrequin-image`,
`--barre-fond`…), il faut le déclarer aussi dans les thèmes des éditions
passées, sans quoi leur build archive se dégrade en silence.

**Le thème passe par un attribut et des variables.** Au démarrage,
`applyEditionTheme()` (appelée dans `src/index.tsx`) pose
`data-edition="<clé>"` sur `<html>` et injecte la balise des polices Google de
l'édition. Chaque feuille `themes/<année>.css` définit ses variables sous
`:root[data-edition='<année>']`. Les composants n'utilisent que ces variables
(`--theatre-comedie`, `--theatre-salle`, `--font-display`...), jamais de couleur
ni de police en dur : c'est ce qui permet à une fonctionnalité nouvelle de
suivre le thème sans le connaître.

Le thème de l'édition courante est aussi posé sur `:root` sans attribut, pour
qu'il s'applique avant que le script ait tourné et éviter un flash au
chargement. Quand on change d'édition par défaut, il faut déplacer ce `:root`
d'une feuille à l'autre.

**Un build ne contient qu'une édition active.** `edition` vaut
`EDITIONS[process.env.REACT_APP_EDITION]`, avec l'édition la plus récente par
défaut. La variable est lue à la compilation, pas à l'exécution : un site
déployé sert une édition et une seule.

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
   une ombre sans rien signaler. Pour vérifier, comparer les noms déclarés par
   les feuilles de thème à ceux employés en `var(--x)` dans `src/**/*.css`.
4. Déplacer le `:root,` nu de `themes/2027.css` vers `themes/2028.css`.
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
