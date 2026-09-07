# Généralisation du pipeline C+F aux 4 livres complets (issue #9)

## Méthode

Reprend le pipeline validé en milestone 2 (issue #4 à #8) sur les 4 vidéos
**complètes** (6h18 à 6h37 chacune), au lieu du seul échantillon de 90
minutes du Livre 1 :

- `scripts/fetch_full_audio.sh <N> <url>` télécharge la transcription
  complète + l'audio complet, extrait directement en mono 4 kHz (au lieu du
  WAV non compressé à la fréquence d'origine) pour garder des fichiers de
  taille raisonnable (~180 Mo/livre au lieu de plusieurs Go) sur des vidéos
  6 à 7 fois plus longues que l'échantillon initial.
- `scripts/cross_reference_book.py <N>` généralise `cross_reference_pipeline.py`
  (issue #8) à un livre quelconque, avec le timestamp confirmé du premier
  épisode propre à chaque livre (messages utilisateur : Livre 1 8:32, Livre 2
  0:16, Livre 3 2:40, Livre 4 9:26).

## Résultat global

| Livre | Jingles détectés | Numéros confirmés | Taux |
|---|---|---|---|
| 1 | 97 | 69 | 71 % |
| 2 | 91 (dont 1 confirmé manuellement) | 64 | 70 % |
| 3 | 86 | 77 | 90 % |
| 4 | 85 | 72 | 85 % |
| **Total** | **359** | **282** | **79 %** |

Le jingle (piste F) reste fiable sur toute la durée des 4 vidéos avec la
**même référence** extraite du Livre 1 (`data/reference_clips/jingle_livre1.wav`),
sans avoir besoin d'un extrait par livre — l'hypothèse posée en issue #5
(« si le jingle a plusieurs variantes selon les livres, il faudra le
revérifier ») est donc globalement confirmée fausse : c'est le même clip
partout, avec des scores de corrélation qui varient un peu (mixage propre à
chaque enregistrement) mais restent largement au-dessus du bruit.

## Bug/cas trouvé : jingle sous le seuil de détection (Livre 2)

Le tout premier jingle du Livre 2 (épisode 1, timestamp confirmé 0:16) a un
score de corrélation de seulement **0,46**, sous le seuil `PEAK_THRESHOLD`
(0,6) — largement en dessous de la moyenne du livre (0,91). Sans lui, tous
les jingles suivants du livre se décalent d'un cran dans l'indexation
séquentielle (jingle d'indice *i* → épisode *i+1*), ce qui aurait faussé
silencieusement tous les numéros attendus pour le reste du livre.

Confirmé par recoupement avec le timestamp utilisateur (écart de 4,4s,
cohérent avec le pattern observé partout ailleurs — cf. `docs/qc-episode-parser.md`)
et injecté manuellement dans `CONFIRMED_EXTRA_JINGLES_S` de
`cross_reference_book.py`, comme pour le cas du "premier épisode" côté
transcription. Une fois injecté, la séquence se réaligne parfaitement (le
jingle suivant colle exactement au numéro attendu, sans repli nécessaire).

**Pas de cas équivalent sur les Livres 1, 3, 4** : leurs premiers jingles ont
tous un score fort (0,80 à 0,98), cohérent avec les timestamps confirmés,
sans intervention nécessaire.

## Découverte majeure : numérotation absolue vs relative au livre (Livre 4)

À partir d'environ 153 min dans le Livre 4, les numéros d'épisode annoncés
sautent à des valeurs à 3 chiffres (339, 341, 356... jusqu'à 399) au lieu de
continuer la séquence relative au livre. Vérifié dans le texte brut de la
transcription — ce n'est pas un bug de parsing, le mot est bien
« Épisode 339. » prononcé deux fois de suite (même structure que les autres
débuts d'épisode : « Épisode 339. [grognement] ... C'est parti. Épisode 339. »).

**Confirmé par visionnage** (l'utilisateur a vérifié le passage) : à partir de
ce point, le streamer annonce parfois le numéro **absolu de l'épisode dans
la série complète** (en cumulant les livres précédents) plutôt que le numéro
relatif au Livre 4, puis **repasse par moments à la numérotation relative**
plus loin dans la vidéo — le changement n'est pas un point de bascule unique
et définitif, mais une alternance imprévisible entre les deux conventions.

Recoupement numérique : Livres 1+2+3 totalisent exactement 300 épisodes
(100+100+100, `data/episodes/livre-{1,2,3}.json`). 339 − 300 = 39, ce qui
correspond bien à la position réelle dans le Livre 4 à ce moment de la
vidéo (~40 % du livre) — confirme précisément l'hypothèse de numérotation
absolue à cet endroit précis.

### Conséquence pour le pipeline

Puisque l'alternance absolu/relatif n'est ni prévisible ni détectable par un
simple seuil ou une formule fixe (ex. "soustraire 300 si > 200" casserait
les passages où le streamer revient au relatif), le **numéro parlé (piste C)
ne peut plus être traité comme une source fiable d'identité d'épisode** à
partir de ce point du Livre 4 — il reste seulement un signal de confiance
:
- si le numéro trouvé correspond au numéro attendu (position séquentielle
  du jingle) → confirmation forte, comme partout ailleurs ;
- si le numéro ne correspond pas → **ambigu** (peut être une mention
  manquée normale comme documenté en issue #7/#8, ou un changement de
  convention comme ici) : ne doit pas être utilisé tel quel pour identifier
  l'épisode, seulement signaler un cas à vérifier à la main.

Le jingle (piste F), lui, reste fiable sur toute la vidéo indépendamment de
ce problème de numérotation — c'est donc **l'ordre séquentiel des jingles
qui doit rester la source de vérité pour l'identité/l'ordre des épisodes**
dans le modèle de données final, la piste C ne servant que de
confirmation d'appoint quand elle colle à l'attendu.

## Limites connues

- **Jingles manqués par l'audio lui-même** (pas seulement la piste C) : le
  Livre 1 complet a 100 épisodes réels mais seulement 97 jingles détectés —
  au moins 3 occurrences manquées par la corrélation (score sous le seuil
  ou fusionné avec un pic voisin), indépendamment des limites du parseur de
  numéros. Le seuil `PEAK_THRESHOLD=0.6` est un compromis : plus bas, il
  capte plus de vrais jingles faibles mais risque plus de faux positifs
  (cf. tentatives de détection aveugle documentées en issue #5).
- **Numérotation absolue vs relative (Livre 4)** : aucune règle automatique
  fiable identifiée ; nécessite une vérification manuelle par tronçon si le
  site doit un jour afficher/utiliser le numéro annoncé tel quel pour ce
  livre. Les 3 autres livres n'ont pas montré ce comportement.
- Taux de confirmation par piste C variable selon le livre (70 à 90 %) —
  pas d'explication trouvée à l'écart Livre 1/2 (70 %) vs Livre 3/4
  (85-90 %), possiblement lié au style de présentation qui évolue avec le
  temps (le streamer annonce peut-être plus systématiquement le numéro dans
  les livres plus récents).
