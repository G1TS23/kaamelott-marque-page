# Recherche par résumé + personnage + fusion des résultats (issue #16)

## Méthode

Trois axes fusionnés en une seule liste (pattern validé sur une maquette
avant construction — https://claude.ai/code/artifact/2f432b47-3b4e-4b45-8600-41cafe85a4e4,
issue #60) : titre et personnage par **Fuse.js** (chaînes courtes,
vocabulaire fermé — même terrain que le titre, issue #15), résumé par
**BM25** écrit à la main (`site/src/lib/bm25.ts`) — pas d'embeddings, décidé
en amont : un paragraphe se classe par fréquence de terme, pas par distance
d'édition, et un modèle sémantique aurait coûté ~141 Mo à charger/héberger
pour un gain non démontré face au lexical (voir issue #60).

- `creerIndexResumes(episodes)` / `chercherParResume(index, requete)` : BM25
  sur `summary`, `site/src/lib/recherche.ts`.
- `creerIndexPersonnages(episodes)` / `chercherParPersonnage(index, requete)` :
  Fuse sur `characters` (champ array, géré nativement par Fuse).
- `chercherEpisodes(indexTitres, indexPersonnages, indexResumes, requete)` :
  fusionne les trois, déduplique par épisode, trie par score combiné.

**Constantes BM25** (`k1 = 1.5`, `b = 0.75`) : valeurs usuelles d'Okapi BM25,
pas encore raffinées empiriquement contre de vraies requêtes — contrairement
au seuil Fuse.js du titre (qc-recherche-titre.md), aucune campagne de
réglage n'a encore été menée. À faire une fois des retours d'usage réels
disponibles.

**Poids de fusion** (`POIDS_TITRE = 3`, `POIDS_PERSONNAGE = 2`,
`POIDS_RESUME = 3`) : titre et personnage pondérés par `1 - score Fuse`
(0 = parfait), résumé normalisé min-max sur le lot courant (BM25 n'est pas
borné). Choix repris de la maquette, pas encore mesurés contre de vraies
requêtes non plus.

**Personnage dans la recherche** : révise SPECS.md section 5, qui disait
`characters` hors recherche (facette #61 uniquement, orthogonale). Décidé en
conversation (issue #60) que les deux coexistent : la facette combinable en
ET reste à construire (#61), la recherche libre gagne un raccourci direct
par nom.

## Données

`site/src/pages/recherche.json.ts` sert `{ id, summary, characters }` pour
les 399 épisodes à part du HTML initial (`EpisodeListe` ne les contient
pas — ~300 Ko évités tant que personne ne cherche). Récupéré une fois au
montage de l'îlot (`Site.svelte`, `$effect`) ; la recherche par titre reste
utilisable seule le temps du fetch. Mesuré au build : **148 Ko** bruts,
**~46 Ko gzippés**.

## Comportement dans l'îlot

Le panneau de résultats (`ResultatsRecherche.svelte`) remplace l'ancien
mécanisme où la recherche par titre substituait le sommaire en place
(issue #15) : desktop, un panneau flottant ancré au champ (largeur minimale
32rem, supérieure au champ qui peut descendre à 65 % de sa colonne, aligné
sur son bord droit — demande explicite) ; mobile, plein écran dans
`RechercheMobile.svelte`. `Sommaire.svelte` ne montre plus jamais que le
livre actif.

Une ligne = numéro + titre + indication de ce qui a matché (`titre`,
`personnage`, `résumé`, combinables) — pas de panneau groupé par catégorie,
pas de détail sous le titre (retours d'usage successifs sur la maquette).
Un clic referme le panneau desktop (`requete` vidée) — contrairement à
l'ancien comportement où les résultats de titre restaient affichés une fois
un épisode choisi.

## Vérifié sur la preview

- « myrtilles » → « Les Tartes aux myrtilles » en tête, étiqueté
  `titre · résumé` (le mot apparaît dans les deux).
- « Leodagan » (sans accent) → une trentaine d'épisodes, tolérance Fuse sur
  le nom, mélange `personnage` seul et `personnage · résumé` selon que le
  nom apparaît aussi dans le résumé — le panneau scrolle proprement
  (`max-height: 70vh`).
- Clic sur un résultat → lecture immédiate, onglet basculé sur le bon livre,
  panneau refermé.
- Mobile (390px) → même liste, pleine largeur, aucun débordement horizontal.

### Faux positif observé : tolérance à la faute et collision fortuite

« empile des piques » (l'exemple de SPECS.md section 1) ramène un résultat
inattendu : **« Le Temps des Secrets »** (Livre 2, épisode 96), dont le
résumé contient « lui **piquer** sa femme ». `piques` → `piquer` est à
distance de Levenshtein 1 (substitution du dernier caractère), donc corrigé
par tolérance — un comportement voulu pour les vraies fautes de frappe, mais
qui produit ici une collision fortuite entre deux mots sans rapport de sens.
« empile » lui-même ne matche toujours rien nulle part (confirmé : absent
des 399 résumés). Pas un bug — la limite documentée du lexical face à une
paraphrase, juste plus visible que prévu à cause de cette coïncidence
orthographique précise.

## Limites connues

- `k1`/`b` et les poids de fusion sont des valeurs par défaut, pas réglées
  empiriquement (voir « Méthode » ci-dessus) — à revoir avec de vrais
  retours d'usage, comme le seuil Fuse.js du titre l'a été.
- Aucun score minimum sur les résultats résumé (`score > 0` suffit) : un
  seul mot corrigé par tolérance peut faire apparaître un résultat par
  ailleurs sans rapport (voir l'exemple ci-dessus). Un seuil minimum est une
  piste de réglage future, pas encore posée faute de recul sur de vraies
  requêtes.
- Liste de mots vides français courte, pas une ressource linguistique
  complète (`site/src/lib/bm25.ts`).
- Recherche par acteur et par réplique toujours hors scope (données
  incomplètes / issue #45 post-v1) — voir issue #60.
