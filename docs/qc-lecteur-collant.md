# Lecteur collant au scroll (issue #54)

## Constat

Retour d'usage post-#14 : en parcourant un long sommaire, le lecteur sort du
champ et on perd le contexte de ce qu'on écoute (specs section 6, « Lecteur —
persistant » — pas encore vrai jusqu'ici).

## Premier essai, abandonné

Une première version faisait juste coller `.cadre` (`Lecteur.svelte`) en
`position: sticky; top: 0`, réduit en mini-lecteur aligné à droite sous
640px. Retour d'usage après coup, plusieurs griefs d'un coup :

- le lecteur en pleine taille collé prenait trop de place à l'écran ;
- tout ce qu'il y avait en dessous (recherche, onglets, sommaire)
  disparaissait d'un coup, sans transition ni cohérence ;
- la recherche et les onglets devenaient inaccessibles pendant le scroll ;
- collé pile au bord de la fenêtre, sans marge ;
- le nom du site disparaissait sans être remplacé par rien.

Plutôt que de corriger ces griefs un par un en s'usant en allers-retours sur
la vraie PR, direction comparée sur plusieurs maquettes interactives
(artifact de développement, pas une capture figée) avant de choisir : lecteur
flottant seul, bandeau condensé, lecteur+onglets réduits ensemble, aucun
lecteur collant du tout — puis des mélanges. Direction retenue, détaillée
ci-dessous.

## Méthode retenue

Deux éléments collants séparés, pas un seul :

**En-tête** (`Site.svelte`, `.entete-collante`) — nom du site (« Marque-Page »,
version courte) et champ de recherche, `position: sticky; top: 0`, toujours
collée dès le chargement de la page (comme YouTube) : plus besoin d'attendre
un scroll pour les retrouver.

**Groupe lecteur + onglets** (`Site.svelte`, `.groupe-collant`) —
`position: sticky; top: calc(3rem + var(--esp-2))` : juste sous l'en-tête,
avec une marge visible plutôt que plaqué au bord. Une fois réellement collé,
le lecteur (`Lecteur.svelte`, prop `reduit`) se réduit à `6rem` de large
(`width`, pas `max-width` : dans le `display: flex` du groupe, la taille doit
changer pour de vrai) — `aspect-ratio: 16 / 9` reste intact, donc pas de
recadrage, juste une réduction proportionnelle. Les onglets
(`Onglets.svelte`, extrait de l'ex-`SelecteurLivre.svelte` pour que les deux
soient des frères DOM directs) suivent juste en dessous. Un repère textuel
(« Livre *N* · *Titre* ») apparaît à côté du lecteur réduit — absent au
repos, pas la peine de dupliquer une info déjà lisible en plein format.

`position: sticky` ne signale jamais lui-même qu'il colle réellement :
technique standard reprise du premier essai, une sentinelle sans contenu
juste avant `.groupe-collant`, observée par un `IntersectionObserver`.
`rootMargin: '-56px 0px 0px 0px'` décale la zone d'observation du même
montant que le `top` du groupe (hauteur de l'en-tête + marge) — sans ce
décalage la sentinelle sortirait de la zone visible avant même que le groupe
n'atteigne son seuil de collage, et il se réduirait dès le chargement (bug
constaté et corrigé pendant l'exploration : le padding interne du cadre de
démonstration manquait, plaçant la sentinelle trop près du bord).

**Retour en haut au clic sur un épisode** (`Site.svelte`,
`onEpisodeClick`) : `window.scrollTo({ top: 0, behavior: 'smooth' })` —
cliquer un épisode pendant que le groupe est réduit doit ramener le lecteur
en grand, pas juste changer ce qui joue hors champ. Le lecteur ne rétrécit
jamais qu'en apparence de toute façon (son `aspect-ratio` et son
`video_id` ne changent pas avec sa taille), donc remonter suffit à le
montrer « en grand » sans logique d'ouverture séparée.

## Découpage des composants

`SelecteurLivre.svelte` supprimé, remplacé par deux composants :

- `Onglets.svelte` — juste les onglets de livre (pastille « en direct »
  comprise, issue #18), pour pouvoir coller à côté du lecteur réduit.
- `Sommaire.svelte` — juste la liste des épisodes (sommaire ou résultats de
  recherche), inchangée sinon.

`Lecteur.svelte` ne gère plus lui-même sa persistance au scroll : il reçoit
une prop `reduit` décidée par `Site.svelte`, qui colle le lecteur et les
onglets ensemble — la position collante ne peut appartenir qu'à leur parent
commun, pas à l'un des deux frères.

## Vérifié sur le dev server

- **Au repos** : `getComputedStyle(.cadre).width` = pleine largeur (mesuré à
  720px sur la fenêtre de test), pas de réduction avant le seuil de collage.
- **Collé** : après un scroll de ~250px, largeur du cadre réduite à 96px
  (`6rem`), repère « Livre 1 » affiché à côté (pas d'épisode précis tant
  qu'aucun n'a été cliqué).
- **Clic sur un épisode pendant que le groupe est réduit** : le titre du
  repère se met à jour (« Livre 1 · Heat »), la page remonte en douceur,
  `window.scrollY` revient à `0`, le lecteur reprend sa pleine largeur.
- **En-tête** : reste sur une seule ligne (nom du site + recherche), collée
  dès le chargement, avant même tout scroll.

## Hors périmètre

Mise en évidence de l'épisode en cours dans le sommaire (#15, déjà fait),
mini-timeline et indicateur de chargement (#56) — cette issue ne fait que
rendre le lecteur persistant et gérer sa taille au scroll.
