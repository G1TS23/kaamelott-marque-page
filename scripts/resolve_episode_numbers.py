"""Garde-fous de cohérence : résout un numéro d'épisode fiable par jingle
détecté, ou liste précisément les trous à corriger à la main (issue #10).

Constat (issue #8/#9, docs/qc-generalisation-4-livres.md) : ni la piste F
(jingle) ni la piste C (numéro parlé) ne suffit seule.
- Piste F donne l'ordre et les limites d'épisode mais est incomplète
  (jingles manqués par la corrélation, ex. Livre 1 : 97 détectés pour 100
  épisodes réels).
- Piste C confirme l'identité mais est incomplète (mentions manquées,
  70 à 90 % de couverture) et parfois mal calibrée (Livre 4 : numérotation
  absolue en alternance avec la numérotation relative au livre).

Principe retenu : la piste F reste la source de vérité pour l'ordre des
épisodes ; la piste C ne sert que de confirmation ponctuelle (checkpoint),
jamais de guide continu.

Algorithme :
1. Filtrer les mentions par plausibilité (numéro dans 1..N, N = nombre
   d'épisodes réel du livre) — élimine les numéros absolus du Livre 4 sans
   seuil arbitraire.
2. Ne garder qu'un candidat par jingle (le plus proche en temps parmi les
   mentions plausibles) comme checkpoint potentiel.
3. Valider chaque paire de checkpoints consécutifs : si l'écart de jingles
   entre les deux correspond exactement à l'écart de numéros, le segment
   est cohérent -> numéroter par simple incrément. Sinon, un jingle a été
   manqué (ou un faux positif retenu) précisément dans ce segment -> le
   marquer à vérifier à la main (issue #11), sans propager l'incertitude
   au reste du livre.

Usage: python scripts/resolve_episode_numbers.py <1|2|3|4>
"""

import argparse
import json
from pathlib import Path

from correlate_jingle import REFERENCE_PATH, find_jingle_occurrences
from cross_reference_book import CONFIRMED_EXTRA_JINGLES_S, load_mentions

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MATCH_WINDOW_S = 90


def episode_count(book_num):
    episodes = json.loads((DATA_DIR / "episodes" / f"livre-{book_num}.json").read_text(encoding="utf-8"))
    return len(episodes)


def plausible_mentions(mentions, total_episodes):
    """Ne garde que les mentions dont le numéro est dans la plage réelle du
    livre (1..N) — élimine les numérotations absolues ou aberrantes sans
    seuil de tolérance arbitraire."""
    return [(t, n) for t, n in mentions if 1 <= n <= total_episodes]


def raw_checkpoints(jingle_times, mentions):
    """Pour chaque jingle, la mention plausible la plus proche en temps dans
    la fenêtre de tolérance, ou None. Un candidat par jingle seulement — les
    faux checkpoints (rappels, doublons) sont éliminés à l'étape suivante
    par la vérification de cohérence entre checkpoints consécutifs, pas ici."""
    checkpoints = {}
    for i, jt in enumerate(jingle_times):
        candidates = [(abs(t - jt), n) for t, n in mentions if abs(t - jt) <= MATCH_WINDOW_S]
        if candidates:
            _, num = min(candidates)
            checkpoints[i] = num
    return checkpoints


def resolve_segments(jingle_times, checkpoints):
    """Renvoie (resolved, unresolved_ranges).
    resolved : {jingle_index: episode_number} pour les segments cohérents.
    unresolved_ranges : liste de dicts {start, end, before, after} (indices
    de jingle inclusifs, `before`/`after` = numéro d'épisode du checkpoint
    encadrant quand il existe, None sinon) pour les jingles sans numéro
    fiable (segment incohérent, ou hors de toute paire de checkpoints
    validée)."""
    anchors = sorted(checkpoints.items())
    resolved = {}
    unresolved_ranges = []

    if len(anchors) < 2:
        if jingle_times:
            unresolved_ranges.append({"start": 0, "end": len(jingle_times) - 1, "before": None, "after": None})
        return resolved, unresolved_ranges

    # avant le premier checkpoint : pas de checkpoint de départ pour valider
    if anchors[0][0] > 0:
        unresolved_ranges.append({"start": 0, "end": anchors[0][0] - 1, "before": None, "after": anchors[0][1]})

    for (idx_a, num_a), (idx_b, num_b) in zip(anchors, anchors[1:]):
        jingle_gap = idx_b - idx_a
        number_gap = num_b - num_a
        if number_gap == jingle_gap:
            for offset in range(jingle_gap + 1):
                resolved[idx_a + offset] = num_a + offset
        else:
            unresolved_ranges.append({"start": idx_a, "end": idx_b, "before": num_a, "after": num_b})

    # après le dernier checkpoint : pas de checkpoint de fin pour valider
    if anchors[-1][0] < len(jingle_times) - 1:
        unresolved_ranges.append({"start": anchors[-1][0] + 1, "end": len(jingle_times) - 1, "before": anchors[-1][1], "after": None})

    return resolved, unresolved_ranges


def resolve_book(book_num, reference_path=REFERENCE_PATH):
    audio_path = DATA_DIR / "audio_samples" / f"livre-{book_num}-full.wav"
    total_episodes = episode_count(book_num)

    print(f"[Livre {book_num}] {total_episodes} épisodes réels (Wikipedia)")

    jingle_occurrences = find_jingle_occurrences(reference_path=reference_path, sample_path=audio_path)
    jingle_times = sorted([t for t, _ in jingle_occurrences] + CONFIRMED_EXTRA_JINGLES_S.get(book_num, []))
    print(f"  -> {len(jingle_times)} jingles détectés")

    mentions = load_mentions(book_num)
    plausible = plausible_mentions(mentions, total_episodes)
    print(f"  -> {len(mentions)} mentions au total, {len(plausible)} plausibles (1-{total_episodes})")

    checkpoints = raw_checkpoints(jingle_times, plausible)
    print(f"  -> {len(checkpoints)} checkpoints candidats")

    resolved, unresolved_ranges = resolve_segments(jingle_times, checkpoints)

    print(f"\n[Livre {book_num}] {len(resolved)}/{len(jingle_times)} jingles résolus avec confiance :\n")
    for idx in sorted(resolved):
        print(f"  jingle {jingle_times[idx]/60:6.2f} min  ->  épisode {resolved[idx]:3d}")

    if unresolved_ranges:
        print(f"\n{len(unresolved_ranges)} trou(s) à vérifier à la main (issue #11) :")
        for r in unresolved_ranges:
            start, end, before, after = r["start"], r["end"], r["before"], r["after"]
            t0, t1 = jingle_times[start] / 60, jingle_times[end] / 60
            n_jingles = end - start + 1
            if before is not None and after is not None:
                hint = f" (entre épisode {before} et épisode {after}, {n_jingles - 1} jingle(s) intermédiaire(s) pour {after - before - 1} épisode(s) attendu(s))"
            elif before is not None:
                hint = f" (après épisode {before}, pas de checkpoint de fin)"
            elif after is not None:
                hint = f" (avant épisode {after}, pas de checkpoint de début)"
            else:
                hint = " (aucun checkpoint dans tout le livre)"
            print(f"  jingles {start}-{end} ({n_jingles}), {t0:.2f}-{t1:.2f} min{hint}")

    return resolved, unresolved_ranges, jingle_times


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", type=int, choices=[1, 2, 3, 4], help="Numéro du livre (1-4)")
    parser.add_argument("--reference", type=Path, default=REFERENCE_PATH)
    args = parser.parse_args()
    resolve_book(args.book, reference_path=args.reference)


if __name__ == "__main__":
    main()
