"""Fusionne les timestamps dans les fichiers finaux data/episodes/livre-N.json
(issue #12) : complète `start_seconds`, `timestamp_source` et `confidence`
pour chaque épisode, à partir des deux sources produites en milestone 3.

Sources, par ordre de priorité :

1. **Pipeline** (`data/episode_resolution/livre-N.json`, issues #10/#34/#38) —
   position du jingle détecté par corrélation audio, numéro d'épisode validé
   par recoupement avec la transcription. C'est la source par défaut partout
   où elle existe : mesure machine, uniforme sur tout le livre.
2. **Pointage manuel** (`data/episode_manual/livre-N.json`, issues #11/#36/#42) —
   uniquement pour combler les trous du pipeline (épisodes dont le jingle n'a
   pas été détecté, ou dont le numéro n'a pas pu être confirmé).

Le pointage manuel ne *remplace* donc jamais un timestamp du pipeline quand
les deux existent : ces pointages redondants (l'utilisateur a parfois pointé
au-delà des trous) servent de validation croisée, pas de source — ils sont
systématiquement 2 à 8s plus précoces que le jingle correspondant, l'humain
réagissant au contexte visuel avant que le jingle ne démarre. Garder le
jingle comme référence évite de mélanger deux bases de mesure dans un même
livre.

`confidence` :
- "confirmé" — pointage manuel direct, ou pipeline dont le numéro est validé
  par une mention relative de la transcription ;
- "à repointer" — pipeline dont le numéro vient d'une conversion depuis la
  numérotation absolue (issue #9), cohérente mais non vérifiée. Les épisodes
  listés dans `verified` (Livre 4, vérifiés un par un par visionnage)
  passent en "confirmé".

Usage: python scripts/merge_timestamps.py [--dry-run]
"""

import argparse
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BOOKS = (1, 2, 3, 4)

CONFIRME = "confirmé"
A_REPOINTER = "à repointer"

SOURCE_JINGLE = "jingle"
SOURCE_JINGLE_VERIFIE = "jingle_verifie"
SOURCE_MANUEL = "manuel"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_sources(book):
    episodes = load_json(DATA_DIR / "episodes" / f"livre-{book}.json")
    resolution = load_json(DATA_DIR / "episode_resolution" / f"livre-{book}.json")
    manual_path = DATA_DIR / "episode_manual" / f"livre-{book}.json"
    manual = load_json(manual_path) if manual_path.is_file() else {"manual_points": []}
    return episodes, resolution, manual


def timestamp_for(episode_num, resolved_by_ep, manual_by_ep, verified):
    """Renvoie (start_seconds, timestamp_source, confidence) — (None, None, None)
    si aucune source ne couvre cet épisode."""
    res = resolved_by_ep.get(episode_num)
    if res is not None:
        if res["confidence"] == CONFIRME:
            return res["jingle_time_s"], SOURCE_JINGLE, CONFIRME
        if episode_num in verified:
            return res["jingle_time_s"], SOURCE_JINGLE_VERIFIE, CONFIRME
        return res["jingle_time_s"], SOURCE_JINGLE, A_REPOINTER
    if episode_num in manual_by_ep:
        return round(manual_by_ep[episode_num], 1), SOURCE_MANUEL, CONFIRME
    return None, None, None


def merge_book(book, dry_run=False):
    episodes, resolution, manual = load_sources(book)
    resolved_by_ep = {r["episode"]: r for r in resolution["resolved"]}
    manual_by_ep = {p["episode"]: p["time_s"] for p in manual["manual_points"]}
    verified = set(manual.get("verified", []))

    stats = {SOURCE_JINGLE: 0, SOURCE_JINGLE_VERIFIE: 0, SOURCE_MANUEL: 0}
    sans_source = []
    for ep in episodes:
        start, source, confidence = timestamp_for(ep["episode"], resolved_by_ep, manual_by_ep, verified)
        ep["start_seconds"] = start
        ep["timestamp_source"] = source
        ep["confidence"] = confidence
        if source is None:
            sans_source.append(ep["episode"])
        else:
            stats[source] += 1

    redondants = sorted(set(manual_by_ep) & set(resolved_by_ep))
    a_repointer = sorted(e["episode"] for e in episodes if e["confidence"] == A_REPOINTER)

    print(f"[Livre {book}] {len(episodes)} épisodes")
    print(f"  jingle           : {stats[SOURCE_JINGLE]}")
    print(f"  jingle vérifié   : {stats[SOURCE_JINGLE_VERIFIE]}")
    print(f"  pointage manuel  : {stats[SOURCE_MANUEL]}")
    print(f"  sans timestamp   : {len(sans_source)}{' -> ' + str(sans_source) if sans_source else ''}")
    print(f"  encore à repointer : {len(a_repointer)}{' -> ' + str(a_repointer) if a_repointer else ''}")
    print(f"  pointages manuels redondants (validation croisée seulement) : {len(redondants)}")

    if not dry_run:
        path = DATA_DIR / "episodes" / f"livre-{book}.json"
        path.write_text(json.dumps(episodes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  -> écrit dans {path}")
    return sans_source, a_repointer


def check_monotonic(book):
    """Garde-fou : les timestamps doivent croître avec le numéro d'épisode.
    Une inversion signale un pointage ou une résolution erronée."""
    episodes = load_json(DATA_DIR / "episodes" / f"livre-{book}.json")
    horodates = [(e["episode"], e["start_seconds"]) for e in episodes if e["start_seconds"] is not None]
    horodates.sort()
    inversions = [
        (a[0], b[0]) for a, b in zip(horodates, horodates[1:]) if b[1] <= a[1]
    ]
    return inversions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="n'écrit rien, affiche seulement le rapport")
    args = parser.parse_args()

    total_sans_source = []
    for book in BOOKS:
        sans_source, _ = merge_book(book, dry_run=args.dry_run)
        total_sans_source.extend((book, e) for e in sans_source)
        print()

    if not args.dry_run:
        print("Contrôle de monotonie (le timestamp doit croître avec le numéro d'épisode) :")
        for book in BOOKS:
            inversions = check_monotonic(book)
            print(f"  Livre {book} : {'OK' if not inversions else f'{len(inversions)} inversion(s) -> {inversions}'}")

    if total_sans_source:
        print(f"\n{len(total_sans_source)} épisode(s) sans aucun timestamp : {total_sans_source}")


if __name__ == "__main__":
    main()
