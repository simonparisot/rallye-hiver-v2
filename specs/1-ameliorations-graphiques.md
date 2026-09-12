# Projet 1 : améliorations graphiques

**Environnement cible :** test.rallyehiver.fr
**Statut :** spécification à rédiger

---

## Ce qui existe déjà (vérifié le 12 septembre 2026)

Une première passe de refonte a été faite le 23 août 2026, sur le thème du
théâtre, dérivé du logo « les deux masques » retenu par les organisateurs.
Elle tient en 5 commits, **non poussés** sur `origin/main` :

| Commit | Apport |
|---|---|
| `44d063e` | Couche `editions/` : thème par `data-edition`, polices Abril Fatface + Source Sans 3, logo 2027 |
| `f876f27` | Navigation par sections, à la place des panneaux dépliants |
| `e0fd30f` | Palette adoucie, ordre de lecture d'une énigme revu |
| `30178d9` | Abril Fatface réellement appliquée aux titres |
| `fa57a62` | Résultat de tentative en fenêtre modale, tableau de bord refondu (barres de progression, compteur) |

Deux documents d'exploration en dehors du repo, dans `~/localwork/rallye-hiver/` :
`rallye-2027-direction-visuelle.html` (la note « Les Deux Masques ») et
`rallye-2027-maquettes/` (trois pistes : affiche, programme, loge).

Quatre questions y sont explicitement laissées en suspens :

1. Le vocabulaire : garde-t-on « énigmes » et « parcours », ou passe-t-on aux « actes » et « tableaux » ?
2. Le fond de salle : illustration de rideau, de fauteuils, ou velours texturé ?
3. Un mode sombre pour le jeu, à peser contre la lecture des énoncés en PDF.
4. Les vignettes des vingt énigmes : PDF tels quels, ou gabarit commun ?

---

## Ce qui ne va pas dans le draft

<!-- Ce qui te gêne aujourd'hui quand tu regardes test.rallyehiver.fr.
     Écran par écran si possible. Sois brutal, c'est le plus utile. -->


## Ce qu'on cherche à obtenir

<!-- L'effet visé. Une référence, une impression, un mot d'ordre. -->


## Périmètre

<!-- Quels écrans sont concernés : accueil, tableau de bord, énigmes,
     parcours, classement, espace admin ? Lesquels sont hors sujet ? -->


## Les quatre questions ouvertes

<!-- Tes réponses, ou « à trancher plus tard ». -->

1. Vocabulaire :
2. Fond de salle :
3. Mode sombre :
4. Vignettes des énigmes :


## Contraintes

<!-- Ce à quoi on ne touche pas. Mobile ? Accessibilité ? Performances ?
     Les captures de référence des tests visuels devront être regénérées. -->


## Critères d'acceptation

<!-- À quoi on saura que c'est fini. -->


## Hors périmètre

<!-- Ce qu'on ne fait pas dans ce projet, pour éviter la dérive. -->


---

## Questions

- Le ménage prévu dans `MENAGE.md` (~1 100 lignes d'ancienne navigation par
  routes, devenue morte avec la refonte) entre-t-il dans ce projet, ou reste-t-il
  un chantier à part ?
- Les 5 commits non poussés : on pousse avant de repartir, ou on continue en local ?
