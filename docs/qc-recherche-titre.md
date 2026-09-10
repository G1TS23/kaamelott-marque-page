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
| `threshold` | `0.4` | ~une faute ou deux tolérées sans ramener la moitié du catalogue |
| `minMatchCharLength` | `2` | pas de match sur une lettre isolée |

## Comportement dans l'îlot

`Site.svelte` possède `requete`, `livreActif` et `episodeActif` ; il calcule
`resultats = requete.trim() ? chercherParTitre(...) : null`.

| `resultats` | Affiché |
|---|---|
| `null` | sommaire du livre actif |
| `[]` | « Aucun épisode ne correspond à « … ». » — la passerelle #17 s'y branchera |
| non vide | résultats des 4 livres, chacun avec un badge « Livre N » |

Un clic sur un résultat joue le bon épisode (`Lecteur.allerA`). La bascule
d'onglet sur un résultat d'un autre livre est **laissée à #18** : entre-temps
l'onglet peut rester sur son livre, le lecteur joue quand même le bon.

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

*(Lecture non vérifiable dans le navigateur automatisé — autoplay YouTube
bloqué ; seule la position de chargement est contrôlée.)*

## Limites connues

- `threshold: 0.4` laisse passer des correspondances faibles en bas de liste
  (« Létal » remonte sur « table » : t/a/l partagés). Ranked dernier, sans
  gravité ; c'est le curseur à bouger si le flou gêne à l'usage.
- Pas de debounce : 400 titres, Fuse est instantané à chaque frappe.
- Pas de surlignage des caractères correspondants dans le résultat (Fuse
  peut le fournir via `includeMatches`, non exploité ici).
