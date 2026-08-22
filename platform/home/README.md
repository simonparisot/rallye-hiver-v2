# home — site global du Rallye d'Hiver

Site vitrine de `rallyehiver.fr`, **indépendant de l'édition annuelle**. Il présente le Rallye,
oriente vers l'inscription à l'édition à venir, archive les éditions passées et donne le contact.

Le contenu et l'habillage reprennent le site précédent (`rallyehome/home-v2022` de
`github.com/simonparisot/rallye-hiver`) : photo hivernale voilée, Abril Fatface, jaune
`#fff000`, pas de menu ni de pied de page, la navigation se fait par les boutons. Cette
identité est intemporelle et ne suit pas `DESIGNSYSTEM.md`, qui décrit le thème d'une
édition donnée.

Une note pour plus tard : ne pas remettre `-webkit-font-smoothing: antialiased` sur `body`.
Sur macOS cette propriété remplace le lissage sous-pixel par du lissage en niveaux de gris et
amincit visiblement tout le texte, ce qui casse le rendu historique.

## Pas de build

Du HTML et une feuille de style, servis tels quels. Pas de framework, pas de `npm install`,
pas de `node_modules`, pas d'étape de compilation. Le seul JavaScript de la page est… aucun.

Le reste du repo (`backend/`, `frontend/`) tourne sur React et TypeScript parce qu'il a de
l'état, de l'authentification et des appels API. Ce site-ci n'a rien de tout ça.

```bash
# travailler dessus
open index.html          # ou n'importe quel serveur statique : python3 -m http.server

# publier
./deploy.sh              # sync vers s3://rallye-hiver-home, profil AWS « perso »
```

## Structure

```
index.html        accueil : présentation et les trois boutons
editions.html     archive 1997 → 2026
contact.html      adresse de l'équipe
style.css         feuille de style unique
img/background.jpg  photo de fond
img/editions/     vignettes des éditions (<année>.jpg, default.jpg pour les autres)
deploy.sh         publication S3
```

Les liens portent le suffixe `.html` : aucune réécriture d'URL à configurer, le site marche
sur n'importe quel hébergement statique, y compris en ouvrant les fichiers en local.

## Mise à jour annuelle

1. **`index.html`** — le bouton d'inscription. Entre deux éditions c'est un
   `<span class="btn btn-disabled">` dont l'attribut `data-hover` fournit le texte de
   l'infobulle au survol ; un commentaire HTML juste au-dessus donne la ligne à mettre à la
   place le jour où les inscriptions ouvrent.
2. **`editions.html`** — ajouter en tête de `.editions` un bloc pour l'édition écoulée. Copier
   le bloc voisin : `<a class="edition" href="…">` si son site reste en ligne,
   `<div class="edition edition-offline">` sinon.
3. Vignette optionnelle : déposer `img/editions/<année>.jpg` (carrée, ~240 px) et pointer
   dessus. Sans fichier, laisser `img/editions/default.jpg`.

## Adresse de contact

Elle n'est pas écrite en clair dans le HTML : la règle `.e-mail::before` de `style.css` la
compose en séquences d'échappement CSS, comme le faisait le site précédent, pour limiter le
glanage automatique. Conséquence assumée : elle s'affiche mais n'est pas cliquable.

## Déploiement

Bucket S3 `rallye-hiver-home` derrière CloudFront. Rien de particulier à configurer : chaque
URL correspond à un fichier réel, donc pas besoin de la réponse d'erreur 404 → `/index.html`
qu'exige `frontend/`. `deploy.sh` repasse les `.html` en `no-cache` après le sync, pour que la
mise à jour annuelle soit visible tout de suite.
