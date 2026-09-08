# Import des pointages manuels (issue #12)

## Provenance

`data/episode_manual/livre-{1,2}.json` — exportés via `tools/pointage-manuel.html`
(issue #11/#36) par l'utilisateur, en visionnant directement les trous
identifiés par le pipeline (issue #10, `data/episode_resolution/livre-N.json`).
Format : `{"book": N, "manual_points": [{"episode": N, "time_s": N}, ...]}`.

Ces fichiers n'étaient auparavant que dans le dossier Téléchargements local
de l'utilisateur, jamais committés — première étape de l'issue #12 :
les mettre en sécurité dans le dépôt avant la fusion finale proprement dite.

## Validation croisée effectuée

**Livre 1** : 23 épisodes se recoupent entre le pointage manuel et les
épisodes déjà résolus par le pipeline (hors trous, juste en contrôle) —
écart constant et serré de -3 à -8s (le pointage manuel devance
légèrement le jingle détecté, cohérent avec un temps de réaction humain
face à un signal visuel/auditif vs la détection de corrélation audio pure).
Aucune anomalie : forte validation croisée des deux sources.

**Livre 2** : anomalie trouvée et résolue. Le `mention_hints` de l'épisode
93 (trou jingles 83-85) pointait vers 21123.16s, mais le pointage manuel de
l'utilisateur donnait 20922.5s — écart de 200s, très au-dessus du 1-8s
habituel. **Confirmé par l'utilisateur après revisionnage** : le streamer
reparle de l'épisode 93 juste après l'avoir lu, immédiatement avant le
jingle de l'épisode 94 — la mention captée par la transcription est ce
rappel, pas l'annonce réelle (même pattern que le rappel "épisode 6" du
Livre 1, issue #8, mais collé à l'épisode qui vient de se terminer plutôt
qu'à un épisode ancien). Le pointage manuel (20922.5s) fait foi. Documenté
comme piège connu dans `docs/qc-garde-fous-coherence.md`.

Le jingle réel de l'épisode 93 est introuvable dans les jingles détectés
par corrélation audio (raté par le pipeline) — un cas où ni la piste F
(jingle) ni la piste C (numéro parlé, faussée par le rappel) ne suffisait,
seul le pointage manuel direct a résolu ce cas.

## Couverture actuelle

- **Livre 1** : 3 trous du pipeline (issue #34), tous couverts par le
  pointage manuel (épisodes 31-39, 56, 61).
- **Livre 2** : 10 trous du pipeline, tous couverts par le pointage manuel
  (épisodes 45, 52, 55, 61, 68, 69, 80, 87, 92, 93, 97, 98, 100).
- **Livre 3** : 14 trous du pipeline, tous couverts — 24 épisodes pointés
  (10, 13, 16, 17, 20, 38, 39, 40, 45, 67-72, 75-81, 89, 100), aucun
  manquant, aucun en trop. Inclut les 4 épisodes orphelins révélés par
  l'issue #38 (68, 71, 76, 78), invisibles avant ce fix.
- **Livre 4** : 13 trous du pipeline, tous couverts — 23 épisodes pointés
  (1, 2, 3, 7-11, 18, 19, 35, 44, 48, 52, 61, 62, 70, 74, 88, 89, 94, 98,
  99), aucun manquant, aucun en trop, aucun doublon. Le livre le plus
  propre des quatre : tous les écarts avec les indices de transcription
  tiennent dans -0,9 à -3,4s, aucune anomalie.

Les 4 livres sont donc pointés : **86 épisodes** au total viennent du
pointage manuel, en complément des 327 résolus par le pipeline.

**Reste en suspens (Livre 4)** : 30 épisodes résolus par le pipeline mais
marqués `à repointer` (39, 41, 42, 55, 56, 66, 68, 71-73, 75-87, 90-93,
95-97) — leur numéro vient d'une conversion depuis la numérotation absolue
(issue #9), cohérente avec la séquence mais jamais confirmée par
visionnage. Aucun n'est couvert par le pointage manuel, qui ne portait que
sur les trous. À décider avant la fusion finale : les vérifier par
échantillonnage, ou les intégrer tels quels avec leur `confidence`
distincte.

## Correction appliquée au Livre 3 (décalage de numérotation)

Le pointage brut contenait un décalage d'un cran sur le trou 8, détecté par
recoupement : deux "débuts d'épisode" à seulement 2,9s d'écart (68 à
16219.6s et 69 à 16222.5s), ce qui est impossible pour des épisodes de 3 à
5 minutes.

Diagnostic : double appui sur la touche de pointage au début de l'épisode
68 (jingle détecté à 16223.7s), le second appui étant auto-numéroté 69 —
ce qui a décalé toute la suite. Confirmations croisées :
- le pointage "70" (16428.2s) collait à l'indice de transcription de
  l'épisode **69** (16429.5s, écart -1.3s) ;
- le jingle détecté à 16645.5s n'avait aucun pointage associé.

Correction, après vérification par visionnage (utilisateur : « épisode 70
277:25 », soit 16645s — le jingle détecté à 16645.5s) :
- suppression du pointage "69" à 16222.5s (doublon de l'épisode 68) ;
- renumérotation du pointage 16428.2s en épisode 69 ;
- ajout de l'épisode 70 à 16645.0s.

Après correction, les durées entre débuts consécutifs de la zone
(épisodes 67 à 71) sont de 232, 209, 217 et 329 secondes — cohérent avec
des épisodes de 3,5 à 5,5 minutes.

**Dédoublonnage** : trois doubles appuis bénins (épisodes 71, 76 et 78,
deux pointages à moins de 3s d'écart sur la même frontière) — on conserve
le pointage le plus précoce, arriver légèrement en avance sur un début
d'épisode valant mieux qu'en retard. 27 pointages bruts → 24 après
correction et dédoublonnage.

## Limites connues

- Pas de vérification automatique de cohérence des pointages manuels
  (doublons, hors plage) au moment de l'import — le Livre 1 contenait un
  doublon bénin pour l'épisode 21 (deux pointages à 2s d'écart, dans une
  zone déjà résolue par ailleurs, sans conséquence sur la fusion finale).
