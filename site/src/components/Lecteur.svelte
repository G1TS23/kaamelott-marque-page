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
   *
   * Ne gère plus lui-même sa persistance au scroll (issue #54) : `reduit`
   * est décidé par `Site.svelte`, qui colle le lecteur *et* les onglets
   * ensemble (« groupe collant ») — deux composants frères, la position
   * collante ne peut appartenir qu'à leur parent commun.
   */
  import { commandePourEpisode, type EtatLecteur } from '../lib/lecteur';

  let { videoIdInitial, reduit }: { videoIdInitial: string; reduit: boolean } = $props();

  let conteneur: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
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

<div class="cadre" class:reduit>
  <div bind:this={conteneur}></div>
</div>

<style>
  .cadre {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--rayon-carte);
    overflow: hidden;
    background: var(--surface);
    box-shadow: var(--ombre);
    flex-shrink: 0;
    transition: width 0.22s ease;
  }

  /* Réduit en mini-lecteur une fois collé avec les onglets (issue #54,
     retour d'usage — voir .groupe-collant dans Site.svelte) : rem plutôt
     que px pour rester cohérent avec le reste du système de tailles (même
     raison que la hauteur des onglets). `width` (pas `max-width`) : dans le
     `display: flex` du groupe, la taille doit changer pour de vrai, pas
     juste se plafonner. `aspect-ratio` reste intact, donc pas de recadrage
     de l'image, juste une réduction proportionnelle. */
  .cadre.reduit {
    width: 6rem;
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

  @media (prefers-reduced-motion: reduce) {
    .cadre {
      transition: none;
    }
  }
</style>
