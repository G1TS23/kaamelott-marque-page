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
3. **Retirer les checkpoints isolés parasites** (issue #34) : si un
   checkpoint n'est cohérent NI avec son voisin de gauche NI avec son
   voisin de droite, mais que la paire élargie (en le sautant) l'est, il
   s'agit très probablement d'une mention parasite (rappel, aparté) qui
   coupe artificiellement un segment par ailleurs cohérent en deux faux
   trous — on le retire, il redevient un point interpolé ordinaire du
   segment large.
4. **Valider chaque paire de checkpoints consécutifs** : si l'écart de
   jingles entre les deux correspond exactement à l'écart de numéros, le
   segment est cohérent → numéroter par simple incrément. Sinon, marquer
   tout le segment (bornes incluses) à vérifier à la main — on ne sait pas
   dire laquelle des deux bornes est fautive, donc les deux sont remises en
   cause plutôt que de faire un choix arbitraire.

## Résultat global

| Livre | Jingles | Checkpoints candidats | Résolus | dont à repointer | Trous |
|---|---|---|---|---|---|
| 1 | 97 | 67 | 89 (92 %) | 0 | 3 |
| 2 | 91 | 64 | 86 (95 %) | 0 | 10 |
| 3 | 86 | 77 | 76 (88 %) | 0 | 14 |
| 4 | 85 | 72 | 76 (89 %) | 30 | 13 |
| **Total** | **359** | 280 | **327 (91 %)** | 30 | 40 |

Amélioration nette par rapport au matching simple (issue #9, 282/359 = 79 %)
sur les Livres 1-3 : l'interpolation entre checkpoints valides résout
davantage d'épisodes qu'une confirmation ponctuelle par mention (ex. Livre 2 :
64 confirmations directes → 86 épisodes résolus par interpolation).

Le Livre 4 (72 checkpoints candidats, dont 57 convertis depuis l'absolu)
passe de 53/85 (62 %, sans conversion) à **76/85 (89 %)** grâce à la
conversion absolu→relatif — dont 30 marqués "à repointer" (checkpoint
converti, à confirmer par visionnage même si la séquence est cohérente).
Sans la conversion, ces épisodes auraient été silencieusement classés
comme des trous alors que le signal existait, juste dans le mauvais
référentiel.

Note : la confiance d'un épisode résolu dépend uniquement de la source de
*sa propre* mention (relative ou convertie), jamais de celle d'un épisode
voisin — un bug de première version faisait dépendre la confiance d'un
checkpoint partagé entre deux segments de l'ordre de traitement plutôt que
d'une propriété stable de ce checkpoint (corrigé, voir historique de
commits ; 7 épisodes initialement comptés "à repointer" à tort, 37 → 30).

## Validation : redécouvre seule le bug de l'issue #8

Sans aucune heuristique "numéro attendu", l'algorithme isolait tout seul
l'exact problème déjà identifié et corrigé à la main en issue #8 (jingle à
88.71 min du Livre 1, faussement rapproché de la mention de rappel
"épisode 6") :

```
jingles 20-24 (5), 88.71-104.76 min (checkpoints épisode 6 puis épisode 25,
  3 jingle(s) intermédiaire(s) pour 18 épisode(s) attendu(s))
```

L'écart négatif/incohérent (6 avant 25) déclenche naturellement le
signalement, sans préférence codée en dur pour un numéro plutôt qu'un
autre — une validation de plus que l'approche par checkpoints est plus
robuste que le matching ponctuel.

**Mise à jour (issue #34)** : ce trou (et son voisin 19-20) n'existe plus
depuis le retrait des checkpoints isolés parasites — la mention "épisode 6"
est maintenant ignorée d'emblée puisque le segment élargi (jingle 19,
épisode 20 confirmé → jingle 24, épisode 25 confirmé, écart de 5 des deux
côtés) est directement cohérent. Détails dans la section suivante.

## Fix : checkpoints isolés parasites (issue #34)

Trouvé en testant l'outil de pointage manuel (issue #11) sur le Livre 1 :
retour utilisateur signalant que les trous 1+2 et 4+5 semblaient être des
doublons (plages de temps qui se touchent).

En creusant : les ancres réellement confirmées de part et d'autre de
chaque paire s'accordaient déjà parfaitement (20↔25 avec un écart de 5 des
deux côtés ; 44↔48 avec un écart de 4 des deux côtés). Le seul problème
était qu'un unique jingle au milieu (20, puis 43) avait lui-même un
checkpoint parasite ("6", puis "50") qui coupait chaque segment par
ailleurs cohérent en deux faux trous, au lieu de laisser passer la paire
élargie.

Fix : avant de construire les segments, repérer les checkpoints incohérents
avec leurs DEUX voisins mais dont la paire élargie (en les sautant) est
cohérente, et les retirer — le jingle correspondant redevient un point
interpolé ordinaire du segment large. Résultat sur le Livre 1 : 7 trous → 3,
82/97 → 89/97 résolus. Aucun changement sur les Livres 2-3 (aucune
occurrence de ce pattern chez eux) ni sur le Livre 4 (dominé par le
problème distinct de la numérotation absolue, cf. section suivante).

## Les trous identifiés

Chaque trou est borné par les deux checkpoints qui l'encadrent (numéro
d'épisode de part et d'autre) quand ils existent, avec le nombre de jingles
disponibles contre le nombre d'épisodes attendu — l'information nécessaire
pour l'outil de pointage manuel (issue #11) sans avoir à retraiter tout le
livre.

