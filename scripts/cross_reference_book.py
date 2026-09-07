"""Généralise le croisement jingle × numéro d'épisode (issue #8) aux 4 livres
complets (issue #9), au lieu du seul échantillon de 90 minutes du Livre 1.

Reprend la même logique de croisement (fenêtre de tolérance ±90s, numéro
attendu par la séquence préféré à la seule proximité temporelle — cf.
docs/qc-cross-reference.md) mais sur l'audio et la transcription complets de
chaque livre, avec le timestamp confirmé du premier épisode ("premier
épisode" n'est pas capturé par le motif "épisode N", cf.
docs/qc-episode-parser.md) propre à chaque livre.

Usage: python scripts/cross_reference_book.py <1|2|3|4>
"""

import argparse
from pathlib import Path

from correlate_jingle import REFERENCE_PATH, find_jingle_occurrences
from parse_episode_numbers import find_episode_mentions, parse_vtt_words

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MATCH_WINDOW_S = 90

# Timestamp confirmé par visionnage pour le premier épisode ("premier
# épisode", pas "épisode 1") de chaque livre — messages utilisateur.
CONFIRMED_EPISODE1_S = {
    1: 8 * 60 + 32,
    2: 16,
    3: 2 * 60 + 40,
    4: 9 * 60 + 26,
}

# Occurrences de jingle sous le seuil de détection (PEAK_THRESHOLD) mais
# confirmées par recoupement avec le timestamp ci-dessus (écart de quelques
# secondes, cohérent avec le pattern observé partout ailleurs) : sans ça,
# l'absence de ce premier jingle décale l'indexation séquentielle de tous
# les jingles suivants du livre d'un cran (issue #9).
# Livre 2 : score 0.46 à 20.4s (seuil 0.6), vs 0:16 annoncé — écart 4.4s.
CONFIRMED_EXTRA_JINGLES_S = {
    2: [20.4],
}


def best_mention(jingle_time, mentions, expected_number):
    """Mention la plus plausible dans MATCH_WINDOW_S.

    Un numéro proche dans le temps n'est pas toujours le bon : un épisode déjà
    passé peut être re-cité (aparté, référence rétrospective) juste avant le
    jingle suivant. Le numéro cohérent avec la séquence attendue est donc
    préféré à la seule proximité temporelle ; à défaut, on retombe sur le
    plus proche (issue #8).
    """
    candidates = [(abs(t - jingle_time), t, n) for t, n in mentions if abs(t - jingle_time) <= MATCH_WINDOW_S]
    if not candidates:
        return None
    if expected_number is not None:
        expected_candidates = [c for c in candidates if c[2] == expected_number]
        if expected_candidates:
            _, t, n = min(expected_candidates)
            return t, n
    _, t, n = min(candidates)
    return t, n


def load_mentions(book_num):
    vtt_path = DATA_DIR / "transcripts" / f"livre-{book_num}.fr.vtt"
    words = parse_vtt_words(vtt_path.read_text(encoding="utf-8"))
    mentions = find_episode_mentions(words)
    if book_num in CONFIRMED_EPISODE1_S:
        mentions = mentions + [(CONFIRMED_EPISODE1_S[book_num], 1)]
    return mentions


def cross_reference(jingle_times, mentions):
    """Renvoie (assignments, used_mention_times) — assignments[i] est le
    numéro associé au i-ème jingle, ou None."""
    assignments = []
    used_mention_times = set()
    for i, jt in enumerate(jingle_times):
        expected_number = i + 1
        match = best_mention(jt, mentions, expected_number)
        if match:
            mt, num = match
            used_mention_times.add(mt)
        else:
            mt, num = None, None
        assignments.append((jt, num, mt))
    return assignments


def run_book(book_num, reference_path=REFERENCE_PATH):
    audio_path = DATA_DIR / "audio_samples" / f"livre-{book_num}-full.wav"

    print(f"[Livre {book_num}] Détection des occurrences du jingle...")
    jingle_occurrences = find_jingle_occurrences(reference_path=reference_path, sample_path=audio_path)
    jingle_times = sorted([t for t, _ in jingle_occurrences] + CONFIRMED_EXTRA_JINGLES_S.get(book_num, []))
    print(f"  -> {len(jingle_times)} jingles détectés (dont {len(CONFIRMED_EXTRA_JINGLES_S.get(book_num, []))} confirmés manuellement sous le seuil)")

    print(f"[Livre {book_num}] Parsing des numéros d'épisode annoncés...")
    mentions = load_mentions(book_num)
    print(f"  -> {len(mentions)} mentions au total")

    assignments = cross_reference(jingle_times, mentions)

    print(f"\n[Livre {book_num}] Croisement (fenêtre de tolérance ±{MATCH_WINDOW_S}s) :\n")
    for i, (jt, num, mt) in enumerate(assignments):
        expected = i + 1
        if num is not None:
            gap = mt - jt
            flag = "" if num == expected else f"  (attendu : épisode {expected})"
            print(f"  jingle {jt/60:6.2f} min  ->  épisode {num:3d}  (numéro à {mt/60:6.2f} min, écart {gap:+5.1f}s){flag}")
        else:
            print(f"  jingle {jt/60:6.2f} min  ->  AUCUN numéro proche (à vérifier à la main, attendu : épisode {expected})")

    resolved = [num for _, num, _ in assignments if num is not None]
    print(f"\n{len(resolved)}/{len(jingle_times)} jingles associés à un numéro")

    used_mention_times = {mt for _, num, mt in assignments if num is not None}
    orphan_mentions = [(t, n) for t, n in mentions if t not in used_mention_times]
    if orphan_mentions:
        print(f"\n{len(orphan_mentions)} mentions de numéro sans jingle proche (bruit) :")
        for t, n in sorted(orphan_mentions):
            print(f"  {t/60:6.2f} min  ->  épisode {n} (isolé)")

    return assignments


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", type=int, choices=[1, 2, 3, 4], help="Numéro du livre (1-4)")
    parser.add_argument(
        "--reference",
        type=Path,
        default=REFERENCE_PATH,
        help="Extrait de référence du jingle (par défaut : celui du Livre 1, réutilisé pour tous)",
    )
    args = parser.parse_args()
    run_book(args.book, reference_path=args.reference)


if __name__ == "__main__":
    main()
