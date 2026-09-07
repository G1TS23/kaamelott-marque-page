#!/usr/bin/env bash
# Récupère, pour un livre donné, la transcription complète et l'audio complet
# de la vidéo (contrairement à fetch_sample_audio.sh qui ne couvrait que les
# 90 premières minutes du Livre 1 pour la validation initiale, issue #4) —
# nécessaire pour généraliser le pipeline C+F aux 4 vidéos complètes (issue #9).
#
# L'audio est extrait directement en mono 4 kHz (résolution suffisante pour
# la corrélation du jingle, cf. TARGET_SR dans correlate_jingle.py) : garde
# des fichiers de quelques centaines de Mo au lieu de plusieurs Go en WAV à
# la fréquence d'origine, sur des vidéos de 6h30+.
#
# Prérequis : yt-dlp, ffmpeg (brew install yt-dlp ffmpeg)
# Sorties (non commitées, gitignorées — binaires/volumineuses, régénérables) :
#   data/transcripts/livre-N.fr.vtt
#   data/audio_samples/livre-N-full.wav
#
# Usage : ./scripts/fetch_full_audio.sh <N> <video_url>
#   ex.  ./scripts/fetch_full_audio.sh 2 "https://www.youtube.com/watch?v=x1RgHE0rg1M"

set -euo pipefail

BOOK_NUM="${1:?Usage: fetch_full_audio.sh <N> <video_url>}"
VIDEO_URL="${2:?Usage: fetch_full_audio.sh <N> <video_url>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$REPO_ROOT/data/transcripts" "$REPO_ROOT/data/audio_samples"

echo "[Livre $BOOK_NUM] Transcription complète (fichier léger, texte)..."
yt-dlp --write-auto-sub --sub-lang fr --skip-download --sub-format vtt \
  -o "$REPO_ROOT/data/transcripts/livre-$BOOK_NUM.%(ext)s" \
  "$VIDEO_URL"

echo "[Livre $BOOK_NUM] Audio complet (mono 4 kHz, ~30 Mo/heure)..."
yt-dlp -x --audio-format wav --postprocessor-args "ffmpeg:-ar 4000 -ac 1" \
  -o "$REPO_ROOT/data/audio_samples/livre-$BOOK_NUM-full.%(ext)s" \
  "$VIDEO_URL"

echo "[Livre $BOOK_NUM] Terminé."
