"""Extrait titres, résumés et métadonnées des 4 pages Wikipédia de saison de Kaamelott
vers un fichier JSON par livre (docs/SPECS.md section 4).

Usage: python scripts/import_wikipedia.py
"""

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

USER_AGENT = "kaamelott-marque-page-import/1.0 (https://github.com/G1TS23/kaamelott-marque-page)"

# (saison, url Wikipédia, video_id YouTube) -- miroir de RESSOURCE.md
SEASONS = [
    (1, "https://fr.wikipedia.org/wiki/Saison_1_de_Kaamelott", "REFu8UmXXE0"),
    (2, "https://fr.wikipedia.org/wiki/Saison_2_de_Kaamelott", "x1RgHE0rg1M"),
    (3, "https://fr.wikipedia.org/wiki/Saison_3_de_Kaamelott", "7BZ6H9g2sng"),
    (4, "https://fr.wikipedia.org/wiki/Saison_4_de_Kaamelott", "lTN7vNhawyg"),
]

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "episodes"

NUMERO_RE = re.compile(r"\((\d+)\.(\d+)\)")


def fetch(url: str) -> str:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    return resp.text


def field_value(bold_tag):
    """Valeur d'un champ du gabarit d'épisode : le <div> qui suit un <b>Label</b>.
    Renvoie une liste de chaînes si le div contient une liste (<li>), sinon une chaîne."""
    div = bold_tag.find_next_sibling("div")
    if div is None:
        return None
    items = div.find_all("li")
    if items:
        return [li.get_text(" ", strip=True) for li in items]
    text = div.get_text(" ", strip=True)
    return text or None


def parse_season(season: int, html: str, video_id: str):
    soup = BeautifulSoup(html, "html.parser")
    episodes = []

    next_episode_num = 1
    for h2 in soup.find_all("h2"):
        heading_id = h2.get("id", "")
        if not heading_id.startswith("Épisode"):
            continue

        section = h2.find_parent("section")
        if section is None:
            continue

        title_tag = h2.find("i")
        title = title_tag.get_text(strip=True) if title_tag else None

        fields = {}
        for b in section.find_all("b"):
            label = b.get_text(strip=True)
            fields[label] = field_value(b)

        numero_raw = fields.get("Numéro de production")
        match = NUMERO_RE.search(numero_raw or "")
        if match:
            parsed_season, episode_num = int(match.group(1)), int(match.group(2))
            if parsed_season != season:
                print(f"  [!] Livre {season} : incohérence numéro/saison pour « {title} » ({numero_raw!r})", file=sys.stderr)
        else:
            # Repli sur l'ordre d'apparition dans la page (rencontré sur "Le Chevalier
            # errant", S3E1, dont le numéro Wikipédia est "201" au lieu de "201 (3.1)").
            episode_num = next_episode_num
            print(f"  [!] Livre {season} : numéro non parenthésé pour « {title} » ({numero_raw!r}) "
                  f"-> déduit épisode {episode_num} par ordre d'apparition, à vérifier", file=sys.stderr)
        next_episode_num = episode_num + 1

        channel_field = fields.get("Première diffusion") or []
        if isinstance(channel_field, str):
            channel_field = [channel_field]
        channels = [c.split(":")[-1].strip() for c in channel_field if c]
        channel = ", ".join(dict.fromkeys(channels)) or None  # dédoublonne en conservant l'ordre

        guests = fields.get("Invités") or []
        if isinstance(guests, str):
            guests = [guests]

        summary = fields.get("Résumé détaillé")
        if isinstance(summary, list):
            summary = " ".join(summary)

        episodes.append({
            "id": f"s{season}e{episode_num:02d}",
            "season": season,
            "episode": episode_num,
            "title": title,
            "summary": summary,
            "channel": channel,
            "director": fields.get("Réalisation"),
            "writer": fields.get("Scénario"),
            "guests": guests,
            "video_id": video_id,
            "start_seconds": None,
            "timestamp_source": None,
            "confidence": None,
        })

    episodes.sort(key=lambda e: e["episode"])
    return episodes


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for season, url, video_id in SEASONS:
        print(f"Livre {season} : téléchargement de {url}")
        html = fetch(url)
        episodes = parse_season(season, html, video_id)

        expected = {1: 100, 2: 100, 3: 100, 4: 99}.get(season)
        status = "OK" if expected is not None and len(episodes) == expected else "À VÉRIFIER"
        print(f"  -> {len(episodes)} épisodes extraits (attendu ~{expected}) [{status}]")

        out_path = OUTPUT_DIR / f"livre-{season}.json"
        out_path.write_text(
            json.dumps(episodes, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"  -> écrit dans {out_path.relative_to(OUTPUT_DIR.parent.parent)}")


if __name__ == "__main__":
    main()
