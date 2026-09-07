"""Calcule le champ `characters` de chaque épisode (docs/SPECS.md section 4), à partir
de data/characters.json (liste canonique, voir build_characters.py) et des données déjà
importées dans data/episodes/livre-*.json.

Fusion dédupliquée de :
  - les personnages déjà cités dans `guests` (format "Acteur : Personnage")
  - tout nom canonique détecté dans `summary` (recherche par mot entier, insensible à la casse)

Non-exhaustif par construction : un résumé qui ne nomme personne explicitement ne
remonte rien pour cet épisode.

Usage: python scripts/extract_characters.py
"""

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CHARACTERS_PATH = DATA_DIR / "characters.json"
EPISODES_DIR = DATA_DIR / "episodes"

# Noms canoniques trop courts/génériques pour un matching sûr par mot entier dans un
# résumé libre : trouvé par relecture manuelle (contrôle qualité, issue #24).
# "Lan" (grouillot) matchait le prénom de l'acteur "Lan Truong" dans le résumé de
# s1e05 ("Attila, joué par Lan Truong"), sans rapport avec le personnage lui-même.
# Reste dans characters.json (source guests toujours valide), exclu seulement du
# matching texte.
_EXCLUDED_FROM_TEXT_MATCH = {"Lan"}


def guest_character(guest: str) -> str | None:
    # format Wikipédia : "Acteur : Personnage" (parfois plusieurs ":" si le nom de
    # personnage en contient un, donc on coupe sur le DERNIER séparateur)
    if ":" not in guest:
        return None
    return guest.rsplit(":", 1)[1].strip() or None


def build_patterns(canonical: list[dict]) -> list[tuple[str, re.Pattern]]:
    # noms les plus longs en premier : évite qu'un nom court contenu dans un nom plus
    # long empêche de voir le second (peu de cas ici, mais gratuit à garantir)
    eligible = [c for c in canonical if c["name"] not in _EXCLUDED_FROM_TEXT_MATCH]
    eligible.sort(key=lambda c: len(c["name"]), reverse=True)
    return [
        (c["name"], re.compile(r"\b" + re.escape(c["name"]) + r"\b", re.IGNORECASE))
        for c in eligible
    ]


def characters_for_episode(ep: dict, patterns: list[tuple[str, re.Pattern]]) -> list[str]:
    found = set()
    for guest in ep.get("guests") or []:
        character = guest_character(guest)
        if character:
            found.add(character)

    summary = ep.get("summary") or ""
    for name, pattern in patterns:
        if pattern.search(summary):
            found.add(name)

    return sorted(found)


def process_book(season: int, patterns: list[tuple[str, re.Pattern]]) -> None:
    path = EPISODES_DIR / f"livre-{season}.json"
    episodes = json.loads(path.read_text(encoding="utf-8"))

    for ep in episodes:
        ep["characters"] = characters_for_episode(ep, patterns)

    path.write_text(
        json.dumps(episodes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with_characters = sum(1 for ep in episodes if ep["characters"])
    print(f"Livre {season} : {with_characters}/{len(episodes)} épisodes avec au moins un personnage détecté")


def main():
    canonical = json.loads(CHARACTERS_PATH.read_text(encoding="utf-8"))
    patterns = build_patterns(canonical)
    for season in range(1, 5):
        process_book(season, patterns)


if __name__ == "__main__":
    main()
