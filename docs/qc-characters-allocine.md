# Casting par épisode — AlloCiné (enrichissement)

Complément à `docs/qc-characters.md` et `docs/qc-characters-fandom.md`. Les pages de casting AlloCiné par saison (`/series/ficheserie-334/casting/saison-N/`) listent, pour les rôles secondaires/récurrents, le nombre exact d'épisodes et leurs numéros — l'inverse du Fandom (qui donne le casting complet d'un épisode, pas la liste des épisodes d'un personnage).

Contrairement au Wiki Kaamelott, **pas de blocage Cloudflare** — accessible en `requests`/`curl` classique, donc un vrai script Python standalone (`scripts/scrape_allocine_cast.py`), reproductible.

## Bug trouvé et corrigé pendant l'implémentation

Le texte de chaque ligne est de la forme `- 7 Episodes : 20 - 28 - 57 - ...`. Une première extraction par simple regex `\d+` sur tout le texte capturait aussi le **7** (le compte d'épisodes) comme s'il s'agissait d'un numéro d'épisode. Corrigé en ne parsant que la partie après le `:`.

## Méthode

1. Scraping des 4 pages de casting (`scripts/scrape_allocine_cast.py`) → `data/allocine_raw/livre-{1..4}.json` (personnage + liste d'épisodes)
2. Dérivation du nom court comme pour `build_characters.py`, mais avec une amélioration : comparaison **normalisée** (accents/casse neutralisés) contre `data/characters.json` avant tout découpage, pour absorber les variantes de graphie (« Azenor »/« Azénor », « L'Ankou »/« l'Ankou », « Le Maître D'armes »/« Le maître d'armes ») sans entretenir une liste d'exceptions casse-par-casse
3. Fusion en **union** dans `characters` (`scripts/merge_allocine_characters.py`) — ajoute, n'écrase jamais, quel que soit `characters_source`

## Résultat

| Livre | Personnages avec épisodes précis | Ajouts dans `characters` |
|---|---|---|
| I | 29 | 16 |
| II | 26 | 87 |
| III | 33 | 85 |
| IV | 30 | 82 |
| **Total** | **118** | **270** |

Effet notable : **le dernier épisode sans personnage détecté (s3e49) est maintenant couvert** — 0/399 épisode vide (contre 1/399 après le seul apport Fandom, 3/399 avec l'heuristique seule).

## Limites connues

- 5 noms trouvés ne correspondent à aucune entrée de `data/characters.json` (personnages mineurs jamais ajoutés à la liste canonique : Aziliz, Tumet, L'esclave affranchie, L'homme en noir, l'évêque de Germanie) — conservés tels quels dans `characters`, sans être ajoutés au fichier canonique (pas nécessaire, ils servent déjà leur but dans les épisodes concernés).
- Les rôles principaux (Arthur, Léodagan, etc.) n'ont pas de détail par épisode sur ces pages — attendu, ils sont déjà couverts par le Fandom/l'heuristique.
