# Extrait de référence du jingle (issue #5)

## Méthode

Une première tentative de détection aveugle par similarité spectrale (recherche
du motif le plus fréquent dans le spectrogramme) n'a pas donné de résultat
exploitable : elle repérait surtout des passages de silence/calme qui se
ressemblent tous entre eux, ou un motif dont les écarts entre occurrences
n'avaient aucune régularité compatible avec un rythme d'un jingle par épisode
(de 8s à plusieurs minutes, sans cohérence).

Un point d'ancrage réel (fourni manuellement : Livre 1, 12:25) a permis
d'extraire un candidat précis et de le valider par **corrélation croisée
normalisée du signal brut** (`scripts/correlate_jingle.py`), bien plus fiable
qu'une similarité spectrale pour repérer un extrait audio réutilisé à
l'identique.

## Extrait retenu

`data/reference_clips/jingle_livre1.wav` — 3,2s, extrait à partir de 744,8s
(12:24,8) dans `data/audio_samples/livre-1-sample.wav`. Correspond à un
segment au ton soutenu, nettement distinct des pics de parole environnants.

## Validation

Corrélation de cet extrait contre les 90 minutes d'échantillon : **21
occurrences détectées**, toutes avec un score de corrélation entre 0,77 et
1,00 (1,00 = position d'origine du template lui-même).

Écarts entre occurrences : 3,18 à 5,99 minutes, **moyenne 4,01 min** —
cohérent avec le rythme attendu d'un jingle en début de chaque épisode
(épisodes originaux de 3-4 min, plus les digressions du streamer).

Un bug de normalisation initial produisait des scores aberrants (>1.0,
jusqu'à 45) sur des passages quasi silencieux (division par une norme proche
de zéro) — corrigé en excluant ces fenêtres du calcul plutôt que de risquer
une division instable.

## Limites

- Validé sur 90 minutes (1 livre, échantillon), pas sur les 4 livres complets — à refaire en généralisation (issue #9)
- Un seul extrait de référence pour l'instant ; si le jingle a plusieurs variantes (durée, mixage) selon les livres, il faudra le revérifier lors de la généralisation
- Score exact à 1.000 uniquement à la position d'origine — les autres occurrences varient (0,77-0,99) selon le mixage/la compression, ce qui est normal pour une corrélation sur signal réel
