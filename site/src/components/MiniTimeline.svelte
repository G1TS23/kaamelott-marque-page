<script lang="ts">
  /**
   * Barre d'avancement bornée à l'épisode en cours (issue #56) : la
   * timeline native YouTube couvre ~6h30 sur toute la vidéo, imprécise même
   * aux flèches pour se replacer dans une scène précise. Celle-ci ne
   * couvre que l'épisode affiché — glisser dessus ne peut jamais empiéter
   * sur l'épisode suivant (`secondesDepuisRatio`, src/lib/timeline.ts).
   *
   * Logique de conversion position ↔ ratio isolée dans src/lib/timeline.ts
   * (testée, convention du projet — SonarCloud n'analyse pas les
   * `.svelte`) ; ce composant ne fait que la brancher sur des événements
   * pointeur/clavier et dessiner le résultat.
   */
  import { formaterTempsEcoule } from '../lib/temps.ts';
  import { type BornesEpisode, ratioDepuisSecondes, secondesDepuisRatio } from '../lib/timeline.ts';

  let {
    bornes,
    position,
    onSeek,
  }: {
    bornes: BornesEpisode;
    position: number;
    onSeek: (secondes: number) => void;
  } = $props();

  let barre: HTMLDivElement;
  let enGlissement = $state(false);

  const ratio = $derived(ratioDepuisSecondes(position, bornes));
  const ecoule = $derived(Math.max(0, position - bornes.basse));
  const duree = $derived(Math.max(0, bornes.haute - bornes.basse));

  // Pas de 5s (retour d'usage) : une seconde par appui de flèche serait
  // imperceptible sur un épisode de 20-30 minutes.
  const PAS_FLECHE = 5;

  function ratioDepuisPointeur(e: PointerEvent): number {
    const rect = barre.getBoundingClientRect();
    return rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
  }

  function surPointerDown(e: PointerEvent) {
    enGlissement = true;
    onSeek(secondesDepuisRatio(ratioDepuisPointeur(e), bornes));
  }

  // N'écoute le déplacement/relâchement du pointeur qu'en cours de
  // glissement (même mécanique que le clic extérieur du panneau de
  // recherche, Site.svelte) : le pointeur peut sortir de la barre pendant
  // le geste, `window` capte le mouvement partout tant qu'on glisse.
  $effect(() => {
    if (!enGlissement) return;
    function surPointerMove(e: PointerEvent) {
      onSeek(secondesDepuisRatio(ratioDepuisPointeur(e), bornes));
    }
    function finGlissement() {
      enGlissement = false;
    }
    window.addEventListener('pointermove', surPointerMove);
    window.addEventListener('pointerup', finGlissement);
    return () => {
      window.removeEventListener('pointermove', surPointerMove);
      window.removeEventListener('pointerup', finGlissement);
    };
  });

  function surTouche(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        onSeek(Math.max(bornes.basse, position - PAS_FLECHE));
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        onSeek(Math.min(bornes.haute, position + PAS_FLECHE));
        break;
      case 'Home':
        e.preventDefault();
        onSeek(bornes.basse);
        break;
      case 'End':
        e.preventDefault();
        onSeek(bornes.haute);
        break;
    }
  }
</script>

<div class="mini-timeline">
  <div
    class="barre"
    bind:this={barre}
    role="slider"
    tabindex="0"
    aria-label="Position dans l'épisode"
    aria-valuemin={0}
    aria-valuemax={Math.round(duree)}
    aria-valuenow={Math.round(ecoule)}
    aria-valuetext={`${formaterTempsEcoule(ecoule)} sur ${formaterTempsEcoule(duree)}`}
    onpointerdown={surPointerDown}
    onkeydown={surTouche}
  >
    <div class="remplissage" style="width: {ratio * 100}%"></div>
    <div class="poignee" style="left: {ratio * 100}%"></div>
  </div>
  <span class="temps">{formaterTempsEcoule(ecoule)} / {formaterTempsEcoule(duree)}</span>
</div>

<style>
  .mini-timeline {
    display: flex;
    align-items: center;
    gap: var(--esp-2);
  }

  /* Zone de clic/glisser plus haute que la piste visuelle elle-même
     (retour d'usage récurrent sur ce projet : une cible fine est difficile
     à viser au doigt) — la piste et son remplissage sont centrés dedans. */
  .barre {
    position: relative;
    flex: 1;
    height: 1.25rem;
    cursor: pointer;
    /* Le geste pilote le seek, pas le défilement de la page (mobile). */
    touch-action: none;
  }

  .barre::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    transform: translateY(-50%);
    border-radius: var(--rayon-pilule);
    background: var(--trait);
  }

  .remplissage {
    position: absolute;
    top: 50%;
    left: 0;
    height: 4px;
    transform: translateY(-50%);
    border-radius: var(--rayon-pilule);
    background: var(--accent);
    pointer-events: none;
  }

  /* Poignée ronde (retour d'usage) : une simple barre ne suggère pas
     qu'on peut la manipuler, contrairement à un point qu'on associe
     d'instinct à un curseur qu'on fait glisser (même rôle que le curseur
     de la timeline YouTube native). `pointer-events: none` : le geste est
     déjà géré par `.barre` sur toute sa largeur, pas seulement sur ce
     point précis. */
  .poignee {
    position: absolute;
    top: 50%;
    width: 0.7rem;
    height: 0.7rem;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: var(--accent);
    box-shadow: var(--ombre);
    pointer-events: none;
  }

  .barre:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--rayon-pilule);
  }

  .temps {
    flex-shrink: 0;
    font-family: var(--police-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    color: var(--encre-pale);
  }
</style>
