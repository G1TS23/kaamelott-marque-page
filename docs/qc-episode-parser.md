# Parseur du numéro d'épisode (issue #7)

## Méthode

Les sous-titres auto-générés YouTube sont au format « roulant » : chaque cue
réaffiche le texte précédent + un mot, avec un timestamp par mot dans des
balises `<HH:MM:SS.mmm><c>...</c>`. Dédupliqué en indexant par (timestamp,
mot) dans un dict — la même paire réapparaît à l'identique d'une cue à
l'autre, l'insérer plusieurs fois est sans effet. 91 397 mots horodatés
uniques extraits de la transcription du Livre 1 (contre 92 992 lignes de
fichier VTT brut, très redondant).

Recherche ensuite du motif `épisode\s+(\d+)` dans le texte reconstruit,
avec retour au timestamp du mot correspondant.

## Résultat

**128 mentions trouvées** sur les 90 premières minutes. Les timestamps des
premières mentions collent de très près à ceux du jingle trouvés en issue #5
(écart de quelques secondes) :

| Épisode | Jingle (issue #5) | Numéro annoncé | Écart |
|---|---|---|---|
| 2 | 12.41 min | 12.36 min | ~3s |
| 3 | 15.60 min | 15.57 min | ~2s |
| 4 | 20.36 min | 20.30 min | ~4s |
| 5 | 24.34 min | 24.29 min | ~3s |
| 6 | 28.56 min | 28.49 min | ~4s |
| 7 | 32.62 min | 32.58 min | ~2s |
| 8 | 36.73 min | 36.71 min | ~1s |
| 9 | 40.98 min | 40.87 min | ~7s |

Confirme empiriquement que les deux signaux (jingle audio + numéro parlé)
marquent bien le même événement, à quelques secondes près — exactement ce
que le pipeline C+F suppose.

## Mentions parasites (attendu, à filtrer en issue #8)

Certains numéros sont mentionnés plusieurs fois ou sans jingle associé :
- « épisode 9 » cité 4 fois avant 3 minutes, alors que l'épisode 1 ne
  commence qu'à 4:07 — clairement un aparté/une anecdote en introduction,
  pas le vrai début de l'épisode 9
- « épisode 6 » réapparaît à 88:23, juste après la mention réelle de
  l'épisode 21 — probablement une référence à un événement passé pendant
  la lecture, pas une nouvelle occurrence

Le croisement avec les timestamps de jingle (issue #8) doit permettre de
filtrer ces mentions isolées (pas de jingle proche) des vraies annonces de
début d'épisode.

## Limite connue

Testé sur 90 minutes (Livre 1 uniquement) — à généraliser aux 4 livres en
issue #9. Le parseur lui-même (`scripts/parse_episode_numbers.py`) accepte
n'importe quel fichier VTT en argument, déjà prêt pour ça.
