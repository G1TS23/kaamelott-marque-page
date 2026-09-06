# Casting par épisode — Wiki Kaamelott (Fandom)

Complément à `docs/qc-characters.md` : le [Wiki Kaamelott Officiel](https://kaamelott.fandom.com/fr) donne un casting exact par épisode (tableau « Distribution » : personnage ↔ acteur), une source bien plus fiable que le matching heuristique (guests + mots-clés dans le résumé) quand elle est disponible.

## Contrainte technique : pas un script Python standalone

Le domaine `kaamelott.fandom.com` est derrière une protection Cloudflare (`cf-mitigated: challenge`) qui bloque `curl`/`requests` même avec un User-Agent de navigateur (403 systématique). Seul un vrai navigateur passe. Le scraping a donc été fait **manuellement, en JavaScript exécuté dans l'onglet du navigateur** (déjà authentifié côté Cloudflare), via l'API MediaWiki interne du wiki (`/fr/api.php?action=parse&prop=wikitext`), accessible en `fetch()` same-origin depuis la page.

Ce n'est pas reproductible par une simple commande (`python scripts/xxx.py`) tant que cette contrainte existe — à documenter si une automatisation complète est souhaitée plus tard (ex. Playwright/Selenium avec un vrai navigateur piloté).

## Couverture réelle (bien plus faible qu'espéré)

| Livre | Épisodes avec casting Fandom | Sur |
|---|---|---|
| I | 74 | 100 |
| II | 14 | 100 |
| III | 6 | 100 |
| IV | 6 | 99 |
| **Total** | **100** | **399 (25 %)** |

Très concentré sur le Livre I (le plus ancien, le plus édité par la communauté). Les épisodes sans page Fandom complète (page inexistante ou infobox sans le champ personnages) gardent le résultat de l'heuristique existante — voir `characters_source` dans le schéma (`"fandom"` ou `"heuristic"`).

## Anomalies trouvées et corrigées

- **Noms d'acteurs dans le champ personnages** : l'épisode 98 du Livre II avait par erreur "Alexandre Astier", "Bruno Salomone", "Franck Pitiot" mélangés aux vrais personnages — exclus explicitement (`NOT_CHARACTERS` dans `scripts/merge_fandom_characters.py`).
- **Variantes de noms à unifier** : le Fandom utilise parfois le nom complet là où Wikipédia/l'heuristique utilise le nom court (« Arthur Pendragon » vs « Arthur », « Lancelot du Lac » vs « Lancelot », etc.) — une table d'alias (13 entrées) normalise vers la forme déjà utilisée ailleurs dans les données, pour qu'un même personnage ne se retrouve pas sous deux graphies différentes selon l'épisode (ce qui casserait le filtre par personnage, issue #24).
- **Collision titre d'épisode / nom de personnage** : « Le Maître d'armes » est à la fois un épisode et le nom d'un personnage — une résolution naïve par recherche (`opensearch`) tombait parfois sur la page du personnage au lieu de l'épisode. Résolu en extrayant les titres d'épisodes directement depuis la liste structurée de la page « Livre N » plutôt que par recherche floue titre par titre.

## Résultat

- 100/399 épisodes ont désormais un casting exact (`characters_source: "fandom"`)
- 298/399 gardent le résultat heuristique (`characters_source: "heuristic"`)
- 1/399 reste sans personnage détecté (s3e49 « La Révolte II », résumé générique sans nom propre — vs 3/399 avant la fusion Fandom)
- Aucune régression : les 2 autres épisodes auparavant vides (s1e76, s2e01) sont maintenant couverts par le Fandom
