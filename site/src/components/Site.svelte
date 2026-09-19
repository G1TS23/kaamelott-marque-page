<script lang="ts">
  /**
   * Racine de l'îlot du site : possède l'état que le lecteur, les onglets,
   * le sommaire et la recherche doivent partager.
   *
   * Trois responsabilités bien séparées, retour d'usage sur #18 : parcourir
   * un livre (onglet) et écouter un épisode (lecteur) sont deux actions
   * indépendantes depuis que la recherche permet de lire un épisode d'un
   * livre différent de celui affiché — avant, elles coïncidaient toujours,
   * un onglet pouvait se permettre de piloter le lecteur sans que ça se
   * voie. Ce n'est plus vrai :
   * - `livreActif` — quel sommaire est affiché. Change au clic d'onglet et
   *   au clic d'épisode (pour que le sommaire retrouve le bon livre une
   *   fois la recherche effacée), jamais tout seul.
   * - `requete` — la recherche en cours. Vidée par un clic d'onglet : un
   *   onglet dit « montre-moi ce livre », pas « garde mes résultats ».
   * - le lecteur — jamais touché par la navigation (onglet ou recherche),
   *   seulement par un clic sur un épisode précis.
   *
   * Issue #54 (lecteur collant), deux retours d'usage successifs :
   * - un premier essai (lecteur plein écran collé au bord) jugé trop brut,
   *   remplacé par un en-tête toujours collée (nom du site + recherche,
   *   comme YouTube) et un groupe lecteur+onglets qui colle réduit, avec
   *   une marge visible — direction comparée sur plusieurs maquettes avant
   *   d'être choisie (docs/qc-lecteur-collant.md) ;
   * - puis : l'en-tête devait remplacer le grand titre de la page et
   *   prendre toute sa largeur (pas juste la largeur du contenu), et le
   *   groupe ne doit se réduire que si une vidéo a été *réellement* lancée
   *   — pas juste affichée en vignette, sans quoi parcourir le sommaire
   *   sans rien écouter collait quand même un lecteur en pleine taille
   *   inutilement. Une pause, elle, ne décolle pas le groupe : voir
   *   `lectureEngagee` plus bas pour le détail des états qui comptent.
   * - enfin (#56) : l'épisode « en cours » (ligne surlignée du sommaire,
   *   repère du lecteur réduit) suit la position de lecture réelle, pas
   *   seulement le dernier épisode cliqué — voir `videoIdActif` et
   *   `tempsCourant` plus bas.
   */
  import { tick } from 'svelte';
  import {
    aplatir,
    estIntro,
    type DonneesRecherche,
    type EpisodeListe,
    type LivreEnListe,
    type NumeroLivre,
  } from '../lib/episodes.ts';
  import {
    chercherEpisodes,
    creerIndexPersonnages,
    creerIndexResumes,
    creerIndexTitres,
    joindreDonneesRecherche,
  } from '../lib/recherche.ts';
  import { analyserLienProfond, parametresLienProfond } from '../lib/lienProfond.ts';
  import { bornesEpisode } from '../lib/timeline.ts';
  import Lecteur from './Lecteur.svelte';
  import MiniTimeline from './MiniTimeline.svelte';
  import Onglets from './Onglets.svelte';
  import PanneauMentionsLegales from './PanneauMentionsLegales.svelte';
  import PiedDePage from './PiedDePage.svelte';
  import RechercheMobile from './RechercheMobile.svelte';
  import ResultatsRecherche from './ResultatsRecherche.svelte';
  import Sommaire from './Sommaire.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  // Lien profond (issue #21) : lu une seule fois, à l'exécution du script
  // — jamais côté serveur (`typeof window`, le site est statique : aucune
  // requête ne passe par un serveur qui pourrait lire ces paramètres, la
  // page HTML est la même pour tout le monde). `livreActif`/`videoIdActif`
  // ci-dessous restent volontairement sur le premier livre par défaut
  // plutôt que sur `cibleInitiale` : les faire dépendre d'une valeur
  // absente côté serveur ferait clignoter le sommaire au chargement (même
  // défaut que la popin de bienvenue, issue #19, corrigé pour la même
  // raison) — `cibleInitiale` est appliquée juste après coup, dans un
  // effet plus bas, un aller-retour visuel bien plus discret qu'un
  // mismatch serveur/client. `videoIdInitial` (le lecteur lui-même,
  // plus bas) n'a pas ce problème : son conteneur est vide tant que le
  // JS n'a pas tourné, rien à faire clignoter.
  const cibleInitiale =
    typeof window !== 'undefined'
      ? analyserLienProfond(new URLSearchParams(window.location.search), livres)
      : null;

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let requete = $state('');
  // Champ de recherche en ligne dans l'en-tête (desktop) vs plein écran
  // ouvert par une loupe (mobile, sous 640px) — retour d'usage : le champ
  // en ligne débordait sur un petit écran, pas la place pour le nom du
  // site *et* un champ utilisable (voir le CSS de l'en-tête).
  let rechercheMobileOuverte = $state(false);
  // La vidéo actuellement chargée dans le lecteur et la position de lecture
  // (secondes) — c'est ce couple, pas « le dernier épisode cliqué », qui
  // détermine l'épisode en cours (`episodeActif` plus bas, issue #56) :
  // laisser la vidéo avancer jusqu'à l'épisode suivant sans rien cliquer,
  // ou sauter dans la barre de progrès YouTube, doivent aussi mettre à jour
  // la ligne surlignée du sommaire et le repère du lecteur réduit — un état
  // posé une fois au clic ne le permettrait pas. `videoIdActif` change au
  // clic (`onEpisodeClick`) ; `tempsCourant` suit aussi `onProgression`
  // (Lecteur.svelte), qui sonde `getCurrentTime()`.
  let videoIdActif = $state(videoIdDuLivre(livres[0].livre));
  let tempsCourant = $state(0);
  // Durée totale de la vidéo (issue #56) : borne haute de la mini-timeline
  // pour le dernier épisode d'un livre. 0 tant que `getDuration()` n'a pas
  // encore résolu de valeur utile (juste après le montage du lecteur) —
  // sans effet gênant, `bornesEpisode`/`ratioDepuisSecondes` restent
  // cohérents avec une borne haute à 0 le temps que la vraie durée arrive.
  let dureeVideo = $state(0);
  let lecteur: Lecteur;
  let sentinelle: HTMLDivElement;
  // Vrai une fois le groupe lecteur + onglets scrollé sous l'en-tête —
  // ne suffit pas à lui seul à décider de la réduction, voir `reduit`.
  let collant = $state(false);
  // Vrai dès qu'une vidéo a été lancée, et tant qu'elle ne repasse pas à
  // l'état « vignette » (retour d'usage : une simple vignette affichée ne
  // justifie pas de coller un mini-lecteur — mais une fois lancée, une
  // pause ne doit pas le décoller pour autant, on garde le contexte de ce
  // qu'on écoutait). Voir `Lecteur.svelte` pour le détail des états qui
  // comptent comme « engagée ».
  let lectureEngagee = $state(false);
  // État réel du bouton lecture/pause (contrôles de transport) — distinct
  // de `lectureEngagee` : une pause laisse `lectureEngagee` vrai (le
  // groupe reste collé) mais doit basculer ce bouton sur l'icône « lire ».
  let enLecture = $state(false);
  // Les deux conditions à la fois pilotent la réduction du lecteur, le
  // collage du groupe et l'apparition du repère d'épisode.
  const reduit = $derived(collant && lectureEngagee);

  // Largeur de la place réservée à la scrollbar (`scrollbar-gutter: stable`
  // sur `html`, Base.astro) — 0 sur mobile (scrollbar en survol, pas de
  // réserve). Sert uniquement à étirer l'en-tête collée jusqu'au vrai bord
  // de la fenêtre (voir `.entete-collante` plus bas) : `position: fixed`
  // s'arrête sinon au bord de cette réserve, pas de la fenêtre elle-même.
  let gouttiere = $state(0);

  $effect(() => {
    function mesurer() {
      gouttiere = window.innerWidth - document.documentElement.clientWidth;
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  });

  // Index du titre, construit une fois : `requete` est réactif, pas l'index.
  // Intro exclue (issue #71) : titre générique répété une fois par livre,
  // sans résumé ni personnage propre — n'apporte rien à la recherche.
  const episodesAvecLivre = aplatir(livres).filter((e) => !estIntro(e));
  const indexTitres = creerIndexTitres(episodesAvecLivre);

  // Résumé et personnages (issue #16) : chargés à part du HTML initial
  // (~300 Ko de résumés, docs/SPECS.md section 5) via `/recherche.json`,
  // récupérés une fois au montage de l'îlot. `null` tant que le fetch n'a
  // pas résolu — la recherche par titre reste utilisable seule en
  // attendant, personnage et résumé s'ajoutent dès que prêts (réactivité :
  // `donneesRecherche` passe de `null` à peuplé, tout ce qui en dépend se
  // recalcule tout seul).
  let donneesRecherche = $state<DonneesRecherche[] | null>(null);

  $effect(() => {
    fetch('/recherche.json')
      .then((r) => r.json())
      .then((donnees: DonneesRecherche[]) => {
        donneesRecherche = donnees;
      })
      .catch(() => {
        // Pas grave : la recherche par titre reste utilisable seule.
      });
  });

  const episodesRecherche = $derived(
    donneesRecherche ? joindreDonneesRecherche(episodesAvecLivre, donneesRecherche) : null,
  );
  const indexPersonnages = $derived(
    episodesRecherche ? creerIndexPersonnages(episodesRecherche) : null,
  );
  const indexResumes = $derived(episodesRecherche ? creerIndexResumes(episodesRecherche) : null);

  // `[]` tant qu'il n'y a pas de requête (ou trop courte) comme sans
  // résultat — c'est `requete.trim()` ci-dessous qui distingue les deux
  // pour l'affichage (pas de recherche active → sommaire ; recherche sans
  // résultat → message dédié dans `ResultatsRecherche.svelte`).
  const resultats = $derived(
    chercherEpisodes(indexTitres, indexPersonnages, indexResumes, requete),
  );
  const rechercheActive = $derived(requete.trim().length > 0);
  let rechercheEl: HTMLDivElement;

  // Ferme le panneau desktop sur un clic en dehors ou sur Échap (retour
  // d'usage — Échap manquait alors que `RechercheMobile` le gère déjà) —
  // pas en mode mobile : `RechercheMobile` est un dialog plein écran séparé
  // (`.recherche` reste hors DOM visible, `display: none`, tout clic à
  // l'intérieur du dialog s'y compterait à tort comme « extérieur »).
  $effect(() => {
    if (!rechercheActive || rechercheMobileOuverte) return;
    function surClicExterieur(e: MouseEvent) {
      if (rechercheEl && !rechercheEl.contains(e.target as Node)) {
        requete = '';
      }
    }
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') requete = '';
    }
    document.addEventListener('click', surClicExterieur);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('click', surClicExterieur);
      document.removeEventListener('keydown', surTouche);
    };
  });

  function videoIdDuLivre(livre: NumeroLivre): string {
    // Chaque épisode porte le video_id de son livre (redondant mais déjà
    // établi par le modèle de données, docs/SPECS.md section 4) : le premier
    // suffit à connaître la vidéo du livre entier.
    return livres.find((l) => l.livre === livre)!.episodes[0].video_id;
  }

  // Constante : la vidéo chargée au montage du lecteur. `Lecteur` traque sa
  // prop `videoIdInitial` comme dépendance de l'effet qui crée le player —
  // la lier à `livreActif` recréerait un player à chaque bascule d'onglet.
  // Celle d'un lien profond (issue #21) si présent, sans le risque de
  // clignotement de `livreActif`/`videoIdActif` (voir plus haut) : le
  // conteneur du lecteur est vide tant que rien n'a tourné, rien à faire
  // clignoter en changeant la vidéo qui s'y chargera.
  const videoIdInitial = cibleInitiale?.episode.video_id ?? videoIdDuLivre(livres[0].livre);

  // Sens inverse de `videoIdDuLivre` : à quel livre appartient la vidéo
  // chargée. Chaque livre a sa propre vidéo (jamais partagée), une
  // correspondance directe suffit — pas besoin de connaître l'épisode.
  function livreDuVideoId(videoId: string): NumeroLivre {
    return livres.find((l) => l.episodes[0].video_id === videoId)?.livre ?? livres[0].livre;
  }

  const livreEnCours = $derived(livreDuVideoId(videoIdActif));

  // Dernier épisode du livre en cours dont le `start_seconds` est atteint —
  // les épisodes d'un livre sont triés par numéro (`chargerLivre`), donc
  // aussi par `start_seconds` croissant, un simple parcours suffit. Ne
  // résout plus jamais `null` pour un livre chargé depuis l'ajout de
  // l'intro (issue #71, `avecIntro`) : `tempsCourant` a toujours au moins
  // l'intro (`start_seconds: 0`) à résoudre avant le premier épisode réel.
  const episodeEnCoursDetails = $derived.by(() => {
    const episodes = livres.find((l) => l.livre === livreEnCours)?.episodes ?? [];
    let trouve: EpisodeListe | null = null;
    for (const episode of episodes) {
      if (episode.start_seconds > tempsCourant) break;
      trouve = episode;
    }
    return trouve;
  });

  // Ne dépend plus de `lectureEngagee` depuis l'ajout de l'intro (issue
  // #71, retour d'usage sur #54/#56) : avant, la ligne du sommaire et le
  // repère sous le lecteur n'apparaissaient qu'après une vraie lecture
  // engagée, avec un délai perceptible — `episodeEnCoursDetails` pouvait
  // légitimement résoudre `null` avant tout engagement (position 0, avant
  // le premier épisode réel). Ce trou n'existe plus : `episodeEnCoursDetails`
  // résout toujours au moins l'intro pour un livre chargé, donc ces deux
  // valeurs peuvent le suivre directement. `lectureEngagee` reste seul à
  // décider de `reduit` (collage du lecteur, #54) : rien ici ne doit
  // collapser le lecteur juste parce qu'il affiche l'intro en pause.
  const episodeActif = $derived(
    episodeEnCoursDetails ? { livre: livreEnCours, episode: episodeEnCoursDetails.episode } : null,
  );
  const episodeActifDetails = $derived(episodeEnCoursDetails);

  // Distinct de `episodeActif` ci-dessus (issue #71) : la pastille « en
  // direct » des onglets (`Onglets.svelte`, issue #18) signale qu'un livre
  // *différent* de celui affiché a une lecture réellement en cours pendant
  // qu'on en parcourt un autre — un vrai signal d'engagement, pas juste
  // « ce livre est celui chargé dans le lecteur ». Sans cette distinction,
  // elle resterait allumée en permanence sur le premier livre dès le
  // chargement du site, l'intro étant toujours cuée dans le lecteur même
  // sans qu'aucune lecture n'ait jamais démarré.
  const episodeEnLecture = $derived(lectureEngagee ? episodeActif : null);

  // Bornes de l'épisode en cours pour la mini-timeline (issue #56) : même
  // liste que `episodeEnCoursDetails` ci-dessus, ses éléments y sont donc
  // retrouvables par référence (`indexOf`) sans reparcourir la logique de
  // recherche par position.
  const episodesLivreEnCours = $derived(
    livres.find((l) => l.livre === livreEnCours)?.episodes ?? [],
  );
  const indexEpisodeEnCours = $derived(
    episodeActifDetails ? episodesLivreEnCours.indexOf(episodeActifDetails) : -1,
  );
  const bornesEpisodeCourant = $derived(
    indexEpisodeEnCours >= 0
      ? bornesEpisode(episodesLivreEnCours, indexEpisodeEnCours, dureeVideo)
      : null,
  );
  // Précédent/suivant (contrôles de transport) : restent dans le livre
  // affiché, jamais de bascule automatique vers le livre suivant/précédent
  // — même limite délibérée que la mini-timeline, qui ne franchit pas non
  // plus les bornes de l'épisode/livre en cours. `null` en butée plutôt
  // qu'un rebouclage, pour ne jamais changer de livre sans un clic
  // explicite sur un onglet (voir la note en tête de fichier sur les
  // responsabilités disjointes, issue #18).
  const episodePrecedent = $derived(
    indexEpisodeEnCours > 0 ? episodesLivreEnCours[indexEpisodeEnCours - 1] : null,
  );
  const episodeSuivant = $derived(
    indexEpisodeEnCours >= 0 && indexEpisodeEnCours < episodesLivreEnCours.length - 1
      ? episodesLivreEnCours[indexEpisodeEnCours + 1]
      : null,
  );

  $effect(() => {
    // `position: sticky` ne déclenche aucun événement natif quand le
    // groupe se colle réellement — technique standard : une sentinelle
    // sans hauteur utile juste au-dessus, observée par rapport à la
    // fenêtre. `rootMargin` décale la zone d'observation du même montant
    // que le `top` du groupe une fois réduit (3rem d'en-tête + --esp-2 de
    // marge, voir le CSS) : sans ça la sentinelle sortirait de la zone
    // visible avant même que le groupe n'atteigne son seuil de collage.
    const observateur = new IntersectionObserver(
      ([entree]) => {
        collant = !entree.isIntersecting;
      },
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' },
    );
    observateur.observe(sentinelle);
    return () => observateur.disconnect();
  });

  // Lien profond (issue #21) : bascule le sommaire sur le bon livre dès le
  // montage — `videoIdInitial`, `secondesInitiales` et `lireAuDemarrage`
  // (plus bas) se chargent de positionner et lancer le lecteur lui-même,
  // sans appel d'API supplémentaire à attendre ici. `videoIdActif`/
  // `tempsCourant` suivent pour rester cohérents avec ce que le lecteur
  // affiche déjà (repère, mini-timeline) — un simple effet une fois au
  // montage, `cibleInitiale` n'étant jamais réévalué ensuite.
  $effect(() => {
    if (!cibleInitiale) return;
    livreActif = cibleInitiale.livre;
    videoIdActif = cibleInitiale.episode.video_id;
    tempsCourant = cibleInitiale.episode.start_seconds;
  });

  // Un onglet ne fait que changer la liste affichée : ni la recherche
  // (qui montrerait encore des résultats d'un autre livre) ni le lecteur
  // (qui couperait une lecture en cours) ne doivent rester dans les
  // pattes de ce geste de pure navigation.
  function onLivreChange(livre: NumeroLivre) {
    livreActif = livre;
    requete = '';
  }

  async function onEpisodeClick(livre: NumeroLivre, episode: EpisodeListe) {
    // Un résultat de recherche peut venir d'un autre livre que celui affiché
    // (issue #18) : l'onglet suit, pour que le sommaire retrouve le bon
    // livre une fois la recherche effacée. `bind:this` est résolu avant
    // tout clic — le `?.` n'est qu'une ceinture.
    livreActif = livre;
    // Mise à jour optimiste (issue #56) : `onProgression` (sondage,
    // `Lecteur.svelte`) rattraperait ces valeurs de toute façon, mais dans
    // la seconde qui suit le clic — sans ça la ligne surlignée et le repère
    // resteraient un instant sur l'ancien épisode.
    videoIdActif = episode.video_id;
    tempsCourant = episode.start_seconds;
    lecteur?.allerA(episode.video_id, episode.start_seconds);
    // `collant` remis à faux explicitement (retour d'usage, Safari) :
    // cliquer un épisode pendant que le groupe est déjà réduit ne doit
    // jamais le laisser réduit, quel que soit le sort du scroll qui suit
    // sur le navigateur utilisé — `collant` n'est qu'un indicateur de
    // position, pas une source de vérité qu'un vrai scroll ultérieur ne
    // pourrait pas corriger dans l'autre sens.
    collant = false;
    // `tick()` avant le scroll (retour d'usage, Safari) : sans lui, le
    // scroll démarre avant que Svelte n'ait retiré la classe `position:
    // sticky` du DOM (mise à jour réactive, pas synchrone avec
    // l'affectation ci-dessus) — ce changement de layout pendant
    // l'animation semble annuler le `scrollTo` en cours sur Safari (pas
    // sur Chrome, plus tolérant). Attendre que le DOM soit à jour avant de
    // lancer le scroll évite que quoi que ce soit ne bouge sous lui.
    await tick();
    // Retour en douceur en haut (issue #54, retour d'usage) : cliquer un
    // épisode pendant que le groupe est réduit doit ramener le lecteur en
    // grand, pas juste changer ce qui joue hors champ. `requestAnimationFrame`
    // en plus de `tick()` (retour d'usage, régression Safari) : `tick()`
    // garantit que Svelte a bien retiré `position: sticky` du DOM, pas que
    // le navigateur a fini d'en recalculer la mise en page — laisser passer
    // une frame de plus avant de lancer le scroll réduit encore le risque
    // qu'un recalcul de layout en cours n'annule l'animation sur Safari.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Referme le panneau de résultats desktop après un clic (retour d'usage :
  // un panneau flottant qui reste ouvert sur un épisode qu'on vient de
  // quitter donne l'impression d'un bug, contrairement à l'ancien
  // remplacement en place du sommaire, qui pouvait rester affiché).
  function onResultatClick(livre: NumeroLivre, episode: EpisodeListe) {
    onEpisodeClick(livre, episode);
    requete = '';
  }

  // Referme le clavier virtuel sur Entrée (retour d'usage, RechercheMobile) :
  // sans <form> à soumettre, la touche Entrée n'a aucune action définie —
  // certains claviers mobiles l'affichent alors comme un retour à la ligne.
  // Les résultats sont déjà à jour à chaque frappe : Entrée n'a qu'à dégager
  // le clavier.
  function surEntreeRecherche(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  // Lien profond partageable (issue #21) : copie l'URL de l'épisode en
  // cours, pas seulement du livre — `parametresLienProfond` retrouve son
  // `id`, sa clé unique dans le modèle de données (section 4). En plein
  // format uniquement (retour d'usage), même contrainte de place que les
  // contrôles de transport en réduit.
  let lienCopie = $state(false);
  let minuteurLienCopie: ReturnType<typeof setTimeout> | undefined;

  async function copierLien() {
    if (!episodeActifDetails) return;
    const url = new URL(window.location.href);
    url.search = parametresLienProfond(livreEnCours, episodeActifDetails).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      // Presse-papiers indisponible (permissions, contexte non sécurisé) :
      // pas grave, rien d'autre à proposer à la place.
      return;
    }
    lienCopie = true;
    if (minuteurLienCopie !== undefined) clearTimeout(minuteurLienCopie);
    minuteurLienCopie = setTimeout(() => {
      lienCopie = false;
      minuteurLienCopie = undefined;
    }, 2000);
  }

  // Mentions légales en panneau plutôt qu'en navigation (issue #77) : une
  // vraie navigation démonterait cet îlot entier, relançant le lecteur
  // vidéo depuis zéro juste pour lire un texte statique — voir
  // `PanneauMentionsLegales.svelte`. Seul le clic simple est intercepté :
  // clic du milieu, Ctrl/Cmd/Maj/Alt-clic doivent garder leur comportement
  // natif (nouvel onglet/fenêtre), le `href` de `PiedDePage` reste posé
  // pour ça et pour le secours sans JS.
  let panneauMentionsLegalesOuvert = $state(false);

  function surClicMentionsLegales(e: MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    panneauMentionsLegalesOuvert = true;
  }

  // `inert` sur le reste de la page pendant qu'un dialogue est ouvert
  // (RechercheMobile ou PanneauMentionsLegales — revue a11y) : le piège
  // de focus au clavier de chacun (Tab) ne suffit pas seul, un lecteur
  // d'écran en navigation libre (curseur virtuel, pas Tab) pouvait
  // toujours atteindre et lire le contenu recouvert, même dimmé sous
  // PanneauMentionsLegales. `inert` le retire complètement de l'arbre
  // d'accessibilité et du flux d'interaction — posé sur un conteneur
  // englobant plutôt que sur `<body>` : les deux dialogues eux-mêmes
  // vivent hors de ce conteneur (voir le template), sans quoi l'un
  // s'inerterait lui-même en s'ouvrant.
  const unDialogueOuvert = $derived(rechercheMobileOuverte || panneauMentionsLegalesOuvert);
</script>

<div inert={unDialogueOuvert}>
<header class="entete-collante" style="--gouttiere: {gouttiere}px">
  <div class="entete-interieur">
    <h1 class="marque">Le Marque-Page de la Relecture</h1>
    <div class="recherche" bind:this={rechercheEl}>
      <label for="recherche-titre" class="sr-only">
        Rechercher un épisode par titre, résumé ou personnage
      </label>
      <input
        id="recherche-titre"
        type="search"
        bind:value={requete}
        onkeydown={surEntreeRecherche}
        placeholder="titre, résumé, personnage…"
        autocomplete="off"
        enterkeyhint="search"
      />
      {#if rechercheActive}
        <button
          type="button"
          class="effacer"
          onclick={() => (requete = '')}
          aria-label="Effacer la recherche"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </button>
        <div class="panneau-resultats">
          <ResultatsRecherche {resultats} onEpisodeClick={onResultatClick} />
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="recherche-bouton"
      onclick={() => (rechercheMobileOuverte = true)}
      aria-label="Rechercher un épisode par titre"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path
          d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"
          fill="currentColor"
        />
      </svg>
    </button>
  </div>
</header>

{#snippet repereEpisode()}
  <span class="repere-livre">Livre {livreEnCours}</span>
  {#if episodeActifDetails}
    <span class="repere-episode">
      {#if estIntro(episodeActifDetails)}
        {episodeActifDetails.title}
      {:else}
        {String(episodeActifDetails.episode).padStart(2, '0')} - {episodeActifDetails.title}
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet boutonPartage()}
  <button type="button" onclick={copierLien} aria-label={lienCopie ? 'Lien copié' : "Copier le lien de l'épisode"}>
    {#if lienCopie}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
                d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5"
                fill="currentColor"
        />
      </svg>
    {/if}
  </button>
{/snippet}

{#snippet boutonsTransport()}
  <button
    type="button"
    onclick={() => episodePrecedent && onEpisodeClick(livreEnCours, episodePrecedent)}
    disabled={!episodePrecedent}
    aria-label="Épisode précédent"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor" />
    </svg>
  </button>
  <button
    type="button"
    onclick={() => lecteur?.basculerLecture()}
    aria-label={enLecture ? 'Mettre en pause' : 'Lire'}
  >
    {#if enLecture}
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    {/if}
  </button>
  <button
    type="button"
    onclick={() => episodeSuivant && onEpisodeClick(livreEnCours, episodeSuivant)}
    disabled={!episodeSuivant}
    aria-label="Épisode suivant"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor" />
    </svg>
  </button>
{/snippet}

<div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
<div class="groupe-collant" class:actif={reduit}>
  <div class="groupe-ligne">
    <Lecteur
      bind:this={lecteur}
      {videoIdInitial}
      secondesInitiales={cibleInitiale?.episode.start_seconds}
      lireAuDemarrage={!!cibleInitiale}
      {reduit}
      onChangementEngagement={(v) => (lectureEngagee = v)}
      onLectureChange={(v) => (enLecture = v)}
      onProgression={(s, d) => {
        tempsCourant = s;
        dureeVideo = d;
      }}
    />
    {#if reduit}
      <div class="groupe-repere">
        {@render repereEpisode()}
        {#if bornesEpisodeCourant}
          <div class="boutons-reduit">
            {@render boutonsTransport()}
            {@render boutonPartage()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
  {#if !reduit && episodeActifDetails}
    <p class="repere-plein">
      {#if estIntro(episodeActifDetails)}
        Livre {livreEnCours} - {episodeActifDetails.title}
      {:else}
        Livre {livreEnCours} - Épisode {String(episodeActifDetails.episode).padStart(2, '0')} :
        {episodeActifDetails.title}
      {/if}
    </p>
  {/if}
  {#if bornesEpisodeCourant}
    <div class="transport">
      {#if !reduit}
        {@render boutonsTransport()}
        {@render boutonPartage()}
      {/if}
      <MiniTimeline
        bornes={bornesEpisodeCourant}
        position={tempsCourant}
        onSeek={(secondes) => {
          tempsCourant = secondes;
          lecteur?.allerA(videoIdActif, secondes);
        }}
      />
    </div>
  {/if}
  <Onglets {livres} {livreActif} episodeActif={episodeEnLecture} {onLivreChange} />
</div>

<Sommaire {livres} {livreActif} {episodeActif} {onEpisodeClick} {donneesRecherche} />

<PiedDePage {gouttiere} onMentionsLegalesClick={surClicMentionsLegales} />
</div>

{#if rechercheMobileOuverte}
  <RechercheMobile
    {requete}
    {resultats}
    onRequeteChange={(v) => (requete = v)}
    {onEpisodeClick}
    onFermer={() => (rechercheMobileOuverte = false)}
  />
{/if}

{#if panneauMentionsLegalesOuvert}
  <PanneauMentionsLegales onFermer={() => (panneauMentionsLegalesOuvert = false)} />
{/if}

<style>
  /* Toujours collée dès le chargement, comme YouTube (issue #54, retour
     d'usage) : le nom du site et la recherche ne doivent pas attendre un
     scroll pour redevenir accessibles. `fixed` (pas `sticky`) et non
     confinée à la largeur du contenu (`--largeur-contenu`) : elle a
     remplacé le grand titre de la page et doit occuper toute la largeur
     de la fenêtre, comme sur YouTube — un `sticky` resterait contraint à
     la largeur de son bloc englobant (`main`, centré et plafonné). */
  .entete-collante {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    /* `right: 0` s'arrête au bord de la place réservée pour la scrollbar
       (`scrollbar-gutter: stable` sur `html`, Base.astro) : un `fixed` ne
       la couvre pas de lui-même, d'où un liseré du fond de la page visible
       à droite (retour d'usage). `100vw - 100%` (l'astuce CSS habituelle
       pour ce cas) s'est révélé égal à 0 dans ce navigateur — `vw` y est
       déjà réduit par `scrollbar-gutter`, pas fiable ici. Mesurée en JS à
       la place (`--gouttiere`, ci-dessous) : différence entre la largeur
       de la fenêtre et celle réellement disponible, quelle que soit la
       largeur de la scrollbar (variable selon OS/navigateur, nulle sur
       mobile). */
    margin-right: calc(-1 * var(--gouttiere, 0px));
    z-index: 6;
    height: 3rem;
    /* Même fond que la page, pas de bordure : l'en-tête ne doit pas se
       détacher visuellement du contenu (retour d'usage) — seul le champ de
       recherche, lui, garde un fond distinct (voir .recherche input).
       Légèrement translucide + `backdrop-filter` (retour d'usage) : sans
       transparence, un flou n'aurait rien à flouter, le fond du dessous
       étant déjà uni. `color-mix` plutôt qu'une couleur en dur : reste un
       alias de `--fond`, pas une valeur qui échapperait au thème sombre.

       Constaté par l'usager : le flou se voyait dans Safari, pas dans
       Chrome (juste la transparence) — pas un bug de rendu, un bug de
       build. `-webkit-backdrop-filter` et `backdrop-filter` déclarés tous
       les deux (habitude par prudence) étaient traités comme deux formes
       redondantes de la même propriété par le minifieur CSS de Vite/Astro,
       qui n'en gardait qu'une seule (la préfixée, la dernière déclarée) —
       vérifié en inspectant `dist/_astro/*.css` après un build local, avec
       et sans minification. Chrome ne reconnaît que la forme standard,
       Safari reconnaissait les deux : d'où l'écart. `-webkit-` retiré
       plutôt que réordonné : rebuild avec Lightning CSS (le minifieur de
       Vite conscient des navigateurs réellement ciblés, --browserslist)
       confirme que la forme standard seule suffit désormais. */
    background: color-mix(in srgb, var(--fond) 70%, transparent);
    backdrop-filter: blur(8px);
    /* Calque GPU dédié : mesure de robustesse standard pour
       `backdrop-filter` sur un `position: fixed`, gardée par prudence même
       après avoir trouvé la vraie cause ci-dessus. */
    transform: translateZ(0);
  }

  /* Contrairement au reste du site, le contenu de l'en-tête n'est *pas*
     aligné sur --largeur-contenu (760px) : elle utilise toute la largeur
     de la fenêtre, comme sur YouTube. Trois colonnes : le titre (`auto`,
     jamais rétréci sous son contenu — voir plus bas pourquoi c'est
     important), la recherche (`1fr`, centrée dans l'espace qu'il reste),
     la loupe mobile (`auto`, vide sur desktop).

     Une vraie colonne centrale symétrique (`1fr auto 1fr`, essayée d'abord)
     imposerait la même largeur des deux côtés du titre — pour ne pas le
     recouvrir, le côté vide de droite devrait réserver *autant* de place
     que le titre en occupe à gauche, ce qui ne laisse plus assez de place
     pour une recherche utilisable entre 640 et ~1000px de large : question
     de géométrie, pas de réglage. Centrer la recherche dans l'espace
     restant *après* le titre (au lieu du milieu de la barre entière) coûte
     un centrage visuel légèrement décalé sur les très grands écrans, mais
     garantit que le titre ne soit jamais ni recouvert ni tronqué, à
     n'importe quelle largeur. */
  .entete-interieur {
    height: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--esp-3);
    padding: 0 var(--esp-4);
  }

  .marque {
    grid-column: 1;
    font-family: var(--police-titre);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
  }

  .recherche {
    /* Ancre le panneau de résultats (issue #16, `.panneau-resultats`
       ci-dessous) : `position: absolute` s'y positionne, pas à la fenêtre. */
    position: relative;
    grid-column: 2;
    justify-self: center;
    /* Rétrécit avec la fenêtre plutôt que de rester fixe à 28rem (retour
       d'usage : elle recouvrait le titre entre 640 et 1000px) — un
       pourcentage de sa propre colonne (déjà nette du titre et de ses
       marges) plutôt que du viewport : s'adapte à la place réellement
       disponible, pas à une largeur de fenêtre qui ignorerait la longueur
       du titre. */
    width: min(28rem, 65%);
  }

  /* Panneau de résultats (issue #16), ancré au champ plutôt qu'un
   * remplacement en place du sommaire (retour d'usage sur la maquette :
   * https://claude.ai/code/artifact/2f432b47-3b4e-4b45-8600-41cafe85a4e4).
   * Largeur minimale supérieure au champ (qui peut descendre sous 28rem,
   * voir ci-dessus) et alignée sur son bord droit — demande explicite,
   * pour ne jamais paraître plus étroit que ce qui l'a ouvert. `min()`
   * plutôt qu'un couple min-width/max-width (qui se contrediraient) :
   * cible 32rem, cède seulement si la fenêtre est vraiment plus étroite —
   * en pratique jamais avant 640px, où `RechercheMobile` prend le relais. */
  .panneau-resultats {
    position: absolute;
    top: calc(100% + var(--esp-2));
    right: 0;
    width: min(32rem, calc(100vw - 2 * var(--esp-4)));
    /* Se redimensionne avec la fenêtre (retour d'usage) : borné par la
       place réellement disponible sous l'en-tête (3rem) plutôt qu'une
       valeur fixe — recalculé par le navigateur à chaque redimensionnement,
       pas besoin de mesurer en JS. Légèrement conservateur (le champ est
       plus petit que les 3rem de l'en-tête, centré dedans) : jamais de
       débordement, au pire un peu de marge inutilisée en bas. */
    max-height: calc(100vh - 3rem - var(--esp-2) - var(--esp-4));
    overflow-y: auto;
    /* Scrollable sans scrollbar visible (retour d'usage) : la molette/le
       trackpad continuent de fonctionner, juste sans le rail à l'écran. */
    scrollbar-width: none;
    background: var(--surface-haute);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-carte);
    box-shadow: var(--ombre);
    padding: var(--esp-2) var(--esp-3);
    /* Au-dessus de l'en-tête (6) qui la contient, sous le dialog de
       recherche mobile (10, `RechercheMobile.svelte`) — sans effet réel ici
       vu que `.entete-collante` fixe déjà toute sa stacking context
       au-dessus de `.groupe-collant` (5), gardé pour la lisibilité. */
    z-index: 7;
  }

  /* `scrollbar-width` (ci-dessus) couvre Firefox ; Chrome/Safari/Edge ont
     besoin de ce pseudo-élément — les deux ensemble masquent le rail
     partout sans désactiver le défilement lui-même. */
  .panneau-resultats::-webkit-scrollbar {
    display: none;
  }

  .recherche input {
    width: 100%;
    /* Marge à droite pour laisser la place au bouton d'effacement
       ci-dessous. */
    padding: 0.4em 2.75rem 0.4em var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    /* Se détache du fond de l'en-tête (retour d'usage) — l'ancien fond de
       l'en-tête lui-même, avant qu'il ne devienne transparent. */
    background: var(--surface-haute);
    color: var(--encre);
    font: inherit;
  }

  /* La croix native de type="search" est incohérente d'un navigateur à
     l'autre (retour d'usage : absente sur certains mobiles alors que
     Chrome l'affiche) — un bouton à nous, partout pareil, la remplace. */
  .recherche input[type='search']::-webkit-search-cancel-button,
  .recherche input[type='search']::-webkit-search-decoration {
    appearance: none;
  }

  /* Zone de tap franchement plus grande que l'icône elle-même (retour
     d'usage : au doigt, un tap un peu à côté tombait sur le champ, qui
     sélectionnait son contenu au lieu d'être effacé) et détachée du bord
     du champ plutôt que collée dessus. */
  .recherche .effacer {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    /* Même couleur que le texte tapé (retour d'usage) — pas la teinte pâle
       des étiquettes, la croix doit se voir aussi nettement que ce qu'elle
       efface. */
    color: var(--encre);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* `:active` plutôt que `:hover` (retour d'usage sur le survol collant au
     toucher, voir plus haut) : ne dure que le temps du contact, confirme le
     tap sans jamais rester affiché après. */
  .recherche .effacer:active {
    background: var(--surface);
  }

  .recherche input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .recherche input::placeholder {
    color: var(--encre-pale);
  }

  /* Juste une loupe sous 640px (retour d'usage) : le champ en ligne n'a
     pas la place d'exister à côté du nom du site sur un petit écran — au
     lieu de le rétrécir jusqu'à l'illisible, un écran de recherche dédié
     (RechercheMobile.svelte) s'ouvre au clic. Caché par défaut : c'est le
     champ en ligne la variante par défaut, pour les écrans assez larges. */
  .recherche-bouton {
    display: none;
    grid-column: 3;
    justify-self: end;
    padding: var(--esp-1);
    border: none;
    background: transparent;
    color: var(--encre);
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .recherche {
      display: none;
    }

    .recherche-bouton {
      display: flex;
    }
  }

  /* Hauteur nulle : ne sert qu'à donner à l'IntersectionObserver un point
     de mesure situé juste au-dessus du groupe collant (voir le script). */
  .sentinelle {
    height: 1px;
  }

  /* `position: static` par défaut — pas sticky tant que rien ne joue
     réellement (retour d'usage) : parcourir le sommaire sans écouter ne
     doit pas coller un lecteur en pleine taille pour rien, la vidéo doit
     simplement défiler comme le reste du contenu. `.actif` (= `reduit` du
     script) active le collage réduit, avec une marge visible plutôt que
     plaqué au bord. */
  .groupe-collant.actif {
    position: sticky;
    top: calc(3rem + var(--esp-2));
    z-index: 5;
    border-radius: var(--rayon-carte);
    padding: var(--esp-2);
    background: var(--surface);
    box-shadow: var(--ombre);
  }

  .groupe-ligne {
    display: flex;
    align-items: center;
    gap: var(--esp-3);
  }

  /* Sur deux lignes plutôt qu'une (retour d'usage) : le livre seul ne
     suffit pas à se repérer parmi ~100 épisodes par livre, il faut aussi
     le numéro. `min-width: 0` sur le conteneur et chaque ligne : dans un
     flex (`.groupe-ligne`), un enfant ne rétrécit pas sous son contenu par
     défaut, l'ellipse ne s'appliquerait donc jamais sans ça (déjà rencontré
     avec le titre de l'en-tête, voir plus haut). */
  .groupe-repere {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    min-width: 0;
    font-family: var(--police-mono);
  }

  /* Repère de l'épisode en cours, mais en plein format (retour d'usage) :
     la vidéo seule n'identifie pas l'épisode affiché, contrairement à la
     mini-lecture réduite qui a déjà `repereEpisode` à côté d'elle — pas
     les deux en même temps, l'un remplace l'autre selon `reduit`. Une
     seule ligne pleine largeur plutôt que le livre en petit au-dessus du
     titre (retour d'usage : lisible mais bizarre, le numéro d'épisode
     collé à celui du livre sans rien entre les deux) — texte simple, pas
     de contrainte d'ellipse comme en réduit : la place ne manque pas sous
     une vidéo en pleine taille (--largeur-contenu). */
  .repere-plein {
    margin: var(--esp-3) 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--encre-douce);
  }

  .repere-livre,
  .repere-episode {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .repere-livre {
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-pale);
  }

  .repere-episode {
    font-size: 0.78rem;
    color: var(--encre);
  }

  /* En plein format, les boutons (`boutonsTransport`, snippet partagé)
     vivent ici, à côté de la mini-timeline. En réduit, ils vivent plutôt
     sous le repère (`.boutons-reduit` ci-dessous, retour d'usage) — pas
     assez de place à côté d'un mini-lecteur de 10rem pour trois boutons
     de plus, mais la colonne du repère, elle, a la largeur qu'il faut. */
  .transport {
    display: flex;
    align-items: center;
    gap: var(--esp-2);
    margin-top: var(--esp-3);
  }

  .boutons-reduit {
    display: flex;
    align-items: center;
    gap: var(--esp-1);
    margin-top: 0.15em;
  }

  /* Sans ça, la mini-timeline (elle-même `display: flex`) devient un
     élément flex de `.transport` comme les boutons à côté d'elle — un
     élément flex ne s'étire pas par défaut, elle se réduirait à la
     largeur de son contenu au lieu de remplir l'espace restant (retour
     d'usage : cassée depuis l'ajout des boutons de transport). */
  .transport :global(.mini-timeline) {
    flex: 1;
    min-width: 0;
  }

  .groupe-collant.actif .transport {
    margin-top: var(--esp-2);
  }

  .transport button,
  .boutons-reduit button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--encre);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* `(hover: hover)` plutôt qu'un `:hover` nu (retour d'usage récurrent
     sur ce projet) : sur un écran tactile la pseudo-classe reste collée
     après un tap. `:not(:disabled)` : un bouton en butée (précédent sur
     le premier épisode, suivant sur le dernier) ne doit pas réagir au
     survol comme s'il restait actionnable. */
  @media (hover: hover) {
    .transport button:not(:disabled):hover {
      background: var(--surface);
    }

    /* `--surface-haute` plutôt que `--surface` (retour d'usage) : le
       fond du lecteur réduit collant est déjà `--surface`
       (`.groupe-collant.actif`) — un survol dans la même couleur ne se
       voyait pas du tout. */
    .boutons-reduit button:not(:disabled):hover {
      background: var(--surface-haute);
    }
  }

  .transport button:disabled,
  .boutons-reduit button:disabled {
    color: var(--encre-pale);
    cursor: default;
  }

  .groupe-collant :global(.onglets) {
    margin-top: var(--esp-3);
  }

  .groupe-collant.actif :global(.onglets) {
    margin-top: var(--esp-2);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
