<script>
  /**
   * Onglets de livre + liste des épisodes du livre actif (issue #13).
   *
   * Îlot minimal du squelette : il prouve que l'hydratation Svelte fonctionne
   * et pose la navigation par livre des specs (section 8). Le filtrage par
   * titre (#15), la recherche (#16/#17) et le lecteur (#14) viendront s'y
   * brancher — la bascule automatique d'onglet sur un résultat cross-livre
   * (#18) réutilisera `livreActif`.
   */
  let { livres } = $props();

  let livreActif = $state(livres[0].livre);

  const episodesAffiches = $derived(
    livres.find((l) => l.livre === livreActif).episodes,
  );

  function formaterTemps(secondes) {
    const h = Math.floor(secondes / 3600);
    const m = Math.floor((secondes % 3600) / 60);
    const s = Math.floor(secondes % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
</script>

<nav class="onglets" aria-label="Choix du livre">
  {#each livres as livre (livre.livre)}
    <button
      type="button"
      class:actif={livre.livre === livreActif}
      aria-current={livre.livre === livreActif ? 'true' : undefined}
      onclick={() => (livreActif = livre.livre)}
    >
      Livre {livre.livre}
      <span class="compte">{livre.episodes.length}</span>
    </button>
  {/each}
</nav>

<ol class="episodes">
  {#each episodesAffiches as episode (episode.episode)}
    <li>
      <span class="numero">{episode.episode}</span>
      <span class="titre">{episode.title}</span>
      <time datetime={`PT${Math.round(episode.start_seconds)}S`}>
        {formaterTemps(episode.start_seconds)}
      </time>
    </li>
  {/each}
</ol>

<style>
  .onglets {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .onglets button {
    font: inherit;
    padding: 0.5rem 1rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .onglets button.actif {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  .compte {
    color: var(--attenue);
    font-size: 0.85em;
    margin-left: 0.25rem;
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
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--bordure);
  }

  .numero {
    color: var(--attenue);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  time {
    color: var(--attenue);
    font-variant-numeric: tabular-nums;
    font-size: 0.9em;
  }
</style>
