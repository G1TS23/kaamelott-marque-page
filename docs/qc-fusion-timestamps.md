# Fusion finale des timestamps (issue #12)

## Méthode

`scripts/merge_timestamps.py` complète `start_seconds`, `timestamp_source`
et `confidence` dans les 4 fichiers `data/episodes/livre-N.json`, à partir
des deux sources produites en milestone 3.

**Priorité : pipeline d'abord, pointage manuel en complément.** Le pointage
manuel ne remplace jamais un timestamp du pipeline quand les deux existent —
il ne sert qu'à combler les trous. Raison : les pointages redondants tombent
systématiquement 2 à 8s *avant* le jingle correspondant (l'humain réagit au
contexte visuel avant que le jingle ne démarre), et mélanger deux bases de
mesure dans un même livre introduirait une incohérence sans gain de
précision. Le début du jingle est par ailleurs une frontière plus
défendable que « le moment où un humain a réagi ».

## Résultat

**399 épisodes sur 399 horodatés**, aucun sans timestamp, aucun restant en
`à repointer`.

| Livre | `jingle` | `jingle_verifie` | `manuel` | Total |
|---|---|---|---|---|
| 1 | 89 | 0 | 11 | 100 |
| 2 | 86 | 0 | 14 | 100 |
| 3 | 76 | 0 | 24 | 100 |
| 4 | 46 | 30 | 23 | 99 |
| **Total** | **297** | **30** | **72** | **399** |

Les **95 pointages manuels** importés se répartissent en 72 réellement
utilisés (trous du pipeline) et 23 redondants — tous sur le Livre 1, où
l'utilisateur avait pointé au-delà des trous. Ces 23 ont servi de
validation croisée (écart constant de -3 à -8s avec le jingle
correspondant, voir `docs/qc-pointage-import.md`) sans entrer dans la
donnée finale.

## Garde-fous vérifiés

**Monotonie** — le timestamp doit croître avec le numéro d'épisode ; une
inversion signalerait un pointage ou une résolution erronée. Aucune
inversion sur les 4 livres.

Le contrôle tourne **avant l'écriture** et l'annule en cas d'inversion (le
script sort alors en code 1) : une donnée fausse n'est pas persistée dans
le fichier final, il faut corriger la source et relancer. Vérifié en
injectant une inversion volontaire — écriture bien bloquée, fichier final
inchangé, code de sortie 1. Il tourne aussi en `--dry-run`, précisément le
mode où l'on veut détecter un problème avant de toucher aux fichiers.

**Durées d'épisode implicites** — la durée d'un épisode étant l'écart
jusqu'au suivant (pas de `end_seconds`, cf. `docs/SPECS.md` section 4) :

| Livre | min | médiane | max |
|---|---|---|---|
| 1 | 175s | 224s | 419s |
| 2 | 162s | 218s | 557s |
| 3 | 161s | 228s | 524s |
| 4 | 166s | 219s | 573s |

Toutes plausibles pour des épisodes de 2-4 minutes lus avec digressions —
aucune valeur hors de l'intervalle [60s, 900s], donc aucun timestamp
manifestement aberrant.

## Limites connues

- `start_seconds` est la **position brute mesurée** : début du jingle pour
  les sources `jingle`/`jingle_verifie`, moment perçu par l'utilisateur
  pour `manuel`. Les deux bases diffèrent de 2 à 8s. Un saut vers un
  épisode devrait appliquer une petite avance (~3-5s) au moment de la
  lecture plutôt que de la figer dans la donnée.
- La précision n'a jamais été mesurée contre une vérité terrain
  indépendante : les deux sources se valident mutuellement (écarts de
  quelques secondes, cf. `docs/qc-pointage-import.md`) mais rien ne garantit
  qu'elles ne soient pas décalées *ensemble* de quelques secondes par
  rapport au vrai début d'épisode.
- Le script est ré-exécutable sans effet de bord (il réécrit les trois
  champs à partir des sources), mais il **écrase** toute correction faite à
  la main directement dans `data/episodes/livre-N.json` — une correction
  doit passer par `data/episode_manual/` pour survivre à une ré-exécution.
