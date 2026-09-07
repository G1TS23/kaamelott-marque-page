# Garde-fous de cohérence : résolution du numéro d'épisode (issue #10)

## Méthode

`scripts/resolve_episode_numbers.py` remplace l'heuristique "numéro attendu
par position" (issue #8/#9, fragile dès qu'un jingle est manqué n'importe
où dans le livre — cf. `docs/qc-generalisation-4-livres.md`) par un
algorithme en trois étapes :

1. **Filtrer les mentions par plausibilité** : un numéro est retenu s'il
   est soit dans la plage relative du livre (1 à N, N = nombre d'épisodes
   Wikipedia), soit dans la plage absolue de la série complète à ce point
   (cumul des livres précédents + 1..N) — auquel cas il est **converti**
   en numéro relatif (numéro absolu − cumul des précédents). La provenance
   (relatif/absolu converti) est conservée : un checkpoint issu d'une
   conversion reste marqué **"à repointer"** même s'il passe la
   vérification de cohérence à l'étape 3, car le Livre 4 alterne les deux
   formats sans règle prévisible (issue #9) — une conversion cohérente
   reste une hypothèse forte, pas une certitude équivalente à une mention
   relative directe.
2. **Un candidat par jingle** (le plus proche en temps parmi les mentions
   plausibles) comme checkpoint potentiel — pas de tri par "attendu" à ce
   stade, les faux checkpoints sont éliminés à l'étape suivante.
3. **Valider chaque paire de checkpoints consécutifs** : si l'écart de
   jingles entre les deux correspond exactement à l'écart de numéros, le
   segment est cohérent → numéroter par simple incrément. Sinon, marquer
   tout le segment (bornes incluses) à vérifier à la main — on ne sait pas
   dire laquelle des deux bornes est fautive, donc les deux sont remises en
   cause plutôt que de faire un choix arbitraire.

## Résultat global

| Livre | Jingles | Checkpoints candidats | Résolus | dont à repointer | Trous |
|---|---|---|---|---|---|
| 1 | 97 | 69 | 82 (85 %) | 0 | 7 |
| 2 | 91 | 64 | 86 (95 %) | 0 | 10 |
| 3 | 86 | 77 | 76 (88 %) | 0 | 14 |
| 4 | 85 | 72 | 76 (89 %) | 37 | 13 |
| **Total** | **359** | 282 | **320 (89 %)** | 37 | 44 |

Amélioration nette par rapport au matching simple (issue #9, 282/359 = 79 %)
sur les Livres 1-3 : l'interpolation entre checkpoints valides résout
davantage d'épisodes qu'une confirmation ponctuelle par mention (ex. Livre 2 :
64 confirmations directes → 86 épisodes résolus par interpolation).

Le Livre 4 (72 checkpoints candidats, dont 57 convertis depuis l'absolu)
passe de 53/85 (62 %, sans conversion) à **76/85 (89 %)** grâce à la
conversion absolu→relatif — dont 37 marqués "à repointer" (checkpoint
converti, à confirmer par visionnage même si la séquence est cohérente).
Sans la conversion, ces 37 épisodes auraient été silencieusement classés
comme des trous alors que le signal existait, juste dans le mauvais
référentiel.

## Validation : redécouvre seule le bug de l'issue #8

Sans aucune heuristique "numéro attendu", l'algorithme isole tout seul
l'exact problème déjà identifié et corrigé à la main en issue #8 (jingle à
88.71 min du Livre 1, faussement rapproché de la mention de rappel
"épisode 6") :

```
jingles 20-24 (5), 88.71-104.76 min (entre épisode 6 et épisode 25, ...)
```

L'écart négatif/incohérent (6 avant 25) déclenche naturellement le
signalement, sans préférence codée en dur pour un numéro plutôt qu'un
autre — une validation de plus que l'approche par checkpoints est plus
robuste que le matching ponctuel.

## Les trous identifiés

Chaque trou est borné par les deux checkpoints qui l'encadrent (numéro
d'épisode de part et d'autre) quand ils existent, avec le nombre de jingles
disponibles contre le nombre d'épisodes attendu — l'information nécessaire
pour l'outil de pointage manuel (issue #11) sans avoir à retraiter tout le
livre.

Liste complète par livre : sortie de
`python scripts/resolve_episode_numbers.py <1|2|3|4>`.

## Avant/après conversion absolu→relatif (Livre 4)

La grande zone d'alternance absolu/relatif confirmée par visionnage en
issue #9 (jingles 59 à 80, 22 jingles sans checkpoint plausible avant
conversion) :

```
jingles 59-80 (22), 270.43-364.73 min (entre épisode 69 et épisode 93,
  21 jingle(s) intermédiaire(s) pour 23 épisode(s) attendu(s))
```

devient, une fois les numéros absolus reconnus et convertis, une succession
de petits segments résolus (marqués "à repointer") entrecoupés de trous
beaucoup plus petits et précis :

```
jingle 270.43 min  ->  épisode  69  [à repointer : checkpoint issu d'une numérotation absolue]
  jingles 59-60 (2), 270.43-277.11 min (entre épisode 69 et épisode 71, ...)
jingle 277.11 min  ->  épisode  71  [à repointer : ...]
jingle 280.95 min  ->  épisode  72  [à repointer : ...]
...
```

## Limites connues

- Le numéro affiché aux bornes d'un trou incohérent (ex. "épisode 6"
  ci-dessus) peut lui-même être erroné — l'algorithme ne tranche pas
  laquelle des deux bornes est fautive, il indique juste qu'elles ne sont
  pas mutuellement cohérentes. À vérifier à la main dans tous les cas
  (issue #11).
- Un trou sans checkpoint d'un côté (avant le premier ou après le dernier
  du livre) ne peut pas être validé par recoupement — signalé quand même,
  mais avec moins d'information (pas de numéro de référence de ce côté).
- Le filtre de plausibilité (1..N) élimine les numéros absolus mais pas une
  éventuelle mention plausible-mais-fausse à l'intérieur de la plage
  normale (ex. un rappel "épisode 12" cité pendant l'épisode 15, si 12 reste
  dans 1..100) — seule la vérification de cohérence de séquence protège
  contre ce cas, pas le filtre de plausibilité seul.
