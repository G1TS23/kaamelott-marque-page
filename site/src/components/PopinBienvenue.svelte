<script lang="ts">
  /**
   * Popin de première visite (issue #19) : remercie Shisheyu et rappelle la
   * démarche du site (outil de navigation non officiel, pas un site
   * officiel — SPECS.md section 8, dernier point des user stories).
   * Affichée une seule fois par visiteur, indicateur `localStorage` (même
   * tolérance qu'ailleurs sur le site : une popin qui reste muette d'une
   * visite à l'autre — navigation privée, quota — ne doit jamais bloquer
   * l'accès au site, voir `fermer`).
   *
   * Le lien vers la chaîne de Shisheyu reste de toute façon accessible en
   * permanence en pied de page (`PiedDePage.svelte`) : fermer cette popin
   * sans cliquer le lien n'en prive donc personne.
   */
  import { URL_CHAINE_YOUTUBE_SHISHEYU } from '../lib/liens.ts';

  const CLE_STOCKAGE = 'marque-page:bienvenue-vue';

  let visible = $state(!aDejaVu());
  let boutonFermer: HTMLButtonElement;

  function aDejaVu(): boolean {
    try {
      return localStorage.getItem(CLE_STOCKAGE) === '1';
    } catch {
      return false;
    }
  }

  function fermer() {
    visible = false;
    try {
      localStorage.setItem(CLE_STOCKAGE, '1');
    } catch {
      // Pas grave si ça ne persiste pas d'une visite à l'autre : la popin
      // réapparaîtra, sans jamais empêcher d'utiliser le site.
    }
  }

  function surClicFond(e: MouseEvent) {
    if (e.target === e.currentTarget) fermer();
  }

  function surTouche(e: KeyboardEvent) {
    if (e.key === 'Escape') fermer();
  }

  $effect(() => {
    if (visible) boutonFermer?.focus();
  });

  // Verrouille le défilement derrière la popin le temps qu'elle est
  // affichée (même technique que l'écran de recherche mobile,
  // RechercheMobile.svelte).
  $effect(() => {
    if (!visible) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  });
</script>

<svelte:window onkeydown={surTouche} />

{#if visible}
  <div class="fond" onclick={surClicFond}>
    <div class="popin" role="dialog" aria-modal="true" aria-labelledby="bienvenue-titre">
      <h2 id="bienvenue-titre">Bienvenue</h2>
      <p>
        Ce site aide à retrouver une scène dans les lectures-interprétations de
        Kaamelott publiées par Shisheyu sur YouTube, il ne les remplace pas,
        les vidéos restent sur sa chaîne.
      </p>
      <p>
        Merci à lui pour ces heures de lecture :
        <a href={URL_CHAINE_YOUTUBE_SHISHEYU} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">sa chaîne YouTube</span><span class="sr-only">Chaîne YouTube de Shisheyu (nouvel onglet)</span></a>.
      </p>
      <p>
        Kaamelott et ses dialogues appartiennent à Alexandre Astier et aux
        ayants droit d'origine de l'œuvre. Ce site n'est affilié ni à
        Alexandre Astier et ses ayants droit, ni à Shisheyu.
      </p>
      <button type="button" bind:this={boutonFermer} onclick={fermer}> J'ai compris </button>
    </div>
  </div>
{/if}

<style>
  .fond {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--esp-4);
    background: color-mix(in srgb, var(--encre) 45%, transparent);
  }

  .popin {
    max-width: 28rem;
    max-height: calc(100vh - 2 * var(--esp-4));
    overflow-y: auto;
    padding: var(--esp-5);
    border-radius: var(--rayon-carte);
    background: var(--surface-haute);
    box-shadow: var(--ombre);
  }

  h2 {
    margin: 0 0 var(--esp-3);
  }

  p {
    margin: 0 0 var(--esp-3);
    color: var(--encre-douce);
  }

  .popin a {
    color: var(--profond);
    text-decoration: underline;
  }

  button {
    padding: 0.6em 1.4em;
    border: none;
    border-radius: var(--rayon-pilule);
    background: var(--accent);
    color: var(--surface-haute);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  @media (hover: hover) {
    button:hover {
      background: var(--accent-fort);
    }
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
