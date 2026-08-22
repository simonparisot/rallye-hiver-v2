# platform — ce qui traverse les éditions

Ce dossier rassemble les éléments dont la durée de vie n'est pas celle d'une
édition. Le reste du dépôt — l'application de jeu, son contenu, son thème — est
refondu chaque année ; ce qui est ici ne l'est pas.

La distinction n'est pas cosmétique. Elle décide de ce qu'on peut modifier
librement en préparant une édition, et de ce qu'on ne touche qu'en connaissance
de cause parce que les éditions précédentes en dépendent encore.

## Contenu

| Dossier | Rôle |
|---|---|
| `home/` | Site vitrine de rallyehiver.fr, indépendant de l'édition en cours |
| `cloudfront/` | Fonctions de périphérie — aujourd'hui la redirection de `www` |

## Ce qui a vocation à rejoindre ce dossier

- **Le pool Cognito**, une fois sorti de la stack applicative. Les participants
  conservent leur compte d'une année sur l'autre : le pool ne peut donc pas
  appartenir à une édition.
- **Le DNS et les certificats** : la zone `rallyehiver.fr` porte les archives de
  toutes les éditions, de `2012.` à `2025.`, plus `home.`, `admin.` et le
  domaine nu.
- **Les archives des éditions passées**, qui restent en ligne indéfiniment.

## Ce qui n'a pas sa place ici

Tout ce qui porte une année : contenu des énigmes, thème visuel, dates,
tarif, textes d'accueil. Ces éléments relèvent de la configuration d'édition,
même lorsqu'ils semblent stables d'une année sur l'autre.

## Déploiement

Chaque sous-dossier se déploie indépendamment, et sur son propre rythme : rien
ici ne suit le calendrier d'une édition.
