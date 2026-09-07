#!/usr/bin/env bash
# Récupère, pour le Livre 1, la transcription complète et un échantillon audio
# des 90 premières minutes — de quoi couvrir largement les 10-15 épisodes de
# l'échantillon de validation du pipeline C+F (issue #4, docs/SPECS.md section 9).
#
# Prérequis : yt-dlp, ffmpeg (brew install yt-dlp ffmpeg)
# Sorties (non commitées, gitignorées — binaires/volumineuses, régénérables) :
#   data/transcripts/livre-1.fr.vtt
#   data/audio_samples/livre-1-sample.wav
#
# Usage : ./scripts/fetch_sample_audio.sh

set -euo pipefail

VIDEO_URL="https://www.youtube.com/watch?v=REFu8UmXXE0"  # Livre 1, voir RESSOURCE.md
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$REPO_ROOT/data/transcripts" "$REPO_ROOT/data/audio_samples"

echo "Transcription complète (fichier léger, texte)..."
yt-dlp --write-auto-sub --sub-lang fr --skip-download --sub-format vtt \
  -o "$REPO_ROOT/data/transcripts/livre-1.%(ext)s" \
  "$VIDEO_URL"

echo "Échantillon audio (90 premières minutes, ~1 Go en WAV non compressé)..."
yt-dlp --download-sections "*0:00-1:30:00" -x --audio-format wav \
  -o "$REPO_ROOT/data/audio_samples/livre-1-sample.%(ext)s" \
  "$VIDEO_URL"

echo "Terminé."
