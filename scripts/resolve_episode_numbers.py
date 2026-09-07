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
1. Filtrer les mentions par plausibilité : un numéro est retenu s'il est
   soit dans la plage relative du livre (1..N, N = nombre d'épisodes réel),
   soit dans la plage absolue de la série complète à ce point (numéro
   cumulé des livres précédents + 1..N) — auquel cas il est converti en
   numéro relatif (numéro absolu - cumul des livres précédents). Un numéro
   hors des deux plages est écarté. La provenance (relatif/absolu converti)
   est conservée pour signaler ces checkpoints à repointer même s'ils sont
   validés par la suite (issue #9 : le Livre 4 alterne les deux formats
   sans règle prévisible, donc une conversion qui passe la vérification de
   cohérence reste une hypothèse à confirmer, pas une certitude).
2. Ne garder qu'un candidat par jingle (le plus proche en temps parmi les
   mentions plausibles) comme checkpoint potentiel.
3. Valider chaque paire de checkpoints consécutifs : si l'écart de jingles
   entre les deux correspond exactement à l'écart de numéros, le segment
   est cohérent -> numéroter par simple incrément. Sinon, un jingle a été
   manqué (ou un faux positif retenu) précisément dans ce segment -> le
   marquer à vérifier à la main (issue #11), sans propager l'incertitude
   au reste du livre. Un segment résolu via un checkpoint converti depuis
   l'absolu reste marqué "à repointer" plutôt que "confirmé".

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


def absolute_offset(book_num):
    """Numéro absolu (série complète) du dernier épisode des livres
    précédents — ex. Livre 4 : Livres 1+2+3 = 300 (100+100+100)."""
    return sum(episode_count(n) for n in range(1, book_num))


def plausible_mentions(mentions, total_episodes, offset=0):
    """Ne garde que les mentions interprétables comme un numéro d'épisode
    plausible de ce livre, sous l'une des deux formes observées (issue #9) :
    - relatif au livre : numéro déjà dans 1..N ;
    - absolu dans la série complète : numéro dans offset+1..offset+N,
      converti en numéro relatif (numéro - offset).

    Renvoie (temps, numéro_relatif, source) — source = "relatif" ou
    "absolu", conservée pour marquer les checkpoints issus d'une conversion
    comme à repointer même s'ils passent la vérification de cohérence."""
    result = []
    for t, n in mentions:
        if 1 <= n <= total_episodes:
            result.append((t, n, "relatif"))
        elif offset and offset < n <= offset + total_episodes:
            result.append((t, n - offset, "absolu"))
    return result


def raw_checkpoints(jingle_times, mentions):
    """Pour chaque jingle, la mention plausible la plus proche en temps dans
    la fenêtre de tolérance, ou None. Un candidat par jingle seulement — les
    faux checkpoints (rappels, doublons) sont éliminés à l'étape suivante
    par la vérification de cohérence entre checkpoints consécutifs, pas ici."""
    checkpoints = {}
    for i, jt in enumerate(jingle_times):
        candidates = [(abs(t - jt), n, source) for t, n, source in mentions if abs(t - jt) <= MATCH_WINDOW_S]
        if candidates:
            _, num, source = min(candidates)
            checkpoints[i] = (num, source)
    return checkpoints


def resolve_segments(jingle_times, checkpoints):
    """Renvoie (resolved, unresolved_ranges).
    resolved : {jingle_index: (episode_number, confidence)} pour les
    segments cohérents — confidence = "confirmé" si les deux checkpoints
    encadrants sont d'origine relative, "à repointer" si l'un des deux vient
    d'une conversion depuis une numérotation absolue (passe la vérification
    de cohérence, mais reste une hypothèse plutôt qu'une certitude, issue
    #9 : le Livre 4 alterne les deux formats sans règle prévisible).
    unresolved_ranges : liste de dicts {start, end, checkpoint_start,
    checkpoint_end} (indices de jingle inclusifs, `checkpoint_start`/
    `checkpoint_end` = numéro brut du checkpoint trouvé respectivement à
    l'indice `start` et à l'indice `end`, None si absent). Ce sont les deux
    valeurs qui se sont révélées incohérentes entre elles (l'écart de
    jingles ne correspond pas à l'écart de numéros) — **pas nécessairement
    `checkpoint_start` < `checkpoint_end`** : l'une des deux peut être une
    mention parasite (rappel, aparté), c'est précisément pourquoi ce
    segment est signalé plutôt qu'accepté tel quel (cf. le cas "épisode 6"
    de l'issue #8, qui ressort naturellement ici)."""
    anchors = sorted(checkpoints.items())
    resolved = {}
    unresolved_ranges = []

    if len(anchors) < 2:
        if jingle_times:
            unresolved_ranges.append({"start": 0, "end": len(jingle_times) - 1, "checkpoint_start": None, "checkpoint_end": None})
        return resolved, unresolved_ranges

    # avant le premier checkpoint : pas de checkpoint de départ pour valider
    if anchors[0][0] > 0:
        unresolved_ranges.append({"start": 0, "end": anchors[0][0] - 1, "checkpoint_start": None, "checkpoint_end": anchors[0][1][0]})

    for (idx_a, (num_a, src_a)), (idx_b, (num_b, src_b)) in zip(anchors, anchors[1:]):
        jingle_gap = idx_b - idx_a
        number_gap = num_b - num_a
        if number_gap == jingle_gap:
            confidence = "confirmé" if src_a == src_b == "relatif" else "à repointer"
            for offset in range(jingle_gap + 1):
                resolved[idx_a + offset] = (num_a + offset, confidence)
        else:
            unresolved_ranges.append({"start": idx_a, "end": idx_b, "checkpoint_start": num_a, "checkpoint_end": num_b})

    # après le dernier checkpoint : pas de checkpoint de fin pour valider
    if anchors[-1][0] < len(jingle_times) - 1:
        unresolved_ranges.append({"start": anchors[-1][0] + 1, "end": len(jingle_times) - 1, "checkpoint_start": anchors[-1][1][0], "checkpoint_end": None})

    return resolved, unresolved_ranges


def print_resolved(book_num, resolved, jingle_times):
    n_a_repointer = sum(1 for _, conf in resolved.values() if conf == "à repointer")
    print(f"\n[Livre {book_num}] {len(resolved)}/{len(jingle_times)} jingles résolus (dont {n_a_repointer} à repointer) :\n")
    for idx in sorted(resolved):
        num, confidence = resolved[idx]
        flag = "" if confidence == "confirmé" else "  [à repointer : checkpoint issu d'une numérotation absolue]"
        print(f"  jingle {jingle_times[idx]/60:6.2f} min  ->  épisode {num:3d}{flag}")


def gap_hint(cp_start, cp_end, n_jingles):
    """Message explicatif pour un trou : les checkpoints trouvés aux deux
    bornes (ordre chronologique, pas forcément numérique) — s'ils ne sont
    PAS croissants, l'un des deux est probablement une mention parasite
    (rappel, aparté) plutôt qu'une vraie annonce, cf. issue #8, cas
    "épisode 6"."""
    if cp_start is not None and cp_end is not None:
        suspect = "" if cp_end > cp_start else " — au moins un des deux checkpoints est probablement erroné"
        return f" (checkpoints épisode {cp_start} puis épisode {cp_end}, {n_jingles - 1} jingle(s) intermédiaire(s) pour {cp_end - cp_start - 1} épisode(s) attendu(s){suspect})"
    if cp_start is not None:
        return f" (après épisode {cp_start}, pas de checkpoint de fin)"
    if cp_end is not None:
        return f" (avant épisode {cp_end}, pas de checkpoint de début)"
    return " (aucun checkpoint dans tout le livre)"


def print_gaps(unresolved_ranges, jingle_times):
    if not unresolved_ranges:
        return
    print(f"\n{len(unresolved_ranges)} trou(s) à vérifier à la main (issue #11) :")
    for r in unresolved_ranges:
        start, end = r["start"], r["end"]
        t0, t1 = jingle_times[start] / 60, jingle_times[end] / 60
        n_jingles = end - start + 1
        hint = gap_hint(r["checkpoint_start"], r["checkpoint_end"], n_jingles)
        print(f"  jingles {start}-{end} ({n_jingles}), {t0:.2f}-{t1:.2f} min{hint}")


def resolve_book(book_num, reference_path=REFERENCE_PATH):
    audio_path = DATA_DIR / "audio_samples" / f"livre-{book_num}-full.wav"
    total_episodes = episode_count(book_num)

    print(f"[Livre {book_num}] {total_episodes} épisodes réels (Wikipedia)")

    jingle_occurrences = find_jingle_occurrences(reference_path=reference_path, sample_path=audio_path)
    jingle_times = sorted([t for t, _ in jingle_occurrences] + CONFIRMED_EXTRA_JINGLES_S.get(book_num, []))
    print(f"  -> {len(jingle_times)} jingles détectés")

    offset = absolute_offset(book_num)
    mentions = load_mentions(book_num)
    plausible = plausible_mentions(mentions, total_episodes, offset=offset)
    n_absolu = sum(1 for _, _, src in plausible if src == "absolu")
    print(f"  -> {len(mentions)} mentions au total, {len(plausible)} plausibles (dont {n_absolu} converties depuis l'absolu, offset {offset})")

    checkpoints = raw_checkpoints(jingle_times, plausible)
    print(f"  -> {len(checkpoints)} checkpoints candidats")

    resolved, unresolved_ranges = resolve_segments(jingle_times, checkpoints)

    print_resolved(book_num, resolved, jingle_times)
    print_gaps(unresolved_ranges, jingle_times)

    output_path = DATA_DIR / "episode_resolution" / f"livre-{book_num}.json"
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text(
        json.dumps(to_json(book_num, total_episodes, resolved, unresolved_ranges, jingle_times), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\nRésultat exporté dans {output_path}")

    return resolved, unresolved_ranges, jingle_times


def to_json(book_num, total_episodes, resolved, unresolved_ranges, jingle_times):
    """Structure exportable (data/episode_resolution/livre-N.json) : la
    liste concrète des trous demandée par l'issue #10, exploitable
    directement par l'outil de pointage manuel (issue #11) sans avoir à
    relancer le pipeline."""
    return {
        "book": book_num,
        "total_episodes": total_episodes,
        "jingles_detected": len(jingle_times),
        "resolved": [
            {"episode": num, "jingle_time_s": round(jingle_times[idx], 2), "confidence": confidence}
            for idx, (num, confidence) in sorted(resolved.items())
        ],
        "gaps": [
            {
                "jingle_index_start": r["start"],
                "jingle_index_end": r["end"],
                "time_start_s": round(jingle_times[r["start"]], 2),
                "time_end_s": round(jingle_times[r["end"]], 2),
                # Numéro brut du checkpoint trouvé à jingle_index_start et à
                # jingle_index_end (ordre chronologique, PAS numérique) : les
                # deux se sont révélées incohérentes entre elles (l'écart de
                # jingles ne correspond pas à l'écart de numéros), donc l'une
                # des deux peut très bien être une mention parasite (rappel,
                # aparté) plutôt qu'une vraie annonce — voir issue #8, cas
                # "épisode 6". checkpoint_end < checkpoint_start est possible
                # et signale justement ce cas.
                "checkpoint_start": r["checkpoint_start"],
                "checkpoint_end": r["checkpoint_end"],
            }
            for r in unresolved_ranges
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", type=int, choices=[1, 2, 3, 4], help="Numéro du livre (1-4)")
    parser.add_argument("--reference", type=Path, default=REFERENCE_PATH)
    args = parser.parse_args()
    resolve_book(args.book, reference_path=args.reference)


if __name__ == "__main__":
    main()
