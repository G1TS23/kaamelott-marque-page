<script lang="ts">
  /**
   * Onglets de livre + liste des épisodes du livre actif (issue #13).
   *
   * Purement présentationnel depuis l'issue #14 : `livreActif` et la
   * navigation elle-même (bascule d'onglet, clic sur un épisode) sont
   * décidées par `Site.svelte`, qui possède aussi le lecteur — un clic ici
   * doit pouvoir à la fois changer l'onglet actif *et* faire réagir le
   * lecteur, ce qu'un état interne à ce composant ne permettrait pas.
   */
  import type { EpisodeListe, LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
  import { formaterTemps } from '../lib/temps.ts';

  let {
    livres,
    livreActif,
    onLivreChange,
    onEpisodeClick,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    onLivreChange: (livre: NumeroLivre) => void;
    onEpisodeClick: (episode: EpisodeListe) => void;
  } = $props();

  const episodesAffiches = $derived(
    livres.find((l) => l.livre === livreActif)?.episodes ?? [],
  );
</script>

<nav class="onglets" aria-label="Choix du livre">
  {#each livres as livre (livre.livre)}
    <button
      type="button"
      class:actif={livre.livre === livreActif}
      aria-current={livre.livre === livreActif ? 'true' : undefined}
      onclick={() => onLivreChange(livre.livre)}
    >
      Livre {livre.livre}
      <span class="compte">{livre.episodes.length}</span>
    </button>
  {/each}
</nav>

<ol class="episodes">
  {#each episodesAffiches as episode (episode.episode)}
    <li>
      <button type="button" onclick={() => onEpisodeClick(episode)}>
        <span class="numero">{episode.episode}</span>
        <span class="titre">{episode.title}</span>
        <time datetime={`PT${Math.round(episode.start_seconds)}S`}>
          {formaterTemps(episode.start_seconds)}
        </time>
      </button>
    </li>
  {/each}
</ol>

<style>
  /*
   * Conventions du design system (issue #51, docs/SPECS.md section 8) :
   * pilules pour les onglets, mono à chiffres tabulaires pour tout ce qui est
   * un nombre, et l'état actif signalé par le couple --accent-voile /
   * --accent-fort plutôt que par une couleur inventée ici.
   *
   * L'en-tête définitif (onglets collés au lecteur, comme dans la note de
   * cadrage) viendra avec le lecteur lui-même (#14) ; en attendant les
   * onglets vivent seuls, d'où la pilule complète plutôt qu'un onglet à
   * angles bas droits qui ne serait accroché à rien.
   */

  .onglets {
    display: flex;
    gap: var(--esp-2);
    flex-wrap: wrap;
    margin-bottom: var(--esp-4);
  }

  .onglets button {
    font-family: var(--police-mono);
    font-size: 0.82rem;
    padding: var(--esp-1) var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    background: var(--surface);
    color: var(--encre-douce);
    cursor: pointer;
  }

  .onglets button:hover {
    border-color: var(--encre-pale);
  }

  .onglets button.actif {
    background: var(--accent-voile);
    border-color: var(--accent);
    color: var(--accent-fort);
    font-weight: 600;
  }

  .compte {
    color: var(--encre-pale);
    font-variant-numeric: tabular-nums;
    margin-left: var(--esp-1);
  }

  .onglets button.actif .compte {
    color: inherit;
  }

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
    grid-template-columns: 2.5rem 1fr auto;
    gap: var(--esp-3);
    align-items: baseline;
    width: 100%;
    padding: var(--esp-1) var(--esp-2);
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .episodes li button:hover {
    background: var(--surface);
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
</style>
