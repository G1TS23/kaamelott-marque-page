<script lang="ts">
  /**
   * Instance unique du lecteur YouTube pour tout le site (issue #14,
   * docs/SPECS.md section 6) : jamais de mur de vignettes, un seul iframe
   * qui change de vidéo ou avance dedans selon ce qu'on lui demande.
   *
   * La décision (rester sur la vidéo courante vs en charger une autre) est
   * dans `src/lib/lecteur.ts`, testée ; ce composant ne fait qu'exécuter
   * cette décision contre l'API IFrame Player.
   *
   * Une seule méthode exposée au parent via `bind:this` — la seule façon
   * d'agir sur cette instance unique, partagée entre le sommaire et la
   * recherche (#15). Elle ne réagit qu'aux clics sur un épisode, jamais à
   * la navigation seule (onglet, recherche) : parcourir le catalogue ne
   * doit jamais interrompre une lecture en cours (issue #18).
   */
  import { commandePourEpisode, type EtatLecteur } from '../lib/lecteur';

  let { videoIdInitial }: { videoIdInitial: string } = $props();

  let conteneur: HTMLDivElement;
  let sentinelle: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
  // Vrai dès que le lecteur est effectivement collé en haut de la fenêtre
  // (issue #54) — `position: sticky` seul ne le dit pas, d'où la sentinelle
  // ci-dessous. Ne sert qu'à basculer une mise en page réduite sur petit
  // écran (voir le CSS) ; le lecteur lui-même se moque d'être collé ou non.
  let collant = $state(false);
  // `charge: false` : le constructeur `YT.Player` ne fait que mettre la
  // vidéo en attente, comme `cueVideoById` — rien n'est encore bufferisé
  // (src/lib/lecteur.ts pour la raison de cette distinction).
  let etat = $state<EtatLecteur | null>(null);

  function creerPlayer() {
    if (player) return; // une seule instance pour la vie du composant
    player = new YT.Player(conteneur, {
      videoId: videoIdInitial,
      playerVars: { rel: 0 },
      events: {
        onReady: () => {
          pret = true;
          etat = { videoId: videoIdInitial, charge: false };
        },
      },
    });
  }

  $effect(() => {
    // Le script externe iframe_api cherche `window.onYouTubeIframeAPIReady` :
    // une déclaration top-level dans un module n'est pas attachée à `window`
    // automatiquement (contrairement à un script classique), il faut
    // l'exposer explicitement (même piège que tools/pointage-manuel.html).
    //
    // Le garde de `creerPlayer` et la constance de `videoIdInitial` (fixée
    // par Site.svelte) évitent qu'une réexécution de cet effet ne crée un
    // second player.
    if (window.YT?.Player) {
      creerPlayer();
    } else {
      window.onYouTubeIframeAPIReady = creerPlayer;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }

    // Le composant ne démonte jamais (page unique, îlot `client:load`) : ce
    // nettoyage est là par correction, pas par nécessité. Le `<script>` de
    // l'API n'est pas retiré — c'est une ressource globale réutilisable.
    return () => {
      if (window.onYouTubeIframeAPIReady === creerPlayer) {
        window.onYouTubeIframeAPIReady = undefined;
      }
      player?.destroy();
      player = undefined;
    };
  });

  $effect(() => {
    // `position: sticky` ne déclenche aucun événement natif quand
    // l'élément se colle réellement — technique standard : une sentinelle
    // sans hauteur utile juste au-dessus, observée par rapport à la fenêtre
    // (`root` non précisé = son défaut). Elle sort de l'intersection pile
    // au moment où `.cadre` commence à coller (`top: 0` de part et d'autre).
    const observateur = new IntersectionObserver(
      ([entree]) => {
        collant = !entree.isIntersecting;
      },
      { threshold: 0 },
    );
    observateur.observe(sentinelle);
    return () => observateur.disconnect();
  });

  /**
   * Naviguer vers un épisode précis — clic sur un résultat de titre (lecture
   * immédiate, specs section 6) ou sur un épisode du sommaire.
   */
  export function allerA(videoId: string, secondes: number) {
    if (!pret || !player) return;

    const commande = commandePourEpisode(etat, videoId, secondes);
    if (commande.action === 'seek') {
      // `seekTo` ne relance pas la lecture si le lecteur était en pause.
      player.seekTo(commande.secondes, true);
      player.playVideo();
    } else {
      // `loadVideoById` charge *et* lance la lecture (doc API IFrame) —
      // vérifié bout en bout sur la preview de déploiement.
      player.loadVideoById({ videoId: commande.videoId, startSeconds: commande.secondes });
    }
    etat = { videoId, charge: true };
  }
</script>

<div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
<div class="cadre" class:collant>
  <div bind:this={conteneur}></div>
</div>

<style>
  /* Hauteur nulle : ne sert qu'à donner à l'IntersectionObserver un point
     de mesure situé juste au-dessus de .cadre (voir le script). */
  .sentinelle {
    height: 1px;
  }

  .cadre {
    position: sticky;
    /* Persistant au scroll (issue #54, specs section 6 : « Lecteur —
       persistant ») : sans ça, faire défiler un long sommaire sort le
       lecteur du champ et on perd le contexte de ce qu'on écoute. */
    top: 0;
    /* Au-dessus du contenu qui défile en dessous (barre de recherche,
       onglets, sommaire) une fois collé. */
    z-index: 1;
    width: 100%;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--esp-4);
    border-radius: var(--rayon-carte);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--ombre);
  }

  /* YT.Player remplace le div par un iframe : on le fait remplir --cadre
     plutôt que de dépendre de la taille qu'il s'attribuerait par défaut. */
  .cadre :global(iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  /* Sur petit écran, un lecteur collé en pleine largeur mange trop de
     hauteur utile pour le sommaire en dessous (issue #54) : une fois
     réellement collé (`.collant`, posé par l'IntersectionObserver — un
     simple `position: sticky` ne suffit pas à le savoir), il rétrécit en
     mini-lecteur aligné à droite. `max-width` (pas `width`) parce que
     `aspect-ratio` doit rester intact : la hauteur suit proportionnellement,
     pas de recadrage. 640px : premier point de rupture du site, pas encore
     de convention établie ailleurs (le menu déroulant mobile du sélecteur
     de livre, specs section 8, n'existe pas encore). */
  @media (max-width: 640px) {
    .cadre.collant {
      max-width: 50%;
      margin-left: auto;
      margin-bottom: var(--esp-2);
      transition: max-width 0.2s ease;
    }
  }

  @media (max-width: 640px) and (prefers-reduced-motion: reduce) {
    .cadre.collant {
      transition: none;
    }
  }
</style>
