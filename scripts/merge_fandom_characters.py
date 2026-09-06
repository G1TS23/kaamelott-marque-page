"""Fusionne le casting scrapé du Wiki Kaamelott (Fandom) dans data/episodes/livre-*.json.

Le Fandom donne un casting exact par épisode (tableau "Distribution"), mais sa
couverture est très partielle (~100/399 épisodes ont une page complète — voir
docs/qc-characters-fandom.md). Priorité au Fandom quand disponible ; on garde
le résultat de l'heuristique existante (guests + matching résumé) sinon.

Usage: python scripts/merge_fandom_characters.py
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FANDOM_RAW_DIR = DATA_DIR / "fandom_raw"

# Variantes de noms trouvées sur le Fandom -> forme canonique utilisée dans
# data/characters.json (ou forme déjà stable côté heuristique). Découvert par
# relecture manuelle des noms non reconnus après le scraping (issue #24).
ALIASES = {
    "Arthur Pendragon": "Arthur",
    "Lancelot du Lac": "Lancelot",
    "Tavernier": "Le Tavernier",
    "Le maître d'armes": "Le maître d’armes",
    "Le Maître d'Armes": "Le maître d’armes",
    "Maître d'armes": "Le maître d’armes",
    "Élias": "Elias",
    "Élias de Kelliwic'h": "Elias",
    "La fée Morgane": "La Fée Morgane",
    "Hervé de Rinel": "Hervé",
    "Caius": "Caius Camillus",
    "Aelis": "Aélis",
    "Répurgateur": "Le Répurgateur",
}

# Noms d'acteurs trouvés par erreur dans un champ "personnages" mal rempli sur
# le Fandom (livre 2, épisode 98) — pas des personnages, exclus explicitement.
NOT_CHARACTERS = {"Alexandre Astier", "Bruno Salomone", "Franck Pitiot"}


def normalize(name: str) -> str:
    name = ALIASES.get(name, name)
    return name


def main():
    total_replaced = 0
    for season in range(1, 5):
        fandom_path = FANDOM_RAW_DIR / f"livre-{season}.json"
        fandom_data = {ep: chars for ep, chars in json.loads(fandom_path.read_text(encoding="utf-8"))}

        episodes_path = DATA_DIR / "episodes" / f"livre-{season}.json"
        episodes = json.loads(episodes_path.read_text(encoding="utf-8"))

        replaced = 0
        for ep in episodes:
            fandom_chars = fandom_data.get(ep["episode"])
            if not fandom_chars:
                ep.setdefault("characters_source", "heuristic")
                continue
            cleaned = sorted({
                normalize(name)
                for name in fandom_chars
                if name not in NOT_CHARACTERS
            })
            if cleaned:
                ep["characters"] = cleaned
                ep["characters_source"] = "fandom"
                replaced += 1
            else:
                ep.setdefault("characters_source", "heuristic")

        episodes_path.write_text(
            json.dumps(episodes, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Livre {season} : {replaced} épisodes mis à jour avec le casting Fandom")
        total_replaced += replaced

    print(f"Total : {total_replaced} épisodes sur 399 utilisent désormais le casting Fandom (le reste garde l'heuristique)")


if __name__ == "__main__":
    main()
