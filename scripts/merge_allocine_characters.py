"""Enrichit data/episodes/livre-*.json avec les personnages secondaires/récurrents
et leurs épisodes précis scrapés depuis AlloCiné (scripts/scrape_allocine_cast.py).

Contrairement au Fandom (casting complet par épisode, priorité sur l'heuristique),
AlloCiné donne l'inverse : par personnage, sa liste d'épisodes. On l'ajoute donc en
union à `characters`, quel que soit `characters_source` — ça n'écrase jamais rien,
ça ne fait qu'ajouter des noms qui manquaient.

Usage: python scripts/merge_allocine_characters.py
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ALLOCINE_DIR = DATA_DIR / "allocine_raw"


def main():
    total_additions = 0
    for season in range(1, 5):
        allocine_entries = json.loads((ALLOCINE_DIR / f"livre-{season}.json").read_text(encoding="utf-8"))

        # numéro d'épisode -> ensemble de noms à ajouter
        additions_by_episode: dict[int, set[str]] = {}
        for entry in allocine_entries:
            for ep_num in entry["episodes"]:
                additions_by_episode.setdefault(ep_num, set()).add(entry["name"])

        episodes_path = DATA_DIR / "episodes" / f"livre-{season}.json"
        episodes = json.loads(episodes_path.read_text(encoding="utf-8"))

        additions = 0
        for ep in episodes:
            new_names = additions_by_episode.get(ep["episode"])
            if not new_names:
                continue
            before = set(ep["characters"])
            merged = sorted(before | new_names)
            if merged != ep["characters"]:
                additions += len(set(merged) - before)
            ep["characters"] = merged

        episodes_path.write_text(
            json.dumps(episodes, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Livre {season} : {additions} mentions de personnage ajoutées (AlloCiné)")
        total_additions += additions

    print(f"Total : {total_additions} ajouts sur les 399 épisodes")


if __name__ == "__main__":
    main()