**Piège relevé en testant l'outil #11** : le checkpoint de *début* d'un trou
(`checkpoint_start`) est l'épisode juste **avant** le trou — déjà résolu
ailleurs, pas celui à pointer. En sautant au début du trou, la première
chose visible/entendue est cet épisode déjà connu ; il faut continuer à
regarder au-delà pour trouver le vrai épisode manquant
(`checkpoint_start + 1`). Deux fois signalé comme "faux" en pratique
(Livre 2, trous 1 et 2) alors que les données étaient correctes — l'outil
#11 affiche maintenant un avertissement explicite pour éviter la confusion.

**Fix : checkpoint orphelin absent du résolu ET des trous (issue #38)**.
Trouvé en testant le pointage manuel du Livre 3 : un checkpoint dont NI la
paire de gauche NI la paire de droite n'est cohérente (cas différent de
l'issue #34, où la paire élargie était cohérente) n'est jamais ajouté à
`resolved`. Mais la plage "attendu" de chaque trou voisin excluait quand
même son propre numéro (en supposant, à tort dans ce cas, qu'il était déjà
résolu ailleurs) — le numéro disparaissait silencieusement, jamais confirmé
ni jamais proposé au pointage manuel. Touchait plusieurs épisodes sur 3 des
4 livres (Livre 2 : 99 ; Livre 3 : 68, 71, 76, 78 ; Livre 4 : 1, 99).

Fix : `expected_episode_range()` vérifie si le checkpoint de bordure est
*effectivement* dans `resolved` avant de l'exclure de la plage — sinon,
son propre numéro y est inclus. Exporté dans le JSON via
`expected_first_episode`/`expected_last_episode` (bornes incluses),
utilisées à la fois par `mention_hints` et par l'outil de pointage manuel
(qui affiche désormais un avertissement différent selon que le checkpoint
voisin est réellement confirmé ou non).

**`mention_hints`** : pour chaque trou, les mentions "épisode N" trouvées
dans la transcription (piste C) pour un numéro attendu dans la plage du
trou, même sans jingle associé — un jingle a pu être manqué par la
corrélation audio alors que le numéro, lui, a bien été annoncé. Donne un
timestamp précis où chercher plutôt que de visionner toute la fenêtre en
aveugle (vérifié : Livre 2 trou 1, "épisode 45" trouvé à 169.73 min sans
jingle correspondant — exactement l'épisode manquant attendu).

Liste complète par livre : sortie de
`python scripts/resolve_episode_numbers.py <1|2|3|4>`.

## Avant/après conversion absolu→relatif (Livre 4)

La grande zone d'alternance absolu/relatif confirmée par visionnage en
issue #9 (jingles 59 à 80, 22 jingles sans checkpoint plausible avant
conversion) :

```
jingles 59-80 (22), 270.43-364.73 min (checkpoints épisode 69 puis épisode 93,
  20 jingle(s) intermédiaire(s) pour 23 épisode(s) attendu(s))
```

devient, une fois les numéros absolus reconnus et convertis, une succession
de segments résolus (certains "confirmé" quand la mention est déjà
relative, d'autres "à repointer" quand elle vient d'une conversion)
entrecoupés de trous beaucoup plus petits et précis :

```
jingle 270.43 min  ->  épisode  69
jingle 277.11 min  ->  épisode  71  [à repointer : checkpoint issu d'une numérotation absolue]
jingle 280.95 min  ->  épisode  72  [à repointer : checkpoint issu d'une numérotation absolue]
...
  jingles 59-60 (2), 270.43-277.11 min (checkpoints épisode 69 puis épisode 71,
    0 jingle(s) intermédiaire(s) pour 1 épisode(s) attendu(s))
```

## Limites connues

- Le numéro affiché aux bornes d'un trou incohérent peut lui-même être
  erroné — l'algorithme ne tranche pas laquelle des deux bornes est
  fautive, il indique juste qu'elles ne sont pas mutuellement cohérentes.
  À vérifier à la main dans tous les cas (issue #11).
- Le retrait des checkpoints isolés (issue #34) ne traite qu'**un seul**
  checkpoint parasite entouré de deux ancres cohérentes entre elles — deux
  checkpoints parasites consécutifs (ou plus) ne seraient pas détectés par
  ce mécanisme et continueraient à produire un trou signalé, pas de cas de
  ce type rencontré dans les 4 livres à ce jour.
- Un trou sans checkpoint d'un côté (avant le premier ou après le dernier
  du livre) ne peut pas être validé par recoupement — signalé quand même,
  mais avec moins d'information (pas de numéro de référence de ce côté).
- Un même jingle peut apparaître à la fois comme épisode résolu ET comme
  borne d'un trou : une ancre est validée indépendamment avec chacun de
  ses deux voisins, donc elle peut être confirmée d'un côté tout en étant
  la borne d'un trou de l'autre côté (parce que l'autre couple, lui, est
  incohérent) — pas contradictoire, sa valeur dans `resolved` reste la
  référence pour cette ancre précise, le trou ne remet en cause que les
  jingles strictement entre les deux bornes.
- Le filtre de plausibilité écarte les numéros ni dans 1..N ni dans la
  plage absolue attendue, et convertit ces derniers — mais il ne protège
  pas contre une mention plausible-mais-fausse à l'intérieur d'une de ces
  deux plages (ex. un rappel "épisode 12" cité pendant l'épisode 15, si 12
  reste dans 1..100) — seule la vérification de cohérence de séquence
  protège contre ce cas, pas le filtre de plausibilité seul.
- La conversion absolu→relatif suppose que le cumul des épisodes des
  livres précédents (Wikipedia) correspond exactement à la numérotation
  absolue utilisée par le streamer — vérifié par recoupement pour un point
  du Livre 4 (339 − 300 = 39, cohérent avec la position réelle dans la
  vidéo), mais pas garanti si un livre suivant s'avérait compter les
  épisodes différemment.
