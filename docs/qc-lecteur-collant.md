# Lecteur collant au scroll (issue #54)

## Constat

Retour d'usage post-#14 : en parcourant un long sommaire, le lecteur sort du
champ et on perd le contexte de ce qu'on écoute (specs section 6, « Lecteur —
persistant » — pas encore vrai jusqu'ici).

## Méthode

`.cadre` (`Lecteur.svelte`) passe en `position: sticky; top: 0`. La page
n'a pas de conteneur scrollable dédié (`main` n'a pas d'`overflow`, c'est le
document entier qui défile) : le lecteur se colle donc naturellement au bord
de la fenêtre dès qu'on scrolle assez pour que sa position normale sorte par
le haut.

`position: sticky` ne dit jamais lui-même « je suis en train de coller » —
aucun événement natif pour ça. Technique standard : une sentinelle sans
contenu (`<div class="sentinelle">`, hauteur 1px) juste avant `.cadre`,
observée par un `IntersectionObserver` (`threshold: 0`). Elle sort de la
zone visible pile au moment où `.cadre` commence à coller (les deux ont un
seuil de `0` en haut) ; `collant = !entree.isIntersecting` reflète l'état.
Sert uniquement à activer la mise en page réduite ci-dessous — le lecteur
lui-même ne se soucie pas d'être collé ou non.

## Mini-lecteur sur petit écran

Un lecteur collé en pleine largeur mange trop de hauteur utile pour le
sommaire en dessous sur mobile (piste de l'issue). Sous 640px (premier point
de rupture du site — aucune convention équivalente ailleurs pour l'instant,
le menu déroulant mobile du sélecteur de livre n'existe pas encore), `.cadre`
collé se réduit en mini-lecteur aligné à droite : `max-width: 50%` plutôt que
`width`, pour que `aspect-ratio: 16 / 9` reste intact — la hauteur suit
proportionnellement, pas de recadrage (contrainte explicite de l'issue).
`prefers-reduced-motion` coupe la transition de rétrécissement.

## Vérifié sur le dev server

- **Collant** : après un scroll de 600px, `getComputedStyle(.cadre).position`
  = `sticky` et `getBoundingClientRect().top` = `0` (mesuré, pas juste
  observé visuellement) — le lecteur reste réellement épinglé, pas
  coïncidence de mise en page. `.collant` correctement posé sur `.cadre` au
  même moment.
- **Mini-lecteur mobile** : `resize_window` ne descend pas sous ~810px de
  large dans cet environnement automatisé (fenêtre plafonnée). Le
  déclenchement réel de la media query à 640px n'a donc pas pu être observé
  en conditions réelles ; le rendu du mini-lecteur (largeur réduite, aligné à
  droite, `aspect-ratio` intact, superposé au contenu grâce à `--ombre`) a
  été vérifié en forçant temporairement les styles `.cadre.collant` par une
  feuille de style injectée — confirme le rendu visuel, pas le déclenchement
  par la media query elle-même (mécanisme natif du navigateur, non
  spécifique à ce code).
- **Retour en haut de page** : `collant` repasse à `false` par construction
  (le booléen est la seule negation de `entree.isIntersecting`, pas de
  logique à sens unique) — mais non re-vérifié en direct dans cet
  environnement : l'onglet automatisé tourne avec
  `document.visibilityState === 'hidden'` (fenêtre non composée à l'écran),
  et `IntersectionObserver` — comme `requestAnimationFrame` (déjà rencontré
  sur un autre chantier cette session) — cesse d'être rappelé une fois
  l'onglet en arrière-plan. Un navigateur réel, onglet visible, n'a pas cette
  limite.

## Hors périmètre

Mise en évidence de l'épisode en cours (#15), mini-timeline (#56) — cette
issue ne fait que rendre le lecteur persistant et gérer sa taille au scroll.
