"""Récupère, pour les rôles secondaires/récurrents de chaque livre, la liste précise
des épisodes où ils apparaissent (page casting AlloCiné par saison). Contrairement
au Wiki Kaamelott (Fandom, casting complet par épisode mais très partiel — voir
docs/qc-characters-fandom.md), AlloCiné donne l'inverse : par personnage, la liste
de ses épisodes. Complémentaire, pas un remplacement.

Usage: python scripts/scrape_allocine_cast.py
"""

import json
import re
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (kaamelott-marque-page-import/1.0)"

# saison N -> identifiant de saison AlloCiné (ficheserie-334)
SEASON_IDS = {1: 1176, 2: 5221, 3: 5223, 4: 5224}

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "allocine_raw"


def normalize(name: str) -> str:
    """Casse et accents neutralisés, pour comparer des graphies différentes
    du même nom (ex. "Azenor"/"Azénor", "L'Ankou"/"l'Ankou")."""
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[’']", "'", stripped).strip().lower()

# même logique que build_characters.py : la page donne parfois un nom descriptif
# complet ("Kay, chevalier sonneur") plutôt que le nom court utilisé ailleurs.
_CONNECTORS = re.compile(
    r",|:| roi | reine | duc(?:hesse)? d| chef | le | la | l’| l'| d’| d'"
    r"| de | du | des | fille | fils | frère | sœur | mère | père "
    r"| grand-mère | cousins | neveu | femme | chevalier | garde "
    r"| aide | intendante | suivante | sonneur | artisan | prisonnier "
    r"| espion | assassin | voyante | tavernier | paysan | viking "
    r"| vigneron | jurisconsulte | archevêque | évêque | adoptif ",
    re.IGNORECASE,
)


# Cas où le découpage générique se tromperait (le "titre" fait partie du nom
# tel qu'utilisé ailleurs, ex. "L'Interprète") plutôt que d'être un simple
# élément descriptif à couper. Comparé après normalize().
_OVERRIDES = {
    normalize("L'interprète burgonde"): "L’Interprète",
    normalize("L'intendante Torri"): "Torri",
    normalize("Seigneur Jacca"): "Jacca",
    normalize("seigneur narces"): "Narsès",
    normalize("Gudü"): "Grüdü",
}
_BARE_DETERMINERS = {"le", "la", "les", "l'"}

_CANON_BY_NORM = {
    normalize(c["name"]): c["name"]
    for c in json.loads((DATA_DIR / "characters.json").read_text(encoding="utf-8"))
}


def short_name(full_name: str):
    norm_full = normalize(full_name)
    if norm_full in _CANON_BY_NORM:
        return _CANON_BY_NORM[norm_full]
    if norm_full in _OVERRIDES:
        return _OVERRIDES[norm_full]

    match = _CONNECTORS.search(full_name)
    candidate = (full_name[: match.start()] if match else full_name).strip()
    norm_candidate = normalize(candidate)
    if norm_candidate in _CANON_BY_NORM:
        return _CANON_BY_NORM[norm_candidate]
    if norm_candidate in _BARE_DETERMINERS or not candidate:
        return None
    return candidate


def parse_season(season: int, html: str):
    soup = BeautifulSoup(html, "html.parser")
    entries = []
    for row in soup.select("div.md-table-row"):
        char_span = row.select_one("span.item.light")
        ep_div = row.select_one("div.item-episodes")
        if not char_span or not ep_div:
            continue  # rôle principal sans détail par épisode
        full_name = char_span.get_text(strip=True)
        # le texte est "- N Episodes : 20 - 28 - ...", le "N" avant ":" est un
        # compte, pas un numéro d'épisode — ne parser que ce qui suit ":"
        ep_text = ep_div.get_text(" ", strip=True)
        after_colon = ep_text.split(":", 1)[1] if ":" in ep_text else ep_text
        episode_numbers = [int(n) for n in re.findall(r"\d+", after_colon)]
        if not episode_numbers:
            continue
        name = short_name(full_name)
        if not name:
            print(f"  [skip] « {full_name} » — pas un nom exploitable")
            continue
        entries.append({"name": name, "episodes": episode_numbers})
    return entries


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for season, allocine_id in SEASON_IDS.items():
        url = f"https://www.allocine.fr/series/ficheserie-334/casting/saison-{allocine_id}/"
        print(f"Livre {season} : téléchargement de {url}")
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        resp.raise_for_status()
        entries = parse_season(season, resp.text)
        print(f"  -> {len(entries)} personnages avec épisodes précis")

        out_path = OUTPUT_DIR / f"livre-{season}.json"
        out_path.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
