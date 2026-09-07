# Échantillon pipeline C+F — Livre 1 (issue #4)

Première étape de validation du pipeline avant généralisation (docs/SPECS.md section 3 et 9) : récupérer de quoi tester la détection sur un échantillon avant d'investir dans l'outillage complet.

## Récupéré

- `scripts/fetch_sample_audio.sh` — script reproductible (yt-dlp)
- Transcription complète du Livre 1 (`data/transcripts/livre-1.fr.vtt`, non commitée — format très redondant, à nettoyer en issue #7)
- Échantillon audio des 90 premières minutes (`data/audio_samples/livre-1-sample.wav`, non commité — ~1 Go, régénérable)

## Validation préliminaire de la piste C

Recherche du motif « épisode N » dans la transcription complète : **59 occurrences trouvées**, avec des correspondances temporelles cohérentes (ex. « l'épisode 10 » vers 00:45, « Épisode 12 » vers 00:54 — ~4-5 min/épisode, plausible). Confirme empiriquement que Shisheyu annonce bien le numéro à voix haute de façon détectable dans la transcription automatique.

Parsing complet et rigoureux (extraction de tous les numéros, dédoublonnage du format VTT redondant) laissé à l'issue #7.

## Suite

- Issue #5 : isoler un extrait de référence du jingle de trompette dans `livre-1-sample.wav`
- Issue #6 : script de détection du jingle par corrélation
- Issue #7 : parseur du numéro d'épisode (texte nettoyé depuis le VTT brut)
- Issue #8 : croiser les deux et mesurer la fiabilité sur l'échantillon
