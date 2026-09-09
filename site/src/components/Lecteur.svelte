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
   * Deux méthodes exposées au parent via `bind:this` — la seule façon
   * d'interagir avec une instance de lecteur unique partagée entre le
   * sélecteur de livre et, plus tard, la recherche (#15 à #18).
   */
  import { commandePourEpisode } from '../lib/lecteur';

  let { videoIdInitial }: { videoIdInitial: string } = $props();

  let conteneur: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
  let videoIdCharge = $state<string | null>(null);

  function creerPlayer() {
    player = new YT.Player(conteneur, {
      videoId: videoIdInitial,
      playerVars: { rel: 0 },
      events: {
        onReady: () => {
          pret = true;
          videoIdCharge = videoIdInitial;
        },
      },
    });
  }

  $effect(() => {
    // Le script externe iframe_api cherche `window.onYouTubeIframeAPIReady` :
    // une déclaration top-level dans un module n'est pas attachée à `window`
    // automatiquement (contrairement à un script classique), il faut
    // l'exposer explicitement (même piège que tools/pointage-manuel.html).
    if (window.YT?.Player) {
      creerPlayer();
      return;
    }
    window.onYouTubeIframeAPIReady = creerPlayer;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });

  /**
   * Naviguer vers un épisode précis — clic sur un résultat de titre (lecture
   * immédiate, specs section 6) ou sur un épisode du sommaire.
   */
  export function allerA(videoId: string, secondes: number) {
    if (!pret || !player) return;

    const commande = commandePourEpisode(videoIdCharge, videoId, secondes);
    if (commande.action === 'seek') {
      player.seekTo(commande.secondes, true);
      player.playVideo();
    } else {
      player.loadVideoById({ videoId: commande.videoId, startSeconds: commande.secondes });
      videoIdCharge = commande.videoId;
    }
  }

  /**
   * Bascule d'onglet seule, sans épisode choisi : la vidéo du livre change,
   * sans lancer la lecture (specs section 8 — l'onglet change la vidéo
   * chargée, il ne déclenche pas une lecture que l'utilisateur n'a pas
   * demandée).
   */
  export function choisirLivre(videoId: string) {
    if (!pret || !player || videoIdCharge === videoId) return;
    player.cueVideoById(videoId);
    videoIdCharge = videoId;
  }
</script>

<div class="cadre">
  <div bind:this={conteneur}></div>
</div>

<style>
  .cadre {
    position: relative;
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
</style>
