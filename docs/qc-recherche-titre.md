# Recherche par titre + épisode en cours (issue #15)

## Méthode

Recherche floue sur `title`, globale aux 4 livres (specs section 5), via
**Fuse.js 7.5.0** (épinglé). La logique testable est dans
`site/src/lib/recherche.ts` ; le composant ne fait que l'afficher.

- `creerIndexTitres(episodes)` : un `Fuse` sur les ~400 titres, construit une
  fois au montage de l'îlot.
- `chercherParTitre(index, requete)` : résultats triés par pertinence.
  Requête vide ou d'un seul caractère → `[]`.

**Options Fuse retenues** :

| Option | Valeur | Pourquoi |
|---|---|---|
| `keys` | `['title']` | seul le titre pour ce mode (le résumé, c'est #16) |
| `ignoreLocation` | `true` | titres courts : une correspondance au milieu vaut celle du début |
| `threshold` | `0.3` | voir « Réglage du seuil » ci-dessous |
| `minMatchCharLength` | `2` | pas de match sur une lettre isolée |

### Réglage du seuil (retour d'usage)

`0.4` (valeur initiale) était beaucoup trop permissif : « hea » ramenait
**49 résultats** contre les vrais titres, dont des titres sans rapport
(« Le Porte-bonheur », « Haunted », « Feu l'âne de Guethenoc »). Réglé
empiriquement contre les 399 vrais titres (script jetable, pas commité) avec
un jeu de requêtes courtes et de fautes réelles :

| Seuil | « hea » | « table » | « tarte au myrtille » |
|---|---|---|---|
| 0.4 / 0.35 | 49 résultats | 44 résultats | 1 (bon) |
| **0.3 → 0.13** | **1 (Heat)** | **2 (bons)** | **1 (bon)** |
| 0.11 | 1 (Heat) | 2 (bons) | 0 — la faute cesse de matcher |

Le plateau `[0.13, 0.3]` donne des résultats identiques et propres sur toutes
les requêtes testées (courtes, accents omis, fautes réelles, multi-mots).
`0.3` prend la marge haute de ce plateau : le plus de tolérance aux fautes
sans retomber dans le bruit du seuil précédent.

## Comportement dans l'îlot

`Site.svelte` possède `requete`, `livreActif` et `episodeActif` ; il calcule
`resultats = requete.trim() ? chercherParTitre(...) : null`.

| `resultats` | Affiché |
|---|---|
| `null` | sommaire du livre actif |
| `[]` | « Aucun épisode ne correspond à « … ». » — la passerelle #17 s'y branchera |
| non vide | résultats des 4 livres, chacun avec un badge « Livre N » |

Un clic sur un résultat joue le bon épisode (`Lecteur.allerA`) et bascule
l'onglet sur son livre (issue #18) : le sommaire retrouve le bon livre une
fois la recherche effacée.

`episodeActif` = le dernier épisode cliqué (#14 ne fournit pas d'événement
« je suis rendu à l'épisode N » ; #56 l'affinera). La ligne correspondante
est mise en évidence dans le sommaire **si son livre est l'onglet affiché**,
avec le même vocabulaire visuel que l'onglet actif (`--accent-voile` /
`--accent-fort` + filet gauche `--accent`).

## Vérifié sur la preview

- « tarte au myrtille » (pluriel manquant, « au » pour « aux ») → « Les Tartes
  aux myrtilles » (Livre 1).
- « table » → « La Table de Breccan » (Livre 1), « L'Art de la table »
  (Livre 4) — résultats multi-livres, badgés.
- Clic sur un résultat → l'épisode se charge à la bonne position (sous-titre
  « Ah allez, épisode 3. » pour « La Table de Breccan », épisode 3), ligne
  mise en évidence.
- Effacer la recherche → retour au sommaire, l'épisode en cours reste mis en
  évidence.
- « zzzxxxqqq » → message « aucun résultat ».
- « hea » → uniquement « Heat » (avant le réglage du seuil : 49 résultats,
  voir ci-dessus).

*(Lecture non vérifiable dans le navigateur automatisé — autoplay YouTube
bloqué ; seule la position de chargement est contrôlée.)*

## Limites connues

- Pas de debounce : 400 titres, Fuse est instantané à chaque frappe.
- Pas de surlignage des caractères correspondants dans le résultat (Fuse
  peut le fournir via `includeMatches`, non exploité ici).
