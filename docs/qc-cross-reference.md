# Croisement jingle × numéro d'épisode (issue #8)

## Méthode

`scripts/cross_reference_pipeline.py` croise les 21 occurrences du jingle
(issue #5/#6) avec les mentions "épisode N" parsées dans la transcription
(issue #7), sur l'échantillon de 90 minutes (issue #4).

Pour chaque jingle, on cherche la mention la plus plausible dans une fenêtre
de tolérance de ±90s (le plus grand écart jingle↔numéro observé
manuellement, épisode 10, ~64s, avec marge). Les jingles étant attendus dans
l'ordre strict des épisodes (jingle d'indice *i* → épisode *i+1*), ce numéro
« attendu » sert à départager les cas ambigus : une mention correspondant au
numéro attendu est préférée à une mention simplement plus proche en temps.
Sans cette règle, une mention de rappel (un numéro déjà passé, cité par
aparté) peut être plus proche en valeur absolue que la vraie nouvelle
annonce et fausser le résultat — voir bug ci-dessous.

## Résultat

**17 jingles sur 21 associés correctement** à un numéro d'épisode
séquentiel (1 à 12, 15, 16, 19, 20), avec des écarts jingle↔numéro très
serrés (majoritairement 1,2 à 4,0s), confirmant la fiabilité du pipeline
C+F sur cet échantillon.

**4 jingles sans numéro associé** (épisodes attendus 13, 14, 17, 18,
correspondant aux jingles à 57.76, 61.29, 74.23 et 77.83 min) — voir
analyse ci-dessous, ce n'est pas un défaut du croisement lui-même.

## Bug trouvé et corrigé : mauvais choix par proximité pure

Avant correction, le dernier jingle (88.71 min) était associé à « épisode
6 » (mention à 88.42 min, écart -17.5s) plutôt qu'à « épisode 21 » (mention
à 88.34 min, écart -22.5s) — pourtant la bonne réponse d'après la séquence
attendue. La mention « épisode 6 » est en réalité un rappel/une référence
à un événement passé pendant la lecture (déjà signalé comme suspect en
issue #7, `docs/qc-episode-parser.md`), qui se trouve être *plus proche en
temps absolu* de ce jingle que la vraie annonce de l'épisode 21.

Le simple critère « mention la plus proche dans le temps »
(`closest_mention`) ne suffit donc pas. Corrigé en préférant, dans la
fenêtre de tolérance, la mention correspondant au numéro attendu par la
séquence (`best_mention`), avec repli sur la plus proche seulement si aucune
mention ne porte ce numéro. Après correction, les 21 jingles s'associent
tous soit au bon numéro séquentiel, soit à aucun numéro (pas de faux
positif).

## Mentions doublons proches en apparence contradictoires

Certaines mentions quasi simultanées du même numéro peuvent sembler
« utilisées et orphelines à la fois » à l'affichage arrondi à la minute
(ex. deux mentions d'« épisode 9 » affichées toutes deux `40.92 min`). Ce
n'est pas un bug : ce sont deux timestamps réels distincts, à quelques
millisecondes d'écart (2455.069s et 2455.079s — vraisemblablement le même
mot détecté deux fois par l'ASR), qui arrondissent à la même valeur
affichée. Un seul est effectivement apparié au jingle ; l'autre reste, à
raison, listé comme mention isolée (bruit ASR, pas une nouvelle annonce).

## Épisodes 13, 14, 17, 18 : absence confirmée, pas un problème de fenêtre

Vérification sur l'intégralité de la transcription (6h31, pas seulement
l'échantillon de 90 min) : **aucune mention "épisode 13/14/17/18" n'existe
nulle part dans tout le texte reconnu**, pas seulement hors de la fenêtre de
tolérance. Ce n'est donc pas un problème de croisement ou de fenêtre trop
étroite, mais une limite déjà documentée du parseur de numéros (issue #7,
`docs/qc-episode-parser.md`) : seuls 70 numéros distincts sur 100 attendus
sont retrouvés par le motif `épisode\s+(\d+)` sur l'ensemble du Livre 1,
vraisemblablement à cause d'annonces mal reconnues par l'ASR ou formulées
différemment (ex. « treize » mal transcrit, ou tournure sans le mot
« épisode »).

Sur l'échantillon, ces 4 jingles restent donc détectés (piste F fiable)
mais sans confirmation par la piste C — exactement le cas que le pipeline
C+F doit signaler comme « à vérifier à la main » plutôt que masquer.

## Conclusion sur la fiabilité du pipeline C+F

- Le jingle (piste F) est fiable à 100 % sur l'échantillon : 21/21
  occurrences détectées, rythme cohérent (déjà validé en issue #5/#6).
- Le numéro parlé (piste C) confirme 17/21 jingles avec un écart de
  quelques secondes, ce qui valide la cohérence des deux signaux quand la
  piste C est disponible.
- Les 4 échecs de la piste C sont dus à des limites déjà connues de l'ASR
  sur la piste C, pas à un défaut du croisement ou du jingle : dans ces
  cas, le jingle seul reste le signal de vérité et l'absence de numéro
  parlé associé doit être traitée comme un signal « à vérifier à la main »,
  pas une anomalie du pipeline.
- Généralisation aux 4 livres (issue #9) : s'attendre au même taux
  d'échec ponctuel de la piste C, sans remettre en cause la piste F.

## Limites connues

- Validé sur le Livre 1 (échantillon 90 min) uniquement — à refaire sur les
  4 livres en issue #9.
- La fenêtre de tolérance (±90s) et la préférence par numéro attendu sont
  calibrées sur ce seul échantillon ; à revérifier si le rythme des livres
  suivants diffère significativement.
