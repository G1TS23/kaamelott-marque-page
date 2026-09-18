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
   *
   * Ligne dépliable (issue #55) : chevron dédié, séparé du bouton de
   * lecture — cliquer le reste de la ligne doit garder son comportement
   * actuel (lecture immédiate, docs/SPECS.md section 6), pas être détourné
   * par le dépliage. Un seul id déplié à la fois (`ligneDepliee`), pas un
   * `Set` : accordéon classique, la liste reste courte. `donneesRecherche`
   * (résumé/personnages/générique) est la même donnée que la recherche
   * (#16), déjà chargée une fois au montage par `Site.svelte` — pas de
   * fetch séparé pour ce panneau.
   */
  import {
    estIntro,
    type DonneesRecherche,
    type EpisodeListe,
    type LivreEnListe,
    type NumeroLivre,
  } from '../lib/episodes.ts';
  import { formaterTemps } from '../lib/temps.ts';

  let {
    livres,
    livreActif,
    episodeActif,
    onEpisodeClick,
    donneesRecherche,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    episodeActif: { livre: NumeroLivre; episode: number } | null;
    onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
    donneesRecherche: DonneesRecherche[] | null;
  } = $props();

  const episodesDuLivre = $derived(
    livres.find((l) => l.livre === livreActif)?.episodes ?? [],
  );

  function estActif(livre: NumeroLivre, episode: number): boolean {
    return episodeActif?.livre === livre && episodeActif.episode === episode;
  }

  let ligneDepliee = $state<string | null>(null);

  function basculerDetails(id: string) {
    ligneDepliee = ligneDepliee === id ? null : id;
  }

  // Recolle par id (même mécanisme que `joindreDonneesRecherche`,
  // recherche.ts, mais un simple lookup suffit ici — pas besoin de fusionner
  // avec `EpisodeListe`). `null` tant que `/recherche.json` n'a pas résolu
  // (Site.svelte) : le panneau affiche un état de chargement le temps venu.
  const donneesParId = $derived(new Map((donneesRecherche ?? []).map((d) => [d.id, d] as const)));
</script>

{#snippet ligne(livre: NumeroLivre, episode: EpisodeListe)}
  <li>
    <div class="ligne">
      <button
        type="button"
        class="jouer"
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
      {#if !estIntro(episode)}
        <button
          type="button"
          class="chevron"
          class:ouvert={ligneDepliee === episode.id}
          aria-expanded={ligneDepliee === episode.id}
          aria-controls={`details-${episode.id}`}
          aria-label={ligneDepliee === episode.id
            ? 'Masquer les détails'
            : "Afficher les détails de l'épisode"}
          onclick={() => basculerDetails(episode.id)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 10l5 5 5-5z" fill="currentColor" />
          </svg>
        </button>
      {:else}
        <!-- Réserve la largeur du chevron (retour d'usage) : sans elle, la
             durée de l'intro (seule ligne sans chevron, #71) se retrouve
             plus à droite que celle des autres épisodes. -->
        <span class="chevron-espace" aria-hidden="true"></span>
      {/if}
    </div>
    {#if ligneDepliee === episode.id}
      {@const details = donneesParId.get(episode.id)}
      <div
        id={`details-${episode.id}`}
        class="details"
        role="region"
        aria-label={`Détails de ${episode.title}`}
      >
        {#if details}
          <p class="resume">{details.summary}</p>
          {#if details.characters.length > 0}
            <p class="generique">
              <span class="etiquette">Personnages</span>
              {details.characters.join(', ')}
              <span class="non-exhaustif">(liste non exhaustive)</span>
            </p>
          {/if}
          <p class="generique"><span class="etiquette">Réalisation</span>{details.director}</p>
          <p class="generique"><span class="etiquette">Scénario</span>{details.writer}</p>
          <p class="generique"><span class="etiquette">Diffusion</span>{details.channel}</p>
          {#if details.guests.length > 0}
            <p class="generique">
              <span class="etiquette">Invités</span>{details.guests.join(', ')}
            </p>
          {/if}
        {:else}
          <p class="chargement">Chargement…</p>
        {/if}
      </div>
    {/if}
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

  /* Conteneur du bouton de lecture + chevron (issue #55) — deux boutons
     frères, pas un bouton imbriqué dans un autre (invalide en HTML). */
  .ligne {
    display: flex;
    align-items: center;
  }

  .episodes li .jouer {
    display: grid;
    grid-template-columns: 1.5rem 1fr auto;
    gap: var(--esp-3);
    align-items: baseline;
    flex: 1;
    min-width: 0;
    padding: var(--esp-1) var(--esp-2);
    border: none;
    border-left: 2px solid transparent;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* `(hover: hover)` plutôt qu'un `:hover` nu (retour d'usage) : sur un
     écran tactile la pseudo-classe reste collée après un tap. */
  @media (hover: hover) {
    .episodes li .jouer:hover {
      background: var(--surface);
    }
  }

  .episodes li .jouer.actif {
    background: var(--accent-voile);
    border-left-color: var(--accent);
  }

  .episodes li .jouer.actif .titre {
    color: var(--accent-fort);
    font-weight: 600;
  }

  /* Chevron dédié (issue #55) : zone de clic séparée du bouton de lecture,
     pour ne jamais interférer avec le geste principal (lecture immédiate,
     docs/SPECS.md section 6). Cercle parfait, même gabarit que les boutons
     ronds du lecteur (`.transport button`, Site.svelte) — `.ligne` centre
     désormais verticalement plutôt que d'étirer ses enfants à la hauteur
     de `.jouer` (variable selon que le titre tient sur une ou deux
     lignes), sans quoi ce bouton prenait une forme rectangulaire et la
     rotation de l'icône avait l'air décentrée. */
  /* `.chevron-espace` (ligne de l'intro, sans chevron réel — #71) partage
     juste le gabarit, pas le reste du style d'un bouton : un simple
     espaceur décoratif, jamais focusable. */
  .chevron,
  .chevron-espace {
    flex: none;
    width: 2rem;
  }

  .chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--encre-pale);
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .chevron.ouvert {
    transform: rotate(180deg);
  }

  @media (hover: hover) {
    .chevron:hover {
      background: var(--surface);
      color: var(--encre);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }

  /* Panneau déplié (issue #55) : `--surface`/`--rayon-encart` du design
     system (#51), même famille visuelle que les autres encarts du site. */
  .details {
    margin: 0 var(--esp-2) var(--esp-2);
    padding: var(--esp-3);
    background: var(--surface);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-encart);
    font-size: 0.85rem;
    color: var(--encre-douce);
  }

  .details .resume {
    margin: 0 0 var(--esp-2);
  }

  .details .generique {
    margin: 0.3em 0;
  }

  .details .etiquette {
    font-family: var(--police-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-pale);
    margin-right: 0.6em;
  }

  .details .non-exhaustif {
    color: var(--encre-pale);
    font-size: 0.78rem;
    margin-left: 0.4em;
  }

  .details .chargement {
    margin: 0;
    color: var(--encre-pale);
    font-family: var(--police-mono);
    font-size: 0.8rem;
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
