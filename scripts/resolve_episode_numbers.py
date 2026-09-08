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

CONFIRME = "confirmé"
A_REPOINTER = "à repointer"


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


def prune_isolated_checkpoints(checkpoints):
    """Retire les checkpoints isolés : ni la paire avec le voisin de gauche
    ni celle avec le voisin de droite n'est cohérente, mais la paire
    élargie (en sautant ce checkpoint) l'est. C'est le signe d'une mention
    parasite (rappel, aparté — même pattern que le cas "épisode 6" de
    l'issue #8) sur UN jingle au milieu d'un segment par ailleurs cohérent :
    sans ce nettoyage, elle coupe artificiellement le segment en deux faux
    trous au lieu de laisser passer la paire élargie (issue #34, trouvé en
    testant l'outil de pointage manuel sur des trous qui semblaient
    doublonner alors qu'ils encadraient la même mention parasite).

    Le jingle retiré redevient un point interpolé ordinaire du segment
    large, résolu normalement par _resolve_pair."""
    anchors = sorted(checkpoints.items())
    pruned = dict(checkpoints)
    for (idx_prev, (num_prev, _)), (idx_cur, (num_cur, _)), (idx_next, (num_next, _)) in zip(anchors, anchors[1:], anchors[2:]):
        left_ok = num_cur - num_prev == idx_cur - idx_prev
        right_ok = num_next - num_cur == idx_next - idx_cur
        wide_ok = num_next - num_prev == idx_next - idx_prev
        if not left_ok and not right_ok and wide_ok:
            del pruned[idx_cur]
    return pruned


def _confidence(src):
    return CONFIRME if src == "relatif" else A_REPOINTER


def _resolve_pair(anchor_a, anchor_b, resolved):
    """Si la paire d'ancres est cohérente (écart de jingles == écart de
    numéros), numérote les jingles idx_a..idx_b (bornes incluses) dans
    `resolved` et renvoie True. Sinon ne touche pas `resolved` et renvoie
    False (la paire est incohérente, à traiter comme un trou par l'appelant).

    Les deux ancres elles-mêmes ont un numéro directement observé (leur
    propre mention) : leur confiance ne dépend que de leur propre source,
    pas de l'autre ancre de la paire — sans quoi, pour une ancre partagée
    entre deux paires consécutives, la confiance retenue dépendrait
    arbitrairement de l'ordre de traitement plutôt que de refléter la
    fiabilité réelle de cette ancre. Les points strictement entre les deux
    ancres sont, eux, de vrais numéros interpolés (aucune mention propre) :
    leur confiance dépend bien des deux ancres encadrantes."""
    idx_a, (num_a, src_a) = anchor_a
    idx_b, (num_b, src_b) = anchor_b
    jingle_gap = idx_b - idx_a
    if num_b - num_a != jingle_gap:
        return False

    resolved[idx_a] = (num_a, _confidence(src_a))
    resolved[idx_b] = (num_b, _confidence(src_b))
    interior_confidence = CONFIRME if src_a == src_b == "relatif" else A_REPOINTER
    for offset in range(1, jingle_gap):
        resolved[idx_a + offset] = (num_a + offset, interior_confidence)
    return True


