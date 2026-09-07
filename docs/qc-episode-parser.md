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

**128 mentions trouvées sur la vidéo complète** (6h31, transcription non
limitée contrairement à l'échantillon audio qui ne couvre que les 90
premières minutes — voir issue #4). Sur ces 128 mentions, **70 numéros
distincts identifiés sur les 100 attendus** pour le Livre 1 — 30 manquants
(ex. 13, 14, 17, 18, 22-24...), probablement des annonces mal transcrites
par l'ASR ou formulées différemment. Le motif `épisode\s+(\d+)` seul ne
suffit donc pas à couvrir 100 % des cas ; le taux réel de couverture du
pipeline C+F dépendra aussi du jingle (qui, lui, ne dépend pas de la
qualité de l'ASR).

Sur les 90 premières minutes (seule portion où l'audio est disponible pour
comparer), les timestamps des premières mentions collent de très près à
ceux du jingle trouvés en issue #5 (écart de quelques secondes) :

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

## Cas particulier : « premier épisode »

Pour le tout premier épisode d'un livre, Shisheyu dit parfois « premier
épisode » plutôt que « épisode 1 » (remarqué en visionnant la vidéo) — le
motif `épisode\s+(\d+)` ne peut pas le capturer. Plusieurs mentions de
« premier épisode » trouvées entre 8:15 et 12:00 dans le Livre 1, mais elles
ressemblent à du bavardage d'introduction (« Allez, premier épisode. Bon, je
vais... », « ça c'est un épisode... premier épisode. Il reste 4h11 ») plutôt
qu'à l'annonce du vrai début de lecture — impossible à trancher avec
certitude sans un repère temporel humain (timestamp confirmé par visionnage)
pour chaque livre. Non résolu dans cette issue, à traiter avec les timestamps
de première épisode fournis pour chacun des 4 livres.

## Limites connues

- Testé sur le Livre 1 uniquement — à généraliser aux 4 livres en issue #9. Le
  parseur lui-même (`scripts/parse_episode_numbers.py`) accepte n'importe quel
  fichier VTT en argument, déjà prêt pour ça.
- 30 % des numéros (30/100) non retrouvés par le motif `épisode\s+(\d+)` sur
  la transcription complète — à corroborer avec le jingle en généralisation :
  un jingle détecté sans numéro associé signale un épisode à vérifier à la main.
- Cross-validation avec le jingle seulement possible sur les 90 premières
  minutes (limite de l'échantillon audio, pas du parseur lui-même).
