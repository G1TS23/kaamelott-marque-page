<script lang="ts">
  /**
   * Liste des épisodes : sommaire du livre actif par défaut, résultats de
   * recherche dès qu'une requête est tapée (issues #13, #15).
   *
   * Anciennement `SelecteurLivre.svelte` — renommé quand les onglets en ont
   * été extraits (`Onglets.svelte`, issue #54) : ce composant ne montre
   * plus que la liste elle-même.
   *
   * Purement présentationnel : `livreActif`, la requête et l'épisode en
   * cours sont décidés par `Site.svelte`, qui possède aussi le lecteur.
   */
  import type {
    EpisodeAvecLivre,
    EpisodeListe,
    LivreEnListe,
    NumeroLivre,
  } from '../lib/episodes.ts';
  import { formaterTemps } from '../lib/temps.ts';

  let {
    livres,
    livreActif,
    requete,
    resultats,
    episodeActif,
    onEpisodeClick,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    requete: string;
    /** `null` = pas de recherche → sommaire ; `[]` = recherche sans résultat. */
    resultats: EpisodeAvecLivre[] | null;
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

{#snippet ligne(livre: NumeroLivre, episode: EpisodeListe, avecLivre: boolean)}
  <li>
    <button
      type="button"
      class:actif={estActif(livre, episode.episode)}
      aria-current={estActif(livre, episode.episode) ? 'true' : undefined}
      onclick={() => onEpisodeClick(livre, episode)}
    >
      <span class="numero">{episode.episode}</span>
      <span class="titre">{episode.title}</span>
      {#if avecLivre}
        <span class="badge">Livre {livre}</span>
      {/if}
      <time datetime={`PT${Math.round(episode.start_seconds)}S`}>
        {formaterTemps(episode.start_seconds)}
      </time>
    </button>
  </li>
{/snippet}

{#if resultats === null}
  <ol class="episodes">
    {#each episodesDuLivre as episode (episode.episode)}
      {@render ligne(livreActif, episode, false)}
    {/each}
  </ol>
{:else if resultats.length === 0}
  <p class="vide">Aucun épisode ne correspond à «&nbsp;{requete.trim()}&nbsp;».</p>
{:else}
  <ol class="episodes" aria-label="Résultats de recherche">
    {#each resultats as r (`${r.livre}-${r.episode}`)}
      {@render ligne(r.livre, r, true)}
    {/each}
  </ol>
{/if}

<style>
  /*
   * Conventions du design system (issue #51, docs/SPECS.md section 8) :
   * mono à chiffres tabulaires pour les nombres, état actif signalé par
   * --accent-voile / --accent-fort.
   */

  .episodes {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .episodes li {
    border-bottom: 1px solid var(--trait);
  }

  .episodes li button {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto auto;
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
    text-align: right;
  }

  .badge {
    font-family: var(--police-mono);
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-pale);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-etiquette);
    padding: 0 var(--esp-1);
    align-self: center;
  }

  .vide {
    color: var(--encre-douce);
    padding: var(--esp-2);
  }
</style>
