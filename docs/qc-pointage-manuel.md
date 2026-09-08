# Outil de pointage manuel (issue #11)

## Objectif

Piste A (`docs/SPECS.md` section 3) : une passe de correction manuelle,
pas la méthode de départ — ne traiter que les **44 trous** identifiés par
le pipeline (issue #10, `data/episode_resolution/livre-N.json`) plutôt que
de repointer les ~400 épisodes à la main.

## Outil

`tools/pointage-manuel.html` — page HTML/JS autonome (aucune dépendance
sauf l'API IFrame YouTube), à ouvrir via un serveur local (le fetch des
JSON locaux échoue en `file://` à cause des restrictions CORS des
navigateurs) :

```
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/tools/pointage-manuel.html
```

## Fonctionnement

1. Sélectionner un livre (1 à 4) — charge `episode_resolution/livre-N.json`
   (les trous) et `episodes/livre-N.json` (titres/résumés Wikipedia pour
   identifier les épisodes pendant le visionnage).
2. Cliquer un trou dans le panneau de gauche : affiche les checkpoints
   encadrants (avec alerte si l'un des deux est probablement erroné, cf.
   `docs/qc-garde-fous-coherence.md`) et la fiche Wikipedia de chaque
   épisode attendu dans la plage. **Attention** : l'épisode juste avant le
   trou (`checkpoint_start`) est déjà résolu ailleurs — ce n'est jamais
   celui à pointer, l'outil l'indique explicitement pour éviter la
   confusion (rencontrée en test : voir `docs/qc-garde-fous-coherence.md`
   « piège relevé en testant l'outil »).
3. « Aller au début du trou » place la vidéo 20s avant le premier jingle
   du trou (marge de contexte). Si un indice de transcription existe pour
   un épisode attendu (mention "épisode N" trouvée sans jingle associé),
   un bouton « Aller à cet indice » saute directement 5s avant ce timestamp
   plutôt que de devoir visionner toute la fenêtre du trou.
4. Pendant la lecture, touche **M** (ou bouton) au début de chaque épisode
   repéré : capture le timestamp exact du lecteur, propose le numéro
   attendu suivant (éditable si besoin — utile quand les checkpoints
   encadrants ne sont pas fiables, cf. l'alerte du point 2).
5. Les pointages sont sauvegardés en continu dans `localStorage` (par
   livre) — pas de perte en cas de rechargement de la page ou de reprise
   dans une session ultérieure.
6. « Exporter » télécharge `livre-N-manual.json` :
   ```json
   { "book": 4, "manual_points": [{ "episode": 13, "time_s": 3456.2 }, ...] }
   ```
   destiné à être fusionné avec `episode_resolution/livre-N.json` dans les
   `episodes/livre-N.json` finaux (issue #12).

## Onglet "Tous les épisodes" (issue #36)

Deuxième onglet à côté de la liste des trous : liste 1..N complète du
livre, avec titre Wikipedia et statut de chaque épisode — confirmé,
à repointer, pointé manuellement (session en cours), ou non résolu (fait
partie d'un trou). Un bouton ▶ par épisode dont le timestamp est connu
saute directement dedans (lecteur réutilisé).

Sert à la fois de contrôle qualité continu (vérifier au fil de l'eau les
épisodes déjà résolus par le pipeline, pas seulement les trous — a permis
de retrouver, par recoupement manuel réel, que le pipeline et le pointage
humain concordent à quelques secondes près sur le Livre 1) et de prototype
de l'expérience finale du site (liste cliquable → lecture dynamique, cf.
`docs/SPECS.md` section 6).

## Limites connues

- Nécessite un serveur local (voir ci-dessus) — pas utilisable en ouvrant
  le fichier directement dans le navigateur (`file://`).
- Pas de vérification automatique de cohérence des pointages manuels
  (numéros dupliqués, hors plage, etc.) — à la charge de la relecture
  humaine avant la fusion finale (issue #12).
- Testé de bout en bout dans Chrome à plusieurs reprises (chargement,
  trous, pointage clavier, export, persistance, changement de livre,
  onglet "Tous les épisodes") au fil des sessions successives sur cet
  outil.
