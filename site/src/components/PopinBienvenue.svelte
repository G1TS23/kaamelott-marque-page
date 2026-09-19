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
   *
   * Fermeture uniquement par le bouton (retour d'usage) : ni Échap, ni un
   * clic en dehors de la popin ne la ferme — seul « J'ai compris » le fait.
   * Conséquence à assumer pour rester accessible : le reste de la page
   * n'étant pas retiré du flux de tabulation, un piège de focus (`pieger`)
   * empêche <kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> d'atteindre ce contenu resté
   * sous la popin, masqué visuellement mais toujours dans le DOM.
   */
  import { URL_CHAINE_YOUTUBE_SHISHEYU } from '../lib/liens.ts';

  const CLE_STOCKAGE = 'marque-page:bienvenue-vue';

  let visible = $state(!aDejaVu());
  let lienYoutube: HTMLAnchorElement;
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

  // Seuls deux éléments sont focusables dans la popin (le lien puis le
  // bouton) : boucle Tab/Shift+Tab entre les deux plutôt que de laisser le
  // focus s'échapper vers le contenu masqué derrière (voir la note du
  // script ci-dessus sur le choix de ne pas fermer sur Échap/clic externe).
  function pieger(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !visible) return;
    if (e.shiftKey && document.activeElement === lienYoutube) {
      e.preventDefault();
      boutonFermer?.focus();
    } else if (!e.shiftKey && document.activeElement === boutonFermer) {
      e.preventDefault();
      lienYoutube?.focus();
    }
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

  // `inert` sur le reste de la page pendant que la popin est affichée
  // (revue a11y) : le piège de focus (`pieger`, ci-dessus) suffit au
  // clavier séquentiel, mais un lecteur d'écran en navigation libre
  // (curseur virtuel, pas Tab) pouvait toujours atteindre et lire le
  // contenu recouvert — `inert` le retire complètement de l'arbre
  // d'accessibilité, pas seulement masqué visuellement. Cette popin est
  // un îlot à part (`client:only`, index.astro) : pas d'accès direct au
  // reste de la page via des props, `<main>` (unique sur cette page)
  // ciblé par sélecteur.
  $effect(() => {
    const principal = document.querySelector('main');
    if (!principal) return;
    principal.inert = visible;
    return () => {
      principal.inert = false;
    };
  });
</script>

<svelte:window onkeydown={pieger} />

{#if visible}
  <div class="fond">
    <div class="popin" role="dialog" aria-modal="true" aria-labelledby="bienvenue-titre">
      <h2 id="bienvenue-titre">Bienvenue</h2>
      <p>
        Ce site aide à retrouver une scène dans les lectures-interprétations de
        Kaamelott publiées par Shisheyu sur YouTube, il ne les remplace pas,
        les vidéos restent sur sa chaîne.
      </p>
      <p>
        Merci à lui pour ces heures de lecture :
        <a bind:this={lienYoutube} href={URL_CHAINE_YOUTUBE_SHISHEYU} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">sa chaîne YouTube</span><span class="sr-only">Chaîne YouTube de Shisheyu (nouvel onglet)</span></a>.
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
    /* `--fond-modale`, pas `--encre` (retour d'usage) : `--encre` bascule
       en teinte claire en thème sombre (c'est le texte), un fond assombri
       construit dessus devenait au contraire trop clair — voir tokens.css. */
    background: color-mix(in srgb, var(--fond-modale) 45%, transparent);
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

  /* `--accent-fort`, pas `--accent` (revue a11y) : texte `--surface-haute`
     sur `--accent` ne donne que 4.22:1 en clair, sous le seuil AA de
     4.5:1 pour du texte de cette taille (16.5px, même semi-gras) —
     `--accent-fort` passe large (5.8:1 clair, 8.87:1 sombre). C'était
     déjà la couleur de survol ci-dessous : distinguée maintenant par une
     ombre plutôt qu'un changement de fond, qui aurait rendu les deux
     états identiques. */
  button {
    padding: 0.6em 1.4em;
    border: none;
    border-radius: var(--rayon-pilule);
    background: var(--accent-fort);
    color: var(--surface-haute);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  @media (hover: hover) {
    button:hover {
      box-shadow: var(--ombre);
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
