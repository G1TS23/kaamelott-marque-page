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
version courte, remplace le grand titre qui vivait dans `index.astro`) et
champ de recherche, toujours collée dès le chargement de la page (comme
YouTube). `position: fixed` (pas `sticky`) et non confinée à
`--largeur-contenu` : un `sticky` reste contraint à la largeur de son bloc
englobant (`main`, centré et plafonné), alors que l'en-tête doit occuper
toute la largeur de la fenêtre — seul son contenu interne (nom + recherche)
reste aligné sur la colonne du reste du site. `main` compense avec un
padding-top égal à la hauteur de l'en-tête (`calc(3rem + var(--esp-4))`),
sans quoi elle recouvrirait le début du contenu (un `fixed` est retiré du
flux, contrairement à un `sticky`).

**Groupe lecteur + onglets** (`Site.svelte`, `.groupe-collant`) —
`position: sticky; top: calc(3rem + var(--esp-2))` une fois actif
seulement (voir plus bas) : juste sous l'en-tête, avec une marge visible
plutôt que plaqué au bord. Le lecteur (`Lecteur.svelte`, prop `reduit`) se
réduit à `10rem` de large (`width`, pas `max-width` : dans le
`display: flex` du groupe, la taille doit changer pour de vrai) —
`aspect-ratio: 16 / 9` reste intact, donc pas de recadrage, juste une
réduction proportionnelle. Les onglets (`Onglets.svelte`, extrait de
l'ex-`SelecteurLivre.svelte` pour que les deux soient des frères DOM
directs) suivent juste en dessous. Un repère textuel (« Livre *N* · *Titre* »)
apparaît à côté du lecteur réduit — absent au repos, pas la peine de
dupliquer une info déjà lisible en plein format.

## Deuxième retour d'usage

Deux griefs après le premier tour de la nouvelle direction :

- **Lecteur réduit illisible** : `6rem` (96px) ne laissait voir aucun détail
  de l'image — juste une tache. Porté à `10rem` (160px, `Lecteur.svelte`).
- **Se réduisait même sans lecture active** : scroller le sommaire par
  simple curiosité, sans avoir cliqué play, collait quand même un lecteur en
  pleine taille (vignette affichée, ou vidéo en pause) — repris du grief du
  premier essai (« prend trop de place »), juste déplacé. Le vrai besoin de
  #54 est de garder le contexte d'une **lecture en cours**, pas de coller le
  lecteur en toute circonstance.

  Résolu en distinguant deux signaux dans `Site.svelte` : `collant` (a-t-on
  scrollé sous le seuil, comme avant) et `enLecture` (le lecteur joue
  *réellement* — `Lecteur.svelte` relaie l'état posé par l'API IFrame,
  `onStateChange`, seul à le connaître, via une prop `onChangementLecture`).
  `reduit = collant && enLecture` pilote tout : la réduction du lecteur, le
  repère, et même le `position: sticky` du groupe lui-même — au repos
  (`.groupe-collant` sans la classe `.actif`), il est `static` et défile
  normalement avec le reste de la page. Conséquence : passer en pause pendant
  que le groupe est réduit le rend immédiatement à sa taille pleine et le
  décolle, sans attendre un nouveau scroll.

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

## Troisième retour d'usage

- **Recherche pas assez centrée, titre raccourci** : la version précédente
  utilisait le titre court (« Marque-Page ») en `flex` juste à côté de la
  recherche — celle-ci restait collée au titre plutôt que centrée dans
  l'en-tête. Passage à une grille à 3 colonnes (`1fr auto 1fr`) : la
  recherche (colonne centrale, largeur `28rem`) reste au milieu quelle que
  soit la largeur du titre, les deux colonnes `1fr` absorbant la différence
  de chaque côté. Le titre reprend sa forme complète (« Le Marque-Page de la
  Relecture »), aligné à gauche (`justify-self: start`).
- **Contrainte géométrique découverte en implémentant** : le titre complet
  (255px) et une recherche de 448px vraiment centrée ne tiennent pas dans
  les 720px utiles de `--largeur-contenu` (760px moins le padding) — pas un
  réglage à ajuster, une question d'espace disponible. Résolu en ne
  plafonnant plus `.entete-interieur` à `--largeur-contenu` : contrairement
  au reste du site, l'en-tête utilise toute la largeur de la fenêtre pour
  son contenu aussi, pas seulement pour son fond — cohérent avec la
  référence explicite à YouTube, dont l'en-tête n'est pas non plus calée
  sur la largeur de son contenu.
- **Traits entre les épisodes retirés** (`Sommaire.svelte`,
  `.episodes li { border-bottom }` supprimé) — simplification demandée,
  sans contrepartie fonctionnelle à documenter.

## Quatrième retour d'usage