def resolve_segments(jingle_times, checkpoints):
    """Renvoie (resolved, unresolved_ranges).
    resolved : {jingle_index: (episode_number, confidence)} pour les
    segments cohérents. Pour une ancre (jingle directement associé à un
    checkpoint) : confidence = "confirmé" si sa propre mention est
    d'origine relative, "à repointer" si elle vient d'une conversion
    depuis une numérotation absolue — dépend uniquement de cette ancre,
    jamais de l'ancre voisine (sans quoi une ancre partagée entre deux
    paires consécutives aurait une confiance dépendant arbitrairement de
    l'ordre de traitement). Pour un point interpolé entre deux ancres (pas
    de mention propre) : confidence = "confirmé" seulement si les deux
    ancres encadrantes sont d'origine relative, "à repointer" sinon (passe
    la vérification de cohérence, mais reste une hypothèse plutôt qu'une
    certitude, issue #9 : le Livre 4 alterne les deux formats sans règle
    prévisible).
    unresolved_ranges : liste de dicts {start, end, checkpoint_start,
    checkpoint_end} (indices de jingle inclusifs, `checkpoint_start`/
    `checkpoint_end` = numéro brut du checkpoint trouvé respectivement à
    l'indice `start` et à l'indice `end`, None si absent). Ce sont les deux
    valeurs qui se sont révélées incohérentes entre elles (l'écart de
    jingles ne correspond pas à l'écart de numéros) — **pas nécessairement
    `checkpoint_start` < `checkpoint_end`** : l'une des deux peut être une
    mention parasite (rappel, aparté), c'est précisément pourquoi ce
    segment est signalé plutôt qu'accepté tel quel (cf. le cas "épisode 6"
    de l'issue #8, qui ressort naturellement ici).

    Un même indice de jingle peut apparaître à la fois dans `resolved` et
    comme borne d'un trou de `unresolved_ranges` : une ancre est validée
    indépendamment avec chacun de ses deux voisins, donc elle peut être
    confirmée via l'un (et entrer dans `resolved`) tout en étant la borne
    d'un trou avec l'autre (parce que CET AUTRE couple, lui, est
    incohérent) — ce n'est pas contradictoire, `resolved` reste la valeur
    de référence pour cette ancre précise."""
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

    for anchor_a, anchor_b in zip(anchors, anchors[1:]):
        if not _resolve_pair(anchor_a, anchor_b, resolved):
            idx_a, (num_a, _) = anchor_a
            idx_b, (num_b, _) = anchor_b
            unresolved_ranges.append({"start": idx_a, "end": idx_b, "checkpoint_start": num_a, "checkpoint_end": num_b})

    # après le dernier checkpoint : pas de checkpoint de fin pour valider
    if anchors[-1][0] < len(jingle_times) - 1:
        unresolved_ranges.append({"start": anchors[-1][0] + 1, "end": len(jingle_times) - 1, "checkpoint_start": anchors[-1][1][0], "checkpoint_end": None})

    return resolved, unresolved_ranges


def print_resolved(book_num, resolved, jingle_times):
    n_a_repointer = sum(1 for _, conf in resolved.values() if conf == A_REPOINTER)
    print(f"\n[Livre {book_num}] {len(resolved)}/{len(jingle_times)} jingles résolus (dont {n_a_repointer} à repointer) :\n")
    for idx in sorted(resolved):
        num, confidence = resolved[idx]
        flag = "" if confidence == CONFIRME else "  [à repointer : checkpoint issu d'une numérotation absolue]"
        print(f"  jingle {jingle_times[idx]/60:6.2f} min  ->  épisode {num:3d}{flag}")


