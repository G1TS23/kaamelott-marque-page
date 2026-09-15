<script lang="ts">
  /**
   * Liste des résultats de la recherche unifiée (titre + résumé +
   * personnage, issue #16) — pur exécutant, sans logique de positionnement :
   * `Site.svelte` lui donne son chrome de panneau flottant (desktop),
   * `RechercheMobile.svelte` l'affiche en pleine largeur (mobile).
   *
   * Pattern validé sur une maquette avant construction — une seule liste
   * dédupliquée triée par pertinence, avec juste une indication de ce qui a
   * matché à côté du titre, pas de panneau groupé par catégorie ni de
   * détail sous le titre (retours d'usage successifs) :
   * https://claude.ai/code/artifact/2f432b47-3b4e-4b45-8600-41cafe85a4e4
   */
  import type { EpisodeListe, NumeroLivre } from '../lib/episodes.ts';
  import type { ResultatRecherche, TypeCorrespondance } from '../lib/recherche.ts';

  let {
    resultats,
    livreActif,
    onEpisodeClick,
  }: {
    resultats: ResultatRecherche[];
    /** Pour l'étiquette « Livre N » sur un résultat d'un autre livre (portée globale, docs/SPECS.md section 5). */
    livreActif: NumeroLivre;
    onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
  } = $props();

  const LIBELLES: Record<TypeCorrespondance, string> = {
    titre: 'titre',
    personnage: 'personnage',
    résumé: 'résumé',
  };
</script>

{#if resultats.length === 0}
  <p class="vide">Aucun épisode ne correspond.</p>
{:else}
  <ul class="liste" aria-label="Résultats de recherche">
    {#each resultats as r (r.episode.id)}
      <li>
        <button type="button" onclick={() => onEpisodeClick(r.episode.livre, r.episode)}>
          <span class="ligne-titre">
            <span class="numero">{r.episode.episode}</span>
            <span class="titre">{r.episode.title}</span>
            {#if r.episode.livre !== livreActif}
              <span class="badge">Livre {r.episode.livre}</span>
            {/if}
          </span>
          <span class="correspond">{r.correspond.map((t) => LIBELLES[t]).join(' · ')}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /*
   * Conventions du design system (issue #51, docs/SPECS.md section 8) :
   * mono à chiffres tabulaires pour les numéros et les étiquettes.
   * Pas de filet entre les lignes (retour d'usage sur la maquette) :
   * l'espacement seul sépare les résultats.
   */

  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .liste li button {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px var(--esp-2);
    width: 100%;
    padding: var(--esp-1) 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ligne-titre {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px var(--esp-2);
  }

  /* Sous 640px (retour d'usage) : le détail de ce qui a matché passe sous
     le titre plutôt que de se disputer la ligne avec lui — même seuil que
     le reste du site (Site.svelte, Onglets.svelte). */
  @media (max-width: 640px) {
    .liste li button {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .correspond {
      margin-left: 0;
    }
  }

  .liste li button:hover .titre,
  .liste li button:focus-visible .titre {
    color: var(--accent-fort);
  }

  .liste li button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    border-radius: 4px;
  }

  .numero {
    flex: none;
    font-family: var(--police-mono);
    font-variant-numeric: tabular-nums;
    color: var(--encre-pale);
    font-size: 0.78rem;
  }

  .titre {
    font-weight: 600;
  }

  .badge {
    flex: none;
    font-family: var(--police-mono);
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-pale);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-etiquette);
    padding: 0 var(--esp-1);
  }

  .correspond {
    margin-left: auto;
    font-family: var(--police-mono);
    font-size: 0.72rem;
    color: var(--encre-pale);
  }

  .vide {
    color: var(--encre-douce);
    padding: var(--esp-2) 0;
  }
</style>
