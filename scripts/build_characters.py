"""Construit la liste canonique des personnages de Kaamelott (docs/SPECS.md section 4)
depuis https://fr.wikipedia.org/wiki/Liste_des_personnages_de_Kaamelott, pour servir de
référence au champ `characters` de chaque épisode (voir extract_characters.py).

Usage: python scripts/build_characters.py
"""

import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

USER_AGENT = "kaamelott-marque-page-import/1.0 (https://github.com/G1TS23/kaamelott-marque-page)"
URL = "https://fr.wikipedia.org/wiki/Liste_des_personnages_de_Kaamelott"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "characters.json"

# Catégories pertinentes pour les livres I-IV (portée du projet, section "Besoin").
# Exclues : "Arbre généalogique" (pas une liste de personnages), "Rome - Livre VI"
# et "Personnages apparaissant dans le film..." (hors des 4 livres couverts).
CATEGORY_LABELS = {
    "Personnages principaux": "principal",
    "Personnages récurrents": "récurrent",
    "Gratin": "gratin",
    "Notables": "notable",
    "Mythologie bretonne": "mythologie",
    "Grouillots": "grouillot",
}


def clean_text(tag):
    return re.sub(r"\s+", " ", tag.get_text()).strip()


# La page liste des noms complets/descriptifs ("Yvain, le chevalier au Lion",
# "Calogrenant roi de Calédonie") alors que les résumés utilisent le nom court
# ("Yvain", "Calogrenant"). On dérive le nom court en coupant avant la virgule
# ou le premier mot-connecteur descriptif.
_CONNECTORS = (
    r",|:| roi | reine | duc(?:hesse)? d| chef | le | la | l’| l'| d’| d'"
    r"| de | du | des | fille | fils | frère | sœur | mère | père "
    r"| grand-mère | cousins | neveu | femme | chevalier | garde "
    r"| aide | intendante | suivante | sonneur | artisan | prisonnier "
    r"| espion | assassin | voyante | tavernier | paysan | viking "
    r"| vigneron | jurisconsulte | archevêque | évêque | adoptif "
)
_SHORT_NAME_RE = re.compile(_CONNECTORS)

# Le découpage générique se trompe sur les entrées où le "titre" fait partie du nom
# tel qu'utilisé dans les résumés (vérifié contre les invités déjà extraits des 399
# épisodes, ex. "le maître d'armes", "la fée Morgane"), ou laisse un déterminant seul.
_OVERRIDES = {
    "Le neveu de Karadoc": None,  # pas un nom propre, à exclure
    "Les cousins de Perceval": None,  # idem
    "Le maître d’armes": "Le maître d’armes",
    "La Dame du Lac": "La Dame du Lac",
    "Galessin Duc d’Orcanie": "Galessin",
    "L’évêque monseigneur Boniface": "Boniface",
    "L’Interprète Burgonde": "L’Interprète",
}
_BARE_DETERMINERS = {"le", "la", "les", "l’", "l'"}


def short_name(full_name: str):
    if full_name in _OVERRIDES:
        return _OVERRIDES[full_name]
    match = _SHORT_NAME_RE.search(full_name)
    name = (full_name[: match.start()] if match else full_name).strip()
    if name.lower() in _BARE_DETERMINERS or not name:
        return None
    return name


def main():
    resp = requests.get(URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    characters = []
    current_category = None
    for el in soup.find_all(["h2", "h3"]):
        if el.name == "h2":
            heading = clean_text(el)
            current_category = CATEGORY_LABELS.get(heading)  # None si section hors scope
            continue
        if el.name == "h3" and current_category:
            full_name = clean_text(el)
            name = short_name(full_name)
            if name:
                characters.append({"name": name, "category": current_category})
            else:
                print(f"  [skip] « {full_name} » — pas un nom exploitable")

    # dédoublonnage (un même personnage ne devrait apparaître que dans une section,
    # mais on protège contre une éventuelle double mention)
    seen = set()
    unique = []
    for c in characters:
        if c["name"] not in seen:
            seen.add(c["name"])
            unique.append(c)
    unique.sort(key=lambda c: c["name"])

    print(f"{len(unique)} personnages extraits ({len(characters) - len(unique)} doublons ignorés)")
    for label in CATEGORY_LABELS.values():
        count = sum(1 for c in unique if c["category"] == label)
        print(f"  {label}: {count}")

    OUTPUT_PATH.write_text(
        json.dumps(unique, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"-> écrit dans {OUTPUT_PATH.relative_to(OUTPUT_PATH.parent.parent)}")


if __name__ == "__main__":
    main()