- **En-tête pas vraiment plein format** : un liseré du fond de la page
  restait visible à droite. Cause : `scrollbar-gutter: stable` sur `html`
  (Base.astro) réserve une place pour la scrollbar que `position: fixed`
  ne couvre pas de lui-même — `right: 0` s'arrête au bord de cette réserve,
  pas de la fenêtre. L'astuce CSS habituelle (`100vw - 100%` en marge
  négative) s'est révélée égale à 0 dans ce navigateur : `vw` y est déjà
  réduit par `scrollbar-gutter`, pas fiable ici. Mesurée en JS à la place
  (`gouttiere = window.innerWidth - document.documentElement.clientWidth`,
  posée en variable CSS `--gouttiere` sur l'en-tête) — 0 sur mobile
  (scrollbar en survol, pas de réserve), variable selon OS/navigateur sur
  desktop.
- **Recherche débordante sur mobile** : le champ en ligne n'a pas la place
  d'exister à côté du nom du site sous 640px. Plutôt que de le rétrécir
  jusqu'à l'illisible, une loupe (`.recherche-bouton`, visible seulement
  sous 640px) ouvre `RechercheMobile.svelte` — écran plein écran avec son
  propre champ, qui **remplace** le champ en ligne (masqué à la même
  largeur) plutôt que de s'y ajouter.

  Requête vide → recherches récentes, persistées dans `localStorage`
  (`marque-page:recherches-recentes`, 8 maximum, la plus récente en tête,
  dédoublonnées insensible à la casse) — enregistrées à la fermeture de
  l'écran ou au clic sur un résultat, jamais à chaque frappe. Lecture et
  écriture dans un bloc `try/catch` : un stockage indisponible (navigation
  privée, quota) doit dégrader en « pas de récentes », jamais casser la
  recherche elle-même. Requête non vide → `Sommaire.svelte` réutilisé tel
  quel (même logique « résultats vides » vs « liste »), pas de rendu
  d'épisode dupliqué.

  Vérifié sur le dev server à 500px de large : la loupe remplace le champ,
  l'écran s'ouvre avec le focus sur son champ, un résultat cliqué joue
  l'épisode et ferme l'écran, la recherche réapparaît dans « récentes » à
  la réouverture après avoir vidé le champ.

## Découpage des composants

`SelecteurLivre.svelte` supprimé, remplacé par deux composants :

- `Onglets.svelte` — juste les onglets de livre (pastille « en direct »
  comprise, issue #18), pour pouvoir coller à côté du lecteur réduit.
- `Sommaire.svelte` — juste la liste des épisodes (sommaire ou résultats de
  recherche), inchangée sinon.

`RechercheMobile.svelte` (nouveau, quatrième retour d'usage) — écran de
recherche plein écran sous 640px, décrit plus haut.

`Lecteur.svelte` ne gère plus lui-même sa persistance au scroll : il reçoit
une prop `reduit` décidée par `Site.svelte`, qui colle le lecteur et les
onglets ensemble — la position collante ne peut appartenir qu'à leur parent
commun, pas à l'un des deux frères.

## Vérifié sur le dev server

- **En-tête** : `getBoundingClientRect().width` de `.entete-collante` = 1062px
  pour une fenêtre de 1077px (l'écart est la largeur de la scrollbar réservée,
  `scrollbar-gutter: stable`) — occupe bien toute la largeur, pas seulement
  celle de la colonne de contenu. Reste sur une seule ligne, collée dès le
  chargement.
- **Scroller sans lecture active** : vidéo affichée mais jamais lancée →
  scroller le sommaire fait défiler le lecteur normalement, `.groupe-collant`
  reste sans la classe `.actif`, aucun collage.
- **Vidéo lancée pour de vrai** (clic sur le bouton play natif de l'iframe,
  vérifié à l'image — sous-titres et son en mouvement, pas juste l'attribut
  `src`) puis scroll : `.groupe-collant.actif` apparaît, `.cadre` mesuré à
  160px (`10rem`) au lieu de 720px au repos, repère « Livre 1 » affiché.
- **Mise en pause pendant que le groupe est réduit** (`postMessage`
  `pauseVideo` vers l'iframe, protocole natif de l'API) : `.actif` disparaît
  et `.cadre` revient à 720px immédiatement, sans nouveau scroll — confirme
  que `reduit` dépend bien de l'état de lecture, pas seulement du scroll.
- **Clic sur un épisode pendant que le groupe est réduit** : le titre du
  repère se met à jour (« Livre 1 · Heat »), la page remonte en douceur,
  `window.scrollY` revient à `0`, le lecteur reprend sa pleine largeur.

## Hors périmètre

Mise en évidence de l'épisode en cours dans le sommaire (#15, déjà fait),
mini-timeline et indicateur de chargement (#56) — cette issue ne fait que
rendre le lecteur persistant et gérer sa taille au scroll.
