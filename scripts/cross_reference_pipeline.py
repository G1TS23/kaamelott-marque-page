"""Croise les timestamps du jingle (issue #5/#6) et les numéros d'épisode
annoncés dans la transcription (issue #7) sur l'échantillon de 90 minutes, et
mesure la fiabilité du pipeline C+F avant généralisation (issue #9).

Pour chaque jingle détecté, on cherche le numéro annoncé le plus proche dans
une fenêtre de tolérance. Un jingle sans numéro proche, ou une séquence non
continue, signale un épisode à vérifier à la main (docs/SPECS.md section 3).

Usage: python scripts/cross_reference_pipeline.py
"""

from pathlib import Path

from correlate_jingle import find_jingle_occurrences
from parse_episode_numbers import DEFAULT_VTT, find_episode_mentions, parse_vtt_words

# fenêtre de tolérance : le plus grand écart jingle<->numéro observé
# manuellement (épisode 10, ~64s) sert de référence, avec marge
MATCH_WINDOW_S = 90

# "premier épisode" (épisode 1) n'est pas capturé par le motif "épisode N" du
# parseur — timestamp confirmé par visionnage (voir docs/qc-episode-parser.md)
CONFIRMED_EXTRA_MENTIONS = [(8 * 60 + 32.0, 1)]

SAMPLE_DURATION_S = 90 * 60  # limite de l'échantillon audio (issue #4)


def best_mention(jingle_time, mentions, expected_number):
    """Mention la plus plausible dans MATCH_WINDOW_S.

    Un numéro proche dans le temps n'est pas toujours le bon : un épisode déjà
    passé peut être re-cité (aparté, référence rétrospective) juste avant le
    jingle suivant. Le numéro cohérent avec la séquence attendue (dernier
    assigné + 1) est donc préféré à la seule proximité temporelle ; à défaut,
    on retombe sur le plus proche.
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


def main():
    print("Détection des occurrences du jingle...")
    jingle_occurrences = find_jingle_occurrences()
    jingle_times = [t for t, _ in jingle_occurrences]
    print(f"  -> {len(jingle_times)} jingles détectés")

    print("Parsing des numéros d'épisode annoncés...")
    words = parse_vtt_words(Path(DEFAULT_VTT).read_text(encoding="utf-8"))
    mentions = find_episode_mentions(words) + CONFIRMED_EXTRA_MENTIONS
    mentions = [(t, n) for t, n in mentions if t <= SAMPLE_DURATION_S]
    print(f"  -> {len(mentions)} mentions dans la fenêtre de l'échantillon (0-90 min)")

    print(f"\nCroisement (fenêtre de tolérance ±{MATCH_WINDOW_S}s) :\n")
    # les jingles sont attendus dans l'ordre strict des épisodes (jingle
    # d'indice i -> épisode i+1) : ça sert de numéro "attendu" pour départager
    # les mentions ambiguës (ex. un rappel d'un épisode passé mentionné juste
    # avant le jingle suivant), plutôt que de se fier à la seule proximité
    # temporelle qui peut désigner le mauvais numéro (cf. docs/qc-cross-reference.md)
    assignments = []
    used_mention_times = set()
    for i, jt in enumerate(jingle_times):
        expected_number = i + 1
        match = best_mention(jt, mentions, expected_number)
        if match:
            mt, num = match
            used_mention_times.add(mt)
            gap = mt - jt
            flag = "" if num == expected_number else f"  (attendu : épisode {expected_number})"
            print(f"  jingle {jt/60:6.2f} min  ->  épisode {num:3d}  (numéro à {mt/60:6.2f} min, écart {gap:+5.1f}s){flag}")
        else:
            num = None
            print(f"  jingle {jt/60:6.2f} min  ->  AUCUN numéro proche (à vérifier à la main, attendu : épisode {expected_number})")
        assignments.append(num)

    resolved = [n for n in assignments if n is not None]
    print(f"\n{len(resolved)}/{len(jingle_times)} jingles associés à un numéro")

    expected_sequence = list(range(1, len(jingle_times) + 1))
    if resolved == expected_sequence[:len(resolved)] and len(resolved) == len(jingle_times):
        print(f"Séquence continue et complète : {resolved[0]}..{resolved[-1]} ✅")
    else:
        gaps_in_sequence = [n for n in expected_sequence if n not in resolved]
        print(f"Séquence incomplète ou discontinue — numéros manquants dans 1-{len(jingle_times)} : {gaps_in_sequence}")

    orphan_mentions = [(t, n) for t, n in mentions if t not in used_mention_times]
    if orphan_mentions:
        print(f"\n{len(orphan_mentions)} mentions de numéro sans jingle proche (bruit, cf. docs/qc-episode-parser.md) :")
        for t, n in sorted(orphan_mentions):
            print(f"  {t/60:6.2f} min  ->  épisode {n} (isolé)")


if __name__ == "__main__":
    main()
