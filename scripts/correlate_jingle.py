"""Vérifie qu'un extrait de référence (data/reference_clips/jingle_candidate.wav)
se répète bien dans l'échantillon audio à un rythme cohérent avec un jingle de
début d'épisode (~3-5 min d'écart) — corrélation directe du signal (normalisée),
pas juste une similarité spectrale (issue #5, prépare la piste F de l'issue #6).

Usage: python scripts/correlate_jingle.py
"""

from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SAMPLE_PATH = DATA_DIR / "audio_samples" / "livre-1-sample.wav"
REFERENCE_PATH = DATA_DIR / "reference_clips" / "jingle_livre1.wav"

TARGET_SR = 4000  # suffisant pour repérer la forme d'onde d'un jingle, rapide
PEAK_THRESHOLD = 0.6  # score de corrélation normalisée (1.0 = identique)
MIN_PEAK_DISTANCE_S = 30  # deux détections à moins de 30s = même occurrence


def load_mono(path, target_sr):
    y, sr = sf.read(path)
    if y.ndim > 1:
        y = y.mean(axis=1)
    if sr != target_sr:
        y = resample_poly(y, target_sr, sr)
    return y.astype(np.float32)


def main():
    print("Chargement du candidat et de l'échantillon...")
    template = load_mono(REFERENCE_PATH, TARGET_SR)
    signal = load_mono(SAMPLE_PATH, TARGET_SR)
    print(f"  template: {len(template)/TARGET_SR:.1f}s, échantillon: {len(signal)/TARGET_SR/60:.1f} min")

    template = template - template.mean()
    template_norm = np.linalg.norm(template)

    # corrélation croisée normalisée par fenêtre glissante via FFT :
    # corr(t) / (||template|| * ||signal[t:t+len(template)]||)
    correlation = fftconvolve(signal, template[::-1], mode="valid")

    window_sq = fftconvolve(signal ** 2, np.ones(len(template)), mode="valid")
    window_norm = np.sqrt(np.maximum(window_sq, 0))  # bruit flottant peut rendre une somme nulle légèrement négative
    # une fenêtre quasi silencieuse ne peut pas légitimement ressembler au
    # template (non silencieux) : diviser par un window_norm proche de zéro ne
    # ferait qu'amplifier du bruit en un score aberrant (>1.0 observé), donc on
    # l'exclut plutôt que de le calculer
    silent = window_norm < (template_norm * 0.05)
    score = np.zeros_like(correlation)
    score[~silent] = correlation[~silent] / (template_norm * window_norm[~silent])

    peak_distance_samples = int(MIN_PEAK_DISTANCE_S * TARGET_SR)
    candidates = np.where(score > PEAK_THRESHOLD)[0]
    print(f"\n{len(candidates)} points au-dessus du seuil {PEAK_THRESHOLD}, regroupement en pics...")

    peaks = []
    i = 0
    while i < len(candidates):
        j = i
        while j + 1 < len(candidates) and candidates[j + 1] - candidates[j] < peak_distance_samples:
            j += 1
        cluster = candidates[i:j + 1]
        best = cluster[np.argmax(score[cluster])]
        peaks.append(best)
        i = j + 1

    times = sorted(p / TARGET_SR for p in peaks)
    print(f"\n{len(times)} occurrences détectées :")
    for t in times:
        print(f"  {t/60:6.2f} min (t={t:7.1f}s) score={score[int(t*TARGET_SR)]:.3f}")

    if len(times) > 1:
        gaps = [round(b - a, 1) for a, b in zip(times, times[1:])]
        print(f"\nÉcarts entre occurrences (s) : {gaps}")
        print(f"Écarts en minutes : {[round(g/60, 2) for g in gaps]}")
        print(f"Écart moyen : {sum(gaps)/len(gaps)/60:.2f} min")


if __name__ == "__main__":
    main()
