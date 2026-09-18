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
   *
   * Mis à `true` de façon optimiste à chaque tentative de lecture
   * (`allerA`, autoplay du lien profond), pas seulement en réaction à
   * `BUFFERING` (retour d'usage : l'événement met parfois plusieurs
   * secondes à arriver après l'appel, laissant l'écran noir sans overlay
   * pendant l'essentiel de l'attente). Sans risque de rester bloqué à
   * `true` à tort : `onStateChange` (plus bas) réaligne `chargement` sur
   * l'état réel dès le premier événement reçu, quel qu'il soit.
   *
   * `onLectureChange` (contrôles de transport) : contrairement à
   * `chargement`, l'état lecture/pause doit remonter — le bouton qui
   * l'affiche vit dans `Site.svelte`, à côté de la mini-timeline, pas dans
   * ce composant. `BUFFERING` y compte comme « en lecture » (au même titre
   * que dans `onChangementEngagement`) : l'intention de l'utilisateur est
   * de lire, le bouton ne doit pas clignoter sur l'icône pause pendant un
   * rebufferisation.
   *
   * `engage` (retour d'usage) — l'API ne se contente pas d'un aller
   * simple vers `PLAYING` : `UNSTARTED`/`CUED` peuvent réapparaître en
   * cours de session (pas seulement au tout début), y compris plusieurs
   * secondes après un `PLAYING` bien réel — observé en pratique pendant
   * un chargement lent. Le comportement voulu (déjà énoncé plus bas :
   * « une pause ne doit pas décoller le lecteur… seule la fin de la
   * vidéo remet à zéro ») n'était en fait pas respecté : `UNSTARTED`/
   * `CUED` retombaient à « non engagé » comme si la vidéo n'avait jamais
   * démarré, ce qui faisait clignoter tout ce qui dépend de
   * `lectureEngagee` (repère, mini-timeline, contrôles de transport).
   * `engage` mémorise le dernier état réellement engagé et n'est remis à
   * zéro que par un `ENDED` explicite — `UNSTARTED`/`CUED` intercalés
   * sont désormais ignorés plutôt que traités comme une perte
   * d'engagement.
   *
   * `secondesInitiales`/`lireAuDemarrage` (lien profond, issue #21) :
   * positionne le lecteur dès sa construction (`playerVars.start`) plutôt
   * que d'appeler `allerA` une fois prêt — `allerA` passe par
   * `loadVideoById`, qui rechargerait une vidéo déjà cued pour rien.
   * `lireAuDemarrage` tente ensuite `playVideo()` une fois prêt (même
   * esprit que `loadVideoById` : ouvrir un lien partagé doit lancer la
   * lecture, pas seulement positionner une vignette) — un lancement
   * déclenché par notre propre code (pas un vrai clic) se heurte à la
   * politique d'autoplay du navigateur : sur Chrome, la vidéo passait par
   * `BUFFERING` puis retombait à `CUED`/`UNSTARTED` sans jamais atteindre
   * `PLAYING` (l'API bloque la lecture réelle) — pas reproduit sur
   * Safari, plus tolérant dans ce contexte précis.
   *
   * Le vrai bug (retour d'usage : la vidéo restait bloquée sur la
   * vignette avec l'overlay de chargement affiché) n'était pas cette
   * politique elle-même — un blocage propre est très bien géré (la vidéo
   * retombe simplement sur sa position cued, comme si `lireAuDemarrage`
   * n'avait jamais été demandé) — mais `chargement` (voir plus bas) qui
   * ne se réinitialisait qu'au prochain `onStateChange` *traité*, et
   * `CUED`/`UNSTARTED` étaient justement ignorés (voir la note sur
   * `engage`) : le retour de `BUFFERING` à `CUED` après un blocage
   * laissait l'overlay affiché pour de bon, plus aucun événement suivant
   * pour le corriger.
   */
  import { commandePourEpisode, type EtatLecteur } from '../lib/lecteur';

  let {
    videoIdInitial,
    reduit,
    onChangementEngagement,
    onLectureChange,
    onProgression,
    secondesInitiales = 0,
    lireAuDemarrage = false,
  }: {
    videoIdInitial: string;
    reduit: boolean;
    onChangementEngagement: (engagee: boolean) => void;
    onLectureChange: (enLecture: boolean) => void;
    onProgression: (secondes: number, duree: number) => void;
    secondesInitiales?: number;
    lireAuDemarrage?: boolean;
  } = $props();

  let conteneur: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
  // `charge: false` : le constructeur `YT.Player` ne fait que mettre la
  // vidéo en attente, comme `cueVideoById` — rien n'est encore bufferisé
  // (src/lib/lecteur.ts pour la raison de cette distinction).
  let etat = $state<EtatLecteur | null>(null);
  let chargement = $state(false);
  // Voir la note du script sur `engage` : dernier état réellement engagé
  // connu, distinct de l'état brut de l'événement `onStateChange` reçu.
  let engage = false;
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
      playerVars: { rel: 0, start: Math.floor(secondesInitiales) },
      events: {
        onReady: () => {
          // Garde par précaution (retour d'usage) : l'API ne devrait
          // appeler `onReady` qu'une fois, mais un second appel
          // réinitialiserait `etat` à `charge: false` alors qu'une vidéo
          // est peut-être déjà réellement chargée — `allerA` la
          // rechargerait alors pour rien à chaque appel.
          if (pret) return;
          pret = true;
          etat = { videoId: videoIdInitial, charge: false };
          demarrerSuiviProgression();
          // `playerVars.start` (ci-dessus) n'accepte qu'un entier — un
          // `seekTo` de précision corrige l'arrondi avant de lancer la
          // lecture (retour d'usage : sans lui, le sommaire surlignait
          // l'épisode précédent tant que `start_seconds` a une partie
          // décimale, `episodeEnCoursDetails` comparant la vraie position
          // arrondie à la borne exacte).
          if (secondesInitiales) player?.seekTo(secondesInitiales, true);
          if (lireAuDemarrage) {
            chargement = true;
            player?.playVideo();
          }
        },
        // Une vignette jamais lancée (`CUED`/`UNSTARTED`) ne compte pas
        // comme « engagée » (retour d'usage sur #54) : sans quoi parcourir
        // le sommaire sans rien écouter collerait quand même un lecteur en
        // pleine taille. Une fois lancée, en revanche, rien ne doit
        // décoller le lecteur avant la vraie fin de la vidéo (autre retour
        // d'usage) : `PAUSED` et `BUFFERING` comptent autant que
        // `PLAYING`, et `UNSTARTED`/`CUED` réapparaissant en cours de
        // session sont ignorés plutôt que traités comme un retour à l'état
        // initial (voir la note du script sur `engage`). Seule `ENDED`
        // remet vraiment à zéro.
        onStateChange: (e) => {
          // `chargement` (bug corrigé, lien profond #21) : mis à jour
          // avant le tri par branche ci-dessous, pas seulement pour les
          // transitions qui comptent pour `engage`. Un autoplay bloqué par
          // le navigateur repasse par `BUFFERING` puis retombe sur
          // `CUED`/`UNSTARTED` (jamais `PAUSED`) — cette transition-là
          // était ignorée plus bas (voir la note du script), laissant
          // l'overlay de chargement affiché pour de bon, sans plus aucun
          // événement pour le corriger.
          chargement = e.data === YT.PlayerState.BUFFERING;
          const enLecture =
            e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING;
          if (enLecture || e.data === YT.PlayerState.PAUSED) {
            engage = true;
          } else if (e.data === YT.PlayerState.ENDED) {
            engage = false;
          } else {
            return; // UNSTARTED/CUED intercalés : ignorés pour l'engagement (voir la note du script)
          }
          onChangementEngagement(engage);
          onLectureChange(enLecture);
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
    chargement = true; // optimiste, voir la note du script sur `chargement`
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

  /**
   * Bouton lecture/pause des contrôles de transport (`Site.svelte`) — se
   * contente de relayer l'intention vers l'API IFrame, `onStateChange` se
   * charge de rapporter le nouvel état réel (`onLectureChange`), pas
   * besoin de le déduire ici. Le test couvre aussi `BUFFERING`, pas
   * seulement `PLAYING` : c'est le même critère que `enLecture` plus haut
   * (l'icône affichée au moment du clic), sans quoi cliquer « pause »
   * pendant une rebufferisation relançait la lecture au lieu de la
   * mettre en pause pour de vrai.
   */
  export function basculerLecture() {
    if (!pret || !player) return;
    const etatCourant = player.getPlayerState();
    if (etatCourant === YT.PlayerState.PLAYING || etatCourant === YT.PlayerState.BUFFERING) {
      player.pauseVideo();
    } else {
      chargement = true; // optimiste, voir la note du script sur `chargement`
      player.playVideo();
    }
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