def gap_hint(cp_start, cp_end, n_jingles):
    """Message explicatif pour un trou : les checkpoints trouvés aux deux
    bornes (ordre chronologique, pas forcément numérique) — s'ils ne sont
    PAS croissants, l'un des deux est probablement une mention parasite
    (rappel, aparté) plutôt qu'une vraie annonce, cf. issue #8, cas
    "épisode 6"."""
    if cp_start is not None and cp_end is not None:
        suspect = "" if cp_end > cp_start else " — au moins un des deux checkpoints est probablement erroné"
        # n_jingles compte les deux bornes (les ancres elles-mêmes) ; les
        # jingles réellement "intermédiaires" (ni l'un ni l'autre checkpoint)
        # sont n_jingles - 2, pas n_jingles - 1.
        return f" (checkpoints épisode {cp_start} puis épisode {cp_end}, {n_jingles - 2} jingle(s) intermédiaire(s) pour {cp_end - cp_start - 1} épisode(s) attendu(s){suspect})"
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
    checkpoints = prune_isolated_checkpoints(checkpoints)
    print(f"  -> {len(checkpoints)} checkpoints candidats (mentions parasites isolées retirées)")

    resolved, unresolved_ranges = resolve_segments(jingle_times, checkpoints)

    print_resolved(book_num, resolved, jingle_times)
    print_gaps(unresolved_ranges, jingle_times)

    output_path = DATA_DIR / "episode_resolution" / f"livre-{book_num}.json"
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text(
        json.dumps(to_json(book_num, total_episodes, resolved, unresolved_ranges, jingle_times, plausible), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\nRésultat exporté dans {output_path}")

    return resolved, unresolved_ranges, jingle_times


def expected_episode_range(gap, resolved_episodes):
    """Bornes réelles des épisodes à pointer pour ce trou (incluses).

    Un checkpoint de bordure est exclu de la plage seulement s'il est
    *effectivement* résolu ailleurs (dans `resolved_episodes`) — pas
    simplement parce qu'il existe comme checkpoint. Un checkpoint dont NI
    la paire de gauche NI la paire de droite n'est cohérente (contrairement
    au cas de l'issue #34, où la paire élargie était cohérente) n'est
    jamais ajouté à `resolved` : en l'excluant quand même de la plage
    "attendu" du trou voisin, son propre numéro disparaissait
    silencieusement, jamais résolu ni jamais proposé au pointage manuel
    (issue #38)."""
    lo = hi = None
    if gap["checkpoint_start"] is not None:
        lo = gap["checkpoint_start"] if gap["checkpoint_start"] not in resolved_episodes else gap["checkpoint_start"] + 1
    if gap["checkpoint_end"] is not None:
        hi = gap["checkpoint_end"] if gap["checkpoint_end"] not in resolved_episodes else gap["checkpoint_end"] - 1
    return lo, hi


def mention_hints(gap, plausible, resolved_episodes):
    """Mentions plausibles (déjà filtrées/converties) dont le numéro tombe
    dans la plage attendue du trou (cf. expected_episode_range) — un
    jingle a pu être manqué par la corrélation audio alors que le numéro,
    lui, a bien été annoncé et transcrit. Donne un timestamp précis où
    chercher au lieu de devoir visionner toute la fenêtre du trou en
    aveugle (cf. issue #11 : sans ça, l'épisode déjà confirmé au début du
    trou peut être confondu avec celui à pointer)."""
    lo, hi = expected_episode_range(gap, resolved_episodes)
    if lo is None or hi is None or hi < lo:
        return []
    candidates = sorted((t, n) for t, n, _ in plausible if lo <= n <= hi)
    # une seule mention par numéro (la première dans le temps) : l'ASR
    # détecte parfois le même mot deux fois à quelques ms d'écart (cf.
    # docs/qc-cross-reference.md), inutile de dupliquer l'indice.
    seen = set()
    hints = []
    for t, n in candidates:
        if n not in seen:
            seen.add(n)
            hints.append({"episode": n, "time_s": round(t, 2)})
    return hints


def to_json(book_num, total_episodes, resolved, unresolved_ranges, jingle_times, plausible):
    """Structure exportable (data/episode_resolution/livre-N.json) : la
    liste concrète des trous demandée par l'issue #10, exploitable
    directement par l'outil de pointage manuel (issue #11) sans avoir à
    relancer le pipeline."""
    resolved_episodes = {num for num, _ in resolved.values()}
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
                # Bornes réelles (incluses) des épisodes à pointer — un
                # checkpoint de bordure n'est exclu que s'il est
                # *effectivement* résolu ailleurs, pas juste parce qu'il
                # existe (issue #38, cf. expected_episode_range).
                "expected_first_episode": expected_episode_range(r, resolved_episodes)[0],
                "expected_last_episode": expected_episode_range(r, resolved_episodes)[1],
                # Mentions transcrites d'un numéro attendu dans ce trou, sans
                # jingle associé (cf. mention_hints ci-dessus) — indice de
                # timestamp, pas une confirmation aussi solide qu'un jingle.
                "mention_hints": mention_hints(r, plausible, resolved_episodes),
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
