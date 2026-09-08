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
- **Livres 3-4** : pointage manuel pas encore effectué.

## Limites connues

- Pas de vérification automatique de cohérence des pointages manuels
  (doublons, hors plage) au moment de l'import — le Livre 1 contenait un
  doublon bénin pour l'épisode 21 (deux pointages à 2s d'écart, dans une
  zone déjà résolue par ailleurs, sans conséquence sur la fusion finale).
