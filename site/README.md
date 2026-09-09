# Site — Le Marque-Page de la Relecture

Front-end du projet (milestone 4). Astro + Svelte, statique, sans serveur ni
base de données (`docs/SPECS.md` section 7).

## Lancer

```bash
cd site
npm install
npm run dev      # http://localhost:4321
npm run build    # sortie statique dans site/dist/
npm run preview  # sert le build
```

## Données

Le site **ne duplique pas** les données : `src/lib/episodes.js` importe
directement `data/episodes/livre-{1..4}.json` à la racine du dépôt, produits
par le pipeline Python (milestones 1 à 3). Les imports sont résolus par Vite
au build, donc rien n'est lu au runtime.

Conséquence : régénérer les données (`scripts/merge_timestamps.py`) suffit,
il n'y a pas d'étape de copie ni de synchronisation à penser.

Le chargeur **échoue au build** si un livre n'a pas son compte d'épisodes
attendu, ou si un épisode n'a pas de `start_seconds` — servir un site où un
épisode ne mène nulle part serait pire qu'un build rouge.

## Structure

| Chemin | Rôle |
|---|---|
| `src/pages/index.astro` | Page unique (specs section 6 : un seul lecteur, pas de mur de vignettes) |
| `src/layouts/Base.astro` | Coquille HTML + styles globaux (variables de thème, clair/sombre) |
| `src/lib/episodes.js` | Chargement et garde-fous des données, au build |
| `src/components/*.svelte` | Îlots interactifs, hydratés côté client |

Astro pré-rend le HTML au build (le sommaire est lisible sans JavaScript) et
n'hydrate que les îlots Svelte. Svelte plutôt que React parce que la
recherche sémantique embarquera déjà un modèle de 25-50 Mo (specs section 7) :
autant que le reste du bundle reste marginal.
