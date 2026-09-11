# Bascule d'onglet sur un résultat cross-livre (issue #18)

## Méthode

Suite directe de #15 : `onEpisodeClick` (`Site.svelte`) fixe désormais
`livreActif = livre` avant de jouer l'épisode, quel que soit le livre du
résultat cliqué. `allerA` charge déjà la bonne vidéo à la bonne position,
peu importe ce que le lecteur affichait.

## Découplage onglet / recherche / lecteur (retour d'usage)

Testé en conditions réelles, deux problèmes sont remontés — en fait un seul
défaut de conception vu sous deux angles :

- Lire un épisode via la recherche puis cliquer un **autre** onglet coupait
  la lecture en cours (l'onglet recadrait le lecteur sur le nouveau livre).
- Cliquer un onglet après une recherche ne montrait pas le sommaire de ce
  livre : la recherche restait active, donc les résultats (potentiellement
  d'un troisième livre) restaient affichés à la place.

Cause commune : l'onglet pilotait à la fois « quelle liste j'affiche » et
« quelle vidéo est chargée », un rôle double qui ne posait pas de problème
tant que lecture et navigation coïncidaient toujours — ce qui a cessé d'être
vrai dès que la recherche globale (#15) a permis de lire un épisode d'un
livre différent de celui affiché.

**Résolu en séparant les trois responsabilités** (détail dans le commentaire
en tête de `Site.svelte`) :
- `onLivreChange` (clic d'onglet) : change `livreActif` **et vide `requete`**
  — un onglet dit « montre-moi ce livre », jamais « garde mes résultats ».
  Ne touche plus au lecteur.
- `onEpisodeClick` (clic sur un épisode, sommaire ou résultat) : inchangé,
  seul point de contact avec le lecteur.
- `Lecteur.choisirLivre` supprimée (`Lecteur.svelte`, `lecteur.ts`) : devenue
  sans appelant, et avec elle tout le chemin `charge: false` déclenché par un
  changement d'onglet — `charge: false` ne représente plus que l'état initial
  juste après le montage.

**Nouveau repère visuel** : une pastille rouge pulsante (« en direct »,
`--alerte`) sur l'onglet du livre en cours de lecture, visible seulement
quand il diffère de l'onglet affiché — pour ne pas perdre le fil de ce qui
joue en parcourant un autre livre. Couleur fixe (rouge) plutôt que dérivée de
l'état « affiché »/« pas affiché » de l'onglet : un repère « en direct » qui
changerait de couleur selon le contexte serait plus dur à reconnaître d'un
coup d'œil. Alignement vertical assuré par `display: inline-flex` sur le
bouton d'onglet (remplace les marges bricolées sur la pastille et le
compteur).

## Vérifié sur la preview locale

- Recherche « table » depuis l'onglet Livre 1 → résultats « La Table de
  Breccan » (Livre 1) et « L'Art de la table » (Livre 4).
- Clic sur « L'Art de la table » → l'onglet bascule sur **Livre 4**, le
  sous-titre confirme « Allez, c'est parti. Épisode 33. », la ligne du
  résultat est mise en évidence.
- Recherche effacée → sommaire du **Livre 4**, épisode 33 toujours mis en
  évidence.
- **Découplage** : recherche « matin » → clic sur « Tous les matins du monde
  1re partie » (Livre 4) → clic sur l'onglet **Livre 2** → confirmé par
  instrumentation (interception de `cueVideoById`/`loadVideoById`/`seekTo`/
  `playVideo`/`pauseVideo`/`stopVideo`) : **aucun appel au lecteur** suite au
  clic d'onglet, vidéo et position inchangées. Visuellement : recherche
  vidée, sommaire du Livre 2 affiché, pastille sur l'onglet Livre 4.

## Retour d'usage sur la pastille

Deux ajustements après premier essai :
- **Alignement** : la pastille en `display: inline-block` + marge ne se
  centrait pas verticalement avec le texte de l'onglet. Fixé en passant le
  bouton d'onglet en `display: inline-flex; align-items: center; gap` —
  alignement garanti par le flex plutôt que dépendant des métriques de la
  police, marges manuelles retirées (pastille et compteur).
- **Rouge pulsant plutôt qu'accent statique** : `--accent` (l'ocre utilisé
  pour l'onglet affiché) se confondait avec ce vocabulaire existant. Un point
  rouge (`--alerte`) avec un anneau qui irradie en boucle (`::before` animé,
  `cubic-bezier` + `scale`/`opacity`) reprend le langage visuel habituel d'un
  indicateur « en direct », sans dépendre d'une couleur déjà prise par autre
  chose. `prefers-reduced-motion: reduce` coupe l'animation.

Un troisième retour après ces deux corrections : l'espace entre le point et
le bord du badge (15px, le `padding` du bouton) ne correspondait pas à
l'espace entre le point et le texte (4px, le seul `gap` du flex) —
asymétrique. Mesuré précisément dans le navigateur plutôt que deviné
(`getBoundingClientRect` de part et d'autre du point). Corrigé avec
`margin-right: calc(var(--esp-3) - var(--esp-1))` sur la pastille : le
complément exact pour que `gap + marge` égale le `padding` du bouton. Les
deux espaces mesuraient alors 15px et 14px.

## Simplification des onglets (retour d'usage)

Trois retours groupés, un seul changement de fond :

- Le nombre d'épisodes par livre (`<span class="compte">`, ex. « 100 ») sur
  chaque onglet n'apporte rien — retiré.
- L'espace autour du point pouvait revenir à sa taille naturelle : le
  `margin-right` de compensation du retour précédent (qui égalait le `gap`
  au `padding` du bouton, ~15px) redevient simplement le `gap` du bouton
  (4px), maintenant que le compteur qui justifiait ce calage a disparu.
- **Le vrai changement** : la pastille est désormais **toujours rendue**
  (transparente si le livre ne joue pas), plutôt que montée/démontée par un
  `{#if}`. Le `{#if}` faisait varier la largeur de l'onglet selon qu'un
  livre y joue ou non — un livre qui commence ou arrête de jouer déplaçait
  tous les onglets suivants. Réservée en permanence, la pastille garde une
  largeur d'onglet strictement constante ; seule sa couleur et l'anneau
  animé basculent via une classe `pastille-active`. Le texte affiché à
  l'écran, lui, reste conditionnel (`{#if}` sur le seul `sr-only`) : pas de
  fausse annonce « en cours de lecture » aux lecteurs d'écran sur un onglet
  inactif.

Vérifié : `getBoundingClientRect().width` des 4 onglets, mesuré avant et
après le déclenchement de la pastille — identique au dixième de pixel près
(95.1px) dans les deux cas. Les 4 livres se numérotant 1 à 4 (un seul
chiffre), les onglets font maintenant tous exactement la même largeur.

## Repositionnement de la pastille (retour d'usage)

Le montage `gap` ci-dessus corrigeait la symétrie par des marges de
compensation (un calage sur les valeurs, pas sur leur cause). Trois derniers
retours, exploités sur plusieurs variantes comparées côte à côte avant de
choisir, ont mené à une construction différente plutôt qu'à un nouveau
réglage :

- « Un livre est plus grand à gauche (placeholder du point) et l'espace
  autour du point n'est toujours pas symétrique » — un point dans le flux,
  quel que soit le `gap`/`margin`, ne peut pas garantir en même temps une
  largeur d'onglet fixe, un padding symétrique autour du texte *et* un
  espacement égal des deux côtés du point : ce sont trois contraintes sur
  une seule dimension (le flux horizontal), sans degré de liberté pour les
  satisfaire toutes.
- « La largeur du badge ne doit pas changer avec ou sans le point » (déjà
  acquis ci-dessus) et « même padding autour du texte, avec ou sans point ».
- « Le nombre d'épisodes n'a pas d'utilité » (déjà traité ci-dessus).

**Résolu en sortant le point du flux** : `.pastille` passe en
`position: absolute`, centrée dans le padding gauche du bouton (`--esp-4`,
20px, porté de 14px pour lui laisser de la place) plutôt que d'être un
élément du flex qui pousse le texte. Le texte démarre alors toujours au
même padding-left, jamais décalé par la pastille ; la largeur de l'onglet
ne dépend plus de sa présence ; et l'espacement de chaque côté du point est
symétrique par construction (`calc((--esp-4 - largeur du point - bordure) /
2)`), pas par coïncidence de valeurs qu'un futur changement pourrait
recasser. La hauteur de l'onglet (22.4px, plutôt que déduite du padding
vertical + line-height hérité) a suivi pour laisser au point (8px) assez de
marge sans être à l'étroit.

Comparé plusieurs variantes (point dans le padding vs différentes valeurs de
`gap`/`margin`) avant de choisir celle-ci — mesuré dans le navigateur plutôt
que deviné : largeurs des 4 onglets identiques, padding symétrique (21px des
deux côtés), espacement symétrique autour du point (6.5px des deux côtés).

L'anneau qui irradie a aussi été retouché deux fois sur retour d'usage :
d'abord un bug d'implémentation (le `::before` de l'anneau ne reprenait pas
la nouvelle taille du point après son agrandissement à 8px, avec une
position/taille par défaut qui le plaquait au coin haut-gauche du point au
lieu de le centrer — corrigé en alignant explicitement sa taille sur celle
du point) ; puis un ajustement de goût (rayon max de l'anneau réduit de
2.8× à 2.4× le rayon du point, jugé trop imposant à 2.8×).

## Limites connues

Lecture non vérifiable en navigateur automatisé (autoplay bloqué), seule la
position de chargement et l'absence d'appel au lecteur le sont — cf. #14.
