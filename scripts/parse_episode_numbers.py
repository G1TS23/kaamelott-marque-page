"""Détecte, dans la transcription automatique YouTube, le numéro d'épisode
annoncé à voix haute par Shisheyu ("épisode 42") et le timestamp associé
(docs/SPECS.md section 3, piste C).

Les sous-titres auto-générés YouTube sont au format "roulant" : chaque cue
réaffiche le texte précédent en y ajoutant un mot, avec un timestamp par mot
intégré dans des balises <HH:MM:SS.mmm><c>...</c>. Sans nettoyage, un même mot
apparaît dans de nombreuses cues consécutives. On déduplique en indexant par
(timestamp, mot) : la même paire réapparaît à l'identique d'une cue à l'autre,
donc l'insérer plusieurs fois dans un dict est sans effet.

Usage: python scripts/parse_episode_numbers.py [chemin_vtt]
"""

import re
import sys
from pathlib import Path

DEFAULT_VTT = Path(__file__).resolve().parent.parent / "data" / "transcripts" / "livre-1.fr.vtt"

_CUE_TIME_RE = re.compile(
    r"^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> \d{2}:\d{2}:\d{2}\.\d{3}", re.MULTILINE
)
_WORD_TIME_RE = re.compile(r"<(\d{2}):(\d{2}):(\d{2})\.(\d{3})>")
_TAG_RE = re.compile(r"</?c>")

_EPISODE_RE = re.compile(r"\b[ée]pisode\s+(\d+)\b", re.IGNORECASE)


def _to_seconds(h, m, s, ms) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_vtt_words(vtt_text: str) -> dict[float, str]:
    """Renvoie {timestamp_secondes: mot}, dédupliqué."""
    words_by_time: dict[float, str] = {}

    blocks = vtt_text.split("\n\n")
    for block in blocks:
        cue_match = _CUE_TIME_RE.search(block)
        if not cue_match:
            continue
        cue_start = _to_seconds(*cue_match.groups())

        # texte du bloc (après la ligne d'en-tête temporelle)
        text = block[cue_match.end():]

        # découpe sur les timestamps mot-à-mot ; le premier segment (avant le
        # premier timestamp inline) part du timestamp de la cue elle-même
        parts = _WORD_TIME_RE.split(text)
        # parts alterne : [texte_avant, h, m, s, ms, texte_suivant, h, m, s, ms, ...]
        first_chunk = _TAG_RE.sub("", parts[0]).strip()
        if first_chunk:
            words_by_time[cue_start] = first_chunk

        i = 1
        while i + 4 < len(parts):
            h, m, s, ms = parts[i:i + 4]
            current_time = _to_seconds(h, m, s, ms)
            chunk = _TAG_RE.sub("", parts[i + 4]).strip()
            if chunk:
                words_by_time[current_time] = chunk
            i += 5

    return words_by_time


def find_episode_mentions(words_by_time: dict[float, str]) -> list[tuple[float, int]]:
    """Reconstruit un texte continu ordonné par timestamp, cherche "épisode N",
    et retrouve le timestamp du mot "épisode" correspondant."""
    ordered = sorted(words_by_time.items())
    full_text = " ".join(word for _, word in ordered)

    # position (en caractères) -> timestamp du mot à cette position
    positions = []
    cursor = 0
    for t, word in ordered:
        positions.append((cursor, t))
        cursor += len(word) + 1  # +1 pour l'espace séparateur

    mentions = []
    for match in _EPISODE_RE.finditer(full_text):
        episode_num = int(match.group(1))
        # timestamp du mot contenant le début du match ("épisode")
        start = match.start()
        t = next((t for pos, t in reversed(positions) if pos <= start), ordered[0][0])
        mentions.append((t, episode_num))

    return mentions


def main():
    vtt_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_VTT
    if not vtt_path.is_file():
        sys.exit(f"Fichier introuvable : {vtt_path}")

    print(f"Lecture de {vtt_path}...")
    text = vtt_path.read_text(encoding="utf-8")

    words_by_time = parse_vtt_words(text)
    print(f"  -> {len(words_by_time)} mots horodatés uniques après déduplication")

    mentions = find_episode_mentions(words_by_time)
    print(f"\n{len(mentions)} mentions de \"épisode N\" trouvées :\n")
    for t, num in mentions:
        mins, secs = divmod(t, 60)
        print(f"  {int(mins):3d}:{secs:05.2f}  ->  épisode {num}")

    numbers = [n for _, n in mentions]
    print(f"\nNuméros trouvés (ordre d'apparition) : {numbers}")
    duplicates = [n for n in set(numbers) if numbers.count(n) > 1]
    if duplicates:
        print(f"Numéros mentionnés plusieurs fois : {duplicates}")


if __name__ == "__main__":
    main()
