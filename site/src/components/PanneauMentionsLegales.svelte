<script lang="ts">
  /**
   * Panneau des mentions légales (issue #77) : superposé à la page sans
   * navigation réelle, pour ne jamais démonter l'îlot du site — et son
   * lecteur vidéo — juste pour lire un texte statique. Retour d'usage : le
   * détour par la page dédiée `/mentions-legales` relançait le lecteur
   * YouTube depuis zéro à chaque retour (rechargement complet, aucune
   * économie possible sans changer de mécanisme — le site n'a pas de
   * navigation côté client, `Site.svelte` n'en sait rien). La page reste
   * par ailleurs disponible telle quelle pour un accès direct ou partagé
   * (voir `Site.svelte` : seul le clic depuis le site est intercepté).
   *
   * Même pattern d'accessibilité que `RechercheMobile.svelte` : dialog,
   * <kbd>Échap</kbd>, défilement de la page verrouillé pendant l'ouverture.
   * Fond assombri cliquable pour fermer (`RechercheMobile` n'en a pas
   * besoin, plein écran sans rien en dessous) — ceinture avec le bouton de
   * fermeture et Échap.
   *
   * `MentionsLegalesContenu` : même contenu que la page statique, un seul
   * texte à tenir à jour plutôt que deux copies qui pourraient diverger.
   */
  import MentionsLegalesContenu from './MentionsLegalesContenu.svelte';

  let { onFermer }: { onFermer: () => void } = $props();

  let boutonFermer: HTMLButtonElement;

  function surTouche(e: KeyboardEvent) {
    if (e.key === 'Escape') onFermer();
  }

  // Focus sur le bouton de fermeture à l'ouverture (retour d'usage, même
  // esprit que le focus du champ dans RechercheMobile) : un dialog qui
  // s'ouvre doit déplacer le focus dedans, sans quoi il reste sur le lien
  // du pied de page maintenant recouvert.
  $effect(() => {
    boutonFermer?.focus();
  });

  // Verrouille le défilement de la page derrière le panneau — même retour
  // d'usage que RechercheMobile (deux scrollbars visibles à la fois sinon).
  $effect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  });
</script>

<svelte:window onkeydown={surTouche} />

<div class="fond" onclick={onFermer}>
  <div
    class="panneau"
    role="dialog"
    aria-modal="true"
    aria-label="Mentions légales"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="entete">
      <h2>Mentions légales</h2>
      <button
        bind:this={boutonFermer}
        type="button"
        class="fermer"
        onclick={onFermer}
        aria-label="Fermer"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
    <div class="corps">
      <MentionsLegalesContenu />
    </div>
  </div>
</div>

<style>
  /* Au-dessus de tout le reste (retour d'usage) : le pied de page (6),
     l'en-tête (6), le groupe collant (5), le panneau de résultats (7) et
     RechercheMobile (10) doivent tous pouvoir être recouverts, quel que
     soit l'état du site au moment du clic. */
  .fond {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--esp-4);
    background: color-mix(in srgb, var(--encre) 55%, transparent);
  }

  /* Même famille visuelle que le panneau de résultats de recherche
     (`.panneau-resultats`, Site.svelte) : --surface-haute/--rayon-carte/
     --ombre du design system (#51). */
  .panneau {
    width: 100%;
    max-width: 36rem;
    max-height: min(34rem, 100%);
    display: flex;
    flex-direction: column;
    background: var(--surface-haute);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-carte);
    box-shadow: var(--ombre);
  }

  .entete {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--esp-3);
    padding: var(--esp-3) var(--esp-3) var(--esp-3) var(--esp-4);
    border-bottom: 1px solid var(--trait);
  }

  .entete h2 {
    margin: 0;
    font-family: var(--police-titre);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--encre);
  }

  .fermer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--encre);
    cursor: pointer;
  }

  @media (hover: hover) {
    .fermer:hover {
      background: var(--surface);
    }
  }

  .fermer:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .corps {
    overflow-y: auto;
    padding: var(--esp-4);
  }
</style>
