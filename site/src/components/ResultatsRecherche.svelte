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
    onEpisodeClick,
  }: {
    resultats: ResultatRecherche[];
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
          <span class="numero">{r.episode.episode}</span>
          <span class="corps">
            <span class="ligne-titre">
              <span class="titre">{r.episode.title}</span>
              <span class="badge">Livre {r.episode.livre}</span>
            </span>
            <span class="correspond">{r.correspond.map((t) => LIBELLES[t]).join(' · ')}</span>
          </span>
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
    gap: var(--esp-2);
    width: 100%;
    padding: var(--esp-1) 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Tout ce qui n'est pas le numéro : titre+badge et l'indication de match
     s'alignent ensemble à sa droite, pas au bord du bouton — sur une seule
     ligne desktop, l'une sous l'autre en mobile (juste en-dessous). */
  .corps {
    display: flex;
    align-items: baseline;
    flex: 1;
    flex-wrap: wrap;
    gap: 2px var(--esp-2);
    min-width: 0;
  }

  .ligne-titre {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px var(--esp-2);
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

  /* Sous 640px (retour d'usage) : le détail de ce qui a matché passe sous
     le titre plutôt que de se disputer la ligne avec lui, aligné avec lui
     (pas avec le numéro) — même seuil que le reste du site (Site.svelte,
     Onglets.svelte). Placé après les règles qu'elle corrige : une media
     query ne gagne pas en spécificité sur un sélecteur de même poids,
     seul l'ordre dans la feuille de style tranche. */
  @media (max-width: 640px) {
    .corps {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .correspond {
      margin-left: 0;
    }

    /* Interligne resserré (retour d'usage) : chaque résultat tient sur deux
       lignes en mobile, le padding vertical par résultat (--esp-1, 4px en
       haut et en bas) se sentait redondant avec l'espacement déjà posé
       entre les deux lignes internes (2px, voir `.corps` ci-dessus). */
    .liste li button {
      padding: 2px 0;
    }
  }

  .vide {
    color: var(--encre-douce);
    padding: var(--esp-2) 0;
  }
</style>
