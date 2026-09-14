<script lang="ts">
  /**
   * Sommaire du livre actif (issue #13).
   *
   * Anciennement `SelecteurLivre.svelte` — renommé quand les onglets en ont
   * été extraits (`Onglets.svelte`, issue #54) : ce composant ne montre
   * plus que la liste elle-même.
   *
   * Ne montre plus jamais les résultats de recherche (issue #16) : ils
   * vivent dans leur propre panneau (`ResultatsRecherche.svelte`, flottant
   * sur desktop dans `Site.svelte`, plein écran dans `RechercheMobile.svelte`)
   * plutôt que de remplacer cette liste en place — retour d'usage sur la
   * maquette, un panneau ancré au champ se lit mieux qu'un sommaire qui
   * change de nature sous les yeux.
   *
   * Purement présentationnel : `livreActif` et l'épisode en cours sont
   * décidés par `Site.svelte`, qui possède aussi le lecteur.
   */
  import type { EpisodeListe, LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
  import { formaterTemps } from '../lib/temps.ts';

  let {
    livres,
    livreActif,
    episodeActif,
    onEpisodeClick,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    episodeActif: { livre: NumeroLivre; episode: number } | null;
    onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
  } = $props();

  const episodesDuLivre = $derived(
    livres.find((l) => l.livre === livreActif)?.episodes ?? [],
  );

  function estActif(livre: NumeroLivre, episode: number): boolean {
    return episodeActif?.livre === livre && episodeActif.episode === episode;
  }
</script>

{#snippet ligne(livre: NumeroLivre, episode: EpisodeListe)}
  <li>
    <button
      type="button"
      class:actif={estActif(livre, episode.episode)}
      aria-current={estActif(livre, episode.episode) ? 'true' : undefined}
      onclick={() => onEpisodeClick(livre, episode)}
    >
      <span class="numero">{episode.episode}</span>
      <span class="titre">{episode.title}</span>
      <time datetime={`PT${Math.round(episode.start_seconds)}S`}>
        {formaterTemps(episode.start_seconds)}
      </time>
    </button>
  </li>
{/snippet}

<ol class="episodes">
  {#each episodesDuLivre as episode (episode.episode)}
    {@render ligne(livreActif, episode)}
  {/each}
</ol>

<style>
  /*
   * Conventions du design system (issue #51, docs/SPECS.md section 8) :
   * mono à chiffres tabulaires pour les nombres, état actif signalé par
   * --accent-voile / --accent-fort.
   */

  .episodes {
    list-style: none;
    padding: 0;
  }

  .episodes li button {
    display: grid;
    grid-template-columns: 1.5rem 1fr auto;
    gap: var(--esp-3);
    align-items: baseline;
    width: 100%;
    padding: var(--esp-1) var(--esp-2);
    border: none;
    border-left: 2px solid transparent;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .episodes li button:hover {
    background: var(--surface);
  }

  .episodes li button.actif {
    background: var(--accent-voile);
    border-left-color: var(--accent);
  }

  .episodes li button.actif .titre {
    color: var(--accent-fort);
    font-weight: 600;
  }

  .numero,
  time {
    font-family: var(--police-mono);
    font-variant-numeric: tabular-nums;
    color: var(--encre-pale);
    font-size: 0.82rem;
  }

  .numero {
    text-align: center;
  }

</style>
