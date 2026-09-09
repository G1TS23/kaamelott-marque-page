<script lang="ts">
  /**
   * Onglets de livre + liste des épisodes du livre actif (issue #13).
   *
   * Îlot minimal du squelette : il prouve que l'hydratation Svelte fonctionne
   * et pose la navigation par livre des specs (section 8). Le filtrage par
   * titre (#15), la recherche (#16/#17) et le lecteur (#14) viendront s'y
   * brancher — la bascule automatique d'onglet sur un résultat cross-livre
   * (#18) réutilisera `livreActif`.
   */
  import type { LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
  import { formaterTemps } from '../lib/temps.ts';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);

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
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    gap: var(--esp-3);
    align-items: baseline;
    padding: var(--esp-1) var(--esp-2);
    border-bottom: 1px solid var(--trait);
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
