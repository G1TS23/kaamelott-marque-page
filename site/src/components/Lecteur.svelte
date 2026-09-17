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
   * collante ne peut appartenir qu'à leur parent commun. `Site.svelte` a
   * en retour besoin de savoir si une vidéo a été *engagée* (lancée, et pas
   * juste affichée en vignette) pour décider de réduire ou non —
   * `onChangementEngagement` relaie l'état posé par l'API IFrame
   * (`onStateChange`), que ce composant est seul à connaître.
   *
   * De même pour la position de lecture (issue #56) : `Site.svelte` déduit
   * l'épisode « en cours » (ligne surlignée du sommaire, repère du lecteur
   * réduit) du couple vidéo + position plutôt que du dernier épisode
   * cliqué — sans quoi la vidéo qui avance toute seule jusqu'à l'épisode
   * suivant, ou un clic dans la barre de progrès YouTube, laisseraient
   * l'ancien épisode surligné. `onStateChange` ne dit que « en lecture »,
   * pas « à quelle seconde » : `onProgression` relaie `getCurrentTime()`
   * *et* `getDuration()` (borne haute de la mini-timeline pour le dernier
   * épisode d'un livre, `Site.svelte` — seule l'API IFrame connaît l'une
   * comme l'autre).
   *
   * `chargement` (issue #56) reste interne à ce composant, contrairement
   * au reste de l'état ci-dessus : c'est un pur retour visuel sur son
   * propre lecteur, personne d'autre n'en a besoin. Vrai sur `BUFFERING`
   * — observé en pratique jusqu'à 5-6s sur un saut vers un point jamais
   * bufferisé d'une vidéo de plusieurs heures (écran noir, sous-titres qui
   * s'affichent avant l'image, flux séparé plus léger) : pas un bug de ce
   * code (`loadVideoById`/`seekTo` sont bien appelés), une latence
   * réseau/CDN normale mais invisible sans ce retour.
   */
  import { commandePourEpisode, type EtatLecteur } from '../lib/lecteur';

  let {
    videoIdInitial,
    reduit,
    onChangementEngagement,
    onProgression,
  }: {
    videoIdInitial: string;
    reduit: boolean;
    onChangementEngagement: (engagee: boolean) => void;
    onProgression: (secondes: number, duree: number) => void;
  } = $props();

  let conteneur: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
  // `charge: false` : le constructeur `YT.Player` ne fait que mettre la
  // vidéo en attente, comme `cueVideoById` — rien n'est encore bufferisé
  // (src/lib/lecteur.ts pour la raison de cette distinction).
  let etat = $state<EtatLecteur | null>(null);
  let chargement = $state(false);
  // Sondage de `getCurrentTime()` (issue #56) : l'API IFrame ne notifie que
  // les changements d'état (`onStateChange`), jamais l'avancement continu
  // de la lecture — un intervalle est la seule façon de suivre la position.
  // 1s : assez réactif pour rattraper un changement d'épisode ou un saut
  // dans la barre de progrès sans perceptible retard, sans solliciter l'API
  // à chaque frame pour une info qui n'a pas besoin de cette précision.
  let intervalleProgression: ReturnType<typeof setInterval> | undefined;

  function demarrerSuiviProgression() {
    if (intervalleProgression !== undefined) return; // un seul sondage à la fois
    intervalleProgression = setInterval(() => {
      if (player) onProgression(player.getCurrentTime(), player.getDuration());
    }, 1000);
  }

  function creerPlayer() {
    if (player) return; // une seule instance pour la vie du composant
    player = new YT.Player(conteneur, {
      videoId: videoIdInitial,
      playerVars: { rel: 0 },
      events: {
        onReady: () => {
          pret = true;
          etat = { videoId: videoIdInitial, charge: false };
          demarrerSuiviProgression();
        },
        // Une vignette jamais lancée (`CUED`/`UNSTARTED`) ne compte pas
        // comme « engagée » (retour d'usage sur #54) : sans quoi parcourir
        // le sommaire sans rien écouter collerait quand même un lecteur en
        // pleine taille. Une fois lancée, en revanche, une pause ne doit
        // pas décoller le lecteur (autre retour d'usage) : `PAUSED` et
        // `BUFFERING` comptent autant que `PLAYING`. Seule la fin de la
        // vidéo (`ENDED`) remet à zéro, comme un retour à l'état initial.
        onStateChange: (e) => {
          const enSession =
            e.data === YT.PlayerState.PLAYING ||
            e.data === YT.PlayerState.PAUSED ||
            e.data === YT.PlayerState.BUFFERING;
          onChangementEngagement(enSession);
          chargement = e.data === YT.PlayerState.BUFFERING;
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
      if (intervalleProgression !== undefined) {
        clearInterval(intervalleProgression);
        intervalleProgression = undefined;
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
  {#if chargement}
    <div class="chargement" aria-live="polite">Chargement…</div>
  {/if}
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

  /* Réduit en mini-lecteur une fois collé avec les onglets, et seulement si
     une vidéo joue réellement (issue #54, retour d'usage — voir
     .groupe-collant dans Site.svelte). rem plutôt que px pour rester
     cohérent avec le reste du système de tailles. `width` (pas
     `max-width`) : dans le `display: flex` du groupe, la taille doit
     changer pour de vrai, pas juste se plafonner. `aspect-ratio` reste
     intact, donc pas de recadrage de l'image, juste une réduction
     proportionnelle. 10rem (160px) plutôt que la première valeur essayée
     (6rem/96px, retour d'usage : trop petit pour distinguer quoi que ce
     soit à l'image). */
  .cadre.reduit {
    width: 10rem;
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

  /* Retour visuel pendant l'état `BUFFERING` (voir le commentaire du
     script) : sans lui, un saut vers un point jamais bufferisé ressemble à
     un blocage (écran noir, sous-titres qui s'affichent avant l'image). */
  .chargement {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--encre) 55%, transparent);
    color: var(--surface-haute);
    font-family: var(--police-mono);
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    pointer-events: none;
  }

  .cadre.reduit .chargement {
    font-size: 0.55rem;
    letter-spacing: 0.02em;
  }
</style>
