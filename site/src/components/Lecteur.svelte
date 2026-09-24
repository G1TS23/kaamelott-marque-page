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
   *
   * `demarre`/facade (issue 119, audit de stabilisation — Core Web
   * Vitals) : jusqu'ici l'API IFrame (script externe + `YT.Player`) se
   * chargeait dès le montage de ce composant, donc dès le chargement de
   * la page — même si personne ne cliquait jamais sur lecture. `demarre`
   * (faux par défaut, vrai d'emblée pour un lien profond — voir plus bas)
   * retarde tout ça derrière un écran-titre léger (miniature YouTube +
   * bouton), sans script ni iframe tant qu'il est affiché. `videoIdACreer`/
   * `secondesACreer`/`jouerAuDemarrage` sont des copies mutables des props
   * `videoIdInitial`/`secondesInitiales`/`lireAuDemarrage` : `allerA`/
   * `basculerLecture` appelés *avant* que la facade n'ait jamais été
   * quittée (clic sur un épisode du sommaire, ou bouton lecture des
   * contrôles de transport, tous deux atteignables avant tout premier
   * clic sur la vidéo elle-même) doivent créer le lecteur directement sur
   * la bonne vidéo/position — pas question de construire d'abord sur
   * `videoIdInitial` puis appeler `loadVideoById` pour rien.
   */
  import { commandePourEpisode, type EtatLecteur } from '../lib/lecteur';

  let {
    videoIdInitial,
    reduit,
    titre = "l'épisode",
    onChangementEngagement,
    onLectureChange,
    onProgression,
    secondesInitiales = 0,
    lireAuDemarrage = false,
  }: {
    videoIdInitial: string;
    reduit: boolean;
    /** Nom accessible du bouton de la facade (issue 119) — pas de titre
     * d'épisode connu de ce composant sinon, seulement des identifiants. */
    titre?: string;
    onChangementEngagement: (engagee: boolean) => void;
    onLectureChange: (enLecture: boolean) => void;
    onProgression: (secondes: number, duree: number) => void;
    secondesInitiales?: number;
    lireAuDemarrage?: boolean;
  } = $props();

  let conteneur: HTMLDivElement;
  let player: YT.Player | undefined;
  let pret = $state(false);
  // Lien profond (issue #21) : la facade n'a pas lieu d'être, la vidéo doit
  // démarrer tout de suite à la bonne position — voir la note du script.
  let demarre = $state(lireAuDemarrage);
  let videoIdACreer = $state(videoIdInitial);
  let secondesACreer = $state(secondesInitiales);
  let jouerAuDemarrage = $state(lireAuDemarrage);
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
      videoId: videoIdACreer,
      playerVars: { rel: 0, start: Math.floor(secondesACreer) },
      events: {
        onReady: () => {
          // Garde par précaution (retour d'usage) : l'API ne devrait
          // appeler `onReady` qu'une fois, mais un second appel
          // réinitialiserait `etat` à `charge: false` alors qu'une vidéo
          // est peut-être déjà réellement chargée — `allerA` la
          // rechargerait alors pour rien à chaque appel.
          if (pret) return;
          pret = true;
          etat = { videoId: videoIdACreer, charge: false };
          demarrerSuiviProgression();
          // `playerVars.start` (ci-dessus) n'accepte qu'un entier — un
          // `seekTo` de précision corrige l'arrondi avant de lancer la
          // lecture (retour d'usage : sans lui, le sommaire surlignait
          // l'épisode précédent tant que `start_seconds` a une partie
          // décimale, `episodeEnCoursDetails` comparant la vraie position
          // arrondie à la borne exacte).
          if (secondesACreer) player?.seekTo(secondesACreer, true);
          if (jouerAuDemarrage) {
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
    // Tant que la facade est affichée (issue 119), aucun script ni iframe
    // ne se charge — voir la note du script sur `demarre`. Cet effet se
    // relance automatiquement dès que `demarre` passe à vrai (Svelte
    // réagit à la lecture de cette valeur), pas besoin de le déclencher
    // manuellement depuis `demarrerFacade`/`allerA`/`basculerLecture`.
    if (!demarre) return;

    // Le script externe iframe_api cherche `window.onYouTubeIframeAPIReady` :
    // une déclaration top-level dans un module n'est pas attachée à `window`
    // automatiquement (contrairement à un script classique), il faut
    // l'exposer explicitement (même piège que tools/pointage-manuel.html).
    //
    // Le garde de `creerPlayer` et la constance de `videoIdACreer` (figée
    // une fois `demarre` passé à vrai) évitent qu'une réexécution de cet
    // effet ne crée un second player.
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
   * Quitte la facade et crée le vrai lecteur (issue 119) — factorisé entre
   * le clic sur la facade elle-même et les deux autres façons d'atteindre
   * une action de lecture avant d'y avoir jamais cliqué (`allerA` depuis le
   * sommaire, `basculerLecture` depuis les contrôles de transport : les
   * deux restent visibles/actifs même quand la facade est encore affichée,
   * voir `Site.svelte`).
   */
  function demarrer() {
    jouerAuDemarrage = true;
    chargement = true; // optimiste, voir la note du script sur `chargement`
    demarre = true;
  }

  /** Clic direct sur la facade (miniature + bouton). */
  function demarrerFacade() {
    demarrer();
  }

  /**
   * Naviguer vers un épisode précis — clic sur un résultat de titre (lecture
   * immédiate, specs section 6) ou sur un épisode du sommaire.
   */
  export function allerA(videoId: string, secondes: number) {
    if (!demarre) {
      // Facade jamais quittée : construit directement sur la bonne vidéo/
      // position plutôt que de créer d'abord le lecteur sur `videoIdInitial`
      // pour appeler `loadVideoById` juste après.
      videoIdACreer = videoId;
      secondesACreer = secondes;
      demarrer();
      return;
    }
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
    if (!demarre) {
      // Bouton lecture des contrôles de transport, cliqué avant tout clic
      // sur la facade elle-même (les contrôles restent visibles dès qu'un
      // épisode est affiché, pas seulement une fois la lecture engagée) :
      // démarre directement sur la vidéo/position déjà prévues.
      demarrer();
      return;
    }
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
  {#if demarre}
    <div bind:this={conteneur}></div>
  {:else}
    <!-- Facade (issue 119) : miniature YouTube (toujours disponible en
         hqdefault.jpg, contrairement aux résolutions plus hautes) + bouton
         lecture, sans script ni iframe tant qu'elle est affichée. `alt=""`
         sur l'image : le nom accessible vient du bouton qui l'englobe, pas
         la peine de l'annoncer deux fois. -->
    <button type="button" class="facade" onclick={demarrerFacade} aria-label={`Lire ${titre}`}>
      <img src={`https://i.ytimg.com/vi/${videoIdACreer}/hqdefault.jpg`} alt="" loading="lazy" />
      <svg class="bouton-lecture" viewBox="0 0 68 48" aria-hidden="true">
        <path
          d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26Z"
          fill="var(--encre)"
          opacity="0.8"
        />
        <path d="M45 24 27 14v20Z" fill="var(--surface-haute)" />
      </svg>
    </button>
  {/if}
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
    /* Retour d'usage, mobile : sans ça, le scroll fluide vers le haut
       déclenché au clic d'un épisode (`Site.svelte`, `onEpisodeClick`)
       entrait en concurrence avec l'ancrage de scroll natif du navigateur
       — celui-ci ajuste `scrollTop` de lui-même pour compenser ce cadre
       qui regrossit pendant la transition ci-dessus, ce qui contredisait
       le `scrollTo` en cours de façon incohérente selon le timing (marche
       un coup sur deux). Ce cadre est justement l'élément que ce
       `scrollTo` cherche à amener en haut de l'écran : il ne doit jamais
       servir de point d'ancrage à sa propre compensation. */
    overflow-anchor: none;
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

  /* Facade (issue 119) : occupe tout --cadre comme le ferait l'iframe,
     miniature en fond (`object-fit: cover`, comme l'iframe elle ne doit
     jamais laisser voir de bande vide sur les bords) et bouton de lecture
     centré par-dessus. */
  .facade {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: var(--surface);
    cursor: pointer;
  }

  .facade img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bouton-lecture {
    position: relative;
    width: 30%;
    max-width: 4.5rem;
    /* Légèrement grossi au survol/focus (retour d'usage habituel sur ce
       genre d'affordance) — respecte `prefers-reduced-motion` ci-dessous. */
    transition: transform 0.15s ease;
  }

  @media (hover: hover) {
    .facade:hover .bouton-lecture {
      transform: scale(1.08);
    }
  }

  .facade:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .facade:focus-visible .bouton-lecture {
    transform: scale(1.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .bouton-lecture {
      transition: none;
    }

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
