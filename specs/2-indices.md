# Projet 2 : récupération d'indices par les équipes

**Environnement cible :** test.rallyehiver.fr
**Statut :** spécification rédigée
**Enjeu :** si l'essai est concluant, la fonctionnalité est conservée pour toutes
les éditions suivantes et devient un rouage permanent du Rallye d'Hiver.

---

## Ce qui existe déjà (vérifié le 12 septembre 2026)

**Attention : ce n'est pas un terrain vierge.** Une fonctionnalité d'indices a
été livrée le 25 janvier 2026 (commit `cbbac4c`) et elle est câblée dans
l'interface joueur actuelle, y compris après la refonte 2027.

Ce qu'elle fait aujourd'hui :

- L'administrateur dépose un **PDF d'indice** optionnel, un par énigme.
- Le joueur voit un bouton « Avoir un indice » si l'énigme en a un.
- Au premier usage, une modale avertit d'un **coût de 25 % des points**.
  Aux usages suivants, l'indice s'affiche directement, sans modale.
- Statistiques d'usage dans l'espace admin, à `/admin/hints`.
- Deux endpoints : `POST /hints/{enigmaId}/use` et `GET /admin/hints/usage`.
- Un champ `hintUsed` par énigme côté équipe.

Fichiers concernés : `backend/src/functions/hints/useHint.ts`,
`backend/src/functions/admin/hints/usage.ts`,
`frontend/src/components/panels/EnigmasPanel.tsx`,
`frontend/src/admin/pages/AdminHintUsage.tsx`.

Il existe aussi une branche `origin/feature/indices`. C'est, d'après la mémoire
projet, **la branche réellement déployée** à un moment, pas `main`. À vérifier
avant de partir de l'un ou de l'autre.

---

## Ce qu'on garde, ce qu'on change

notre nouvelle fonctionnalité d'indices remplacerait entièrement l'actuel si ça fonctionne bien.


## Le principe

Chaque équipe peut demander un indice quand il veut. On le prévient que ça coutera des points.
Tout d'abord, l'équipe doit renseigner dans un champ libre où elle en est sur la résolution de l'énigme. Ce qu'elle a potentiellement testé, trouvé, les blocages, les idées, etc.
ceci est envoyé au backend où tourne un LLM qui a accès à :
- l'énigme en question
- la solution complète de l'énigme, mot de passe + détail de comment il faut la résoudre (incluant les potentielles fausses pistes cachées)
- un ensemble pré-écrit d'indices qui peut être donné en réponse à l'équipe.

Le principe est que le LLM compare l'avancement de l'équipe à la résolution de l'énigme qu'il connait, et en déduit l'indice le plus adapté à donner à l'équipe pour la faire avancer. L'indice doit être utile (donc ne pas donner quelque chose que l'équipe a déjà trouvé) mais pas trop avancé (si l'équipe n'en est qu'au début, ne pas donner l'indice de la toute fin qui permet de conclure l'énigme). Le LLM ne peut pas répondre librement à l'équipe pour éviter que l'équipe essaie de faire du prompt hacking et de "soutirer" la résolution au LLM.

Les indices sont juste constitués de texte.


## Ce que voit l'équipe

Juste un champ texte libre qui l'invite à donner le plus de détail possible sur son avancement. une ou deux alertes sur le fait que ça va couter des points. et l'indice.

## Points génériques

Si ça fonctionne, il s'agit d'une fonctionnalité perenne. seuls les énigmes, résolutions et listes d'indices changeront chaque année.

je te donnerai quelques exemples d'énigmes, résolutions et listes d'indices pour tester. 
