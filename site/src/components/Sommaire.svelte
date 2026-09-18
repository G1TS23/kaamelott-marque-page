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
   *
   * Le panneau `.details` est toujours dans le DOM pour chaque épisode
   * (masqué par `hidden`), pas seulement quand déplié (revue a11y) : le
   * `aria-controls` du chevron doit résoudre vers un élément réel, sans
   * quoi la référence est silencieusement ignorée par les lecteurs
   * d'écran. `aria-live="polite"` sur ce même panneau annonce le passage
   * de « Chargement… » au contenu réel si `donneesRecherche` n'a pas
   * encore résolu au moment du dépliage (rare — déjà chargé la plupart du
   * temps) — même pattern que `.chargement` dans `Lecteur.svelte`.
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
  <li class:deplie={ligneDepliee === episode.id}>
    <div class="ligne" class:actif={estActif(livre, episode.episode)}>
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
            ? `Masquer les détails de ${episode.title}`
            : `Afficher les détails de ${episode.title}`}
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
    {#if !estIntro(episode)}
      {@const details = donneesParId.get(episode.id)}
      <div
        id={`details-${episode.id}`}
        class="details"
        role="region"
        aria-label={`Détails de ${episode.title}`}
        aria-live="polite"
        hidden={ligneDepliee !== episode.id}
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

  /* Bloc plat unique une fois déplié (issue #55, retour d'usage sur le
     premier essai — un encart séparé et bordé sous la ligne ne se lisait
     pas comme lui appartenant) : la ligne et son panneau partagent le même
     fond, un seul rayon plutôt que chacun le sien. Coin haut-gauche carré
     (retour d'usage) : c'est celui de la bordure d'accent de `.jouer.actif`
     (voir plus bas), qui doit rester une ligne verticale nette contre le
     bord gauche de la liste plutôt qu'amorcer une courbe — même logique
     que le surlignage (`.ligne.actif`), déjà carré à gauche pour la même
     raison. Coin haut-droit calé sur le rayon du chevron (1rem, la moitié
     de ses 2rem de diamètre — voir `.ligne.actif` plus bas, déjà sur cette
     valeur) plutôt que `--rayon-encart` : c'est ce coin-là qui touche le
     chevron, il doit épouser son contour plutôt qu'un rayon sans rapport
     avec lui. Bas-droit/bas-gauche restent sur `--rayon-encart` du design
     system, aucun bouton ne les touche. `overflow: hidden` découpe
     proprement les enfants (ligne active/survolée, voir plus bas) dans ce
     contour — sans lui leurs propres coins carrés dépasseraient de la
     forme du bloc. `margin-bottom` compense l'absence de marge propre au
     panneau (supprimée, elle appartenait à l'ancien encart flottant) :
     garde un peu d'air avant la ligne suivante. */
  .episodes li.deplie {
    background: var(--surface);
    border-radius: 0 1rem var(--rayon-encart) var(--rayon-encart);
    overflow: hidden;
    margin-bottom: var(--esp-2);
  }

  /* Conteneur du bouton de lecture + chevron (issue #55) — deux boutons
     frères, pas un bouton imbriqué dans un autre (invalide en HTML). */
  .ligne {
    display: flex;
    align-items: center;
  }

  /* Surlignage et survol portés par `.ligne` plutôt que par `.jouer` seul
     (retour d'usage) : sans ça, ils s'arrêtaient net à la frontière avec
     le chevron, laissant sa zone hors du surlignage/survol — `:hover`
     remonte naturellement à `.ligne` depuis n'importe lequel de ses
     enfants, chevron compris, aucun JS nécessaire. Rayon calé sur celui du
     chevron (2rem de diamètre, donc 1rem de rayon) plutôt qu'un rayon du
     design system : le bord droit doit épouser son contour, pas suivre
     une valeur sans rapport avec lui. */
  .ligne.actif {
    background: var(--accent-voile);
    border-radius: 0 1rem 1rem 0;
  }

  /* `(hover: hover)` plutôt qu'un `:hover` nu (retour d'usage) : sur un
     écran tactile la pseudo-classe reste collée après un tap. */
  @media (hover: hover) {
    .ligne:hover {
      background: var(--surface);
      border-radius: 0 1rem 1rem 0;
    }

    /* Le survol ne doit pas maquiller l'état actif (retour d'usage) —
       même logique que `.jouer.actif` plus bas, au niveau de la ligne
       entière désormais. */
    .ligne.actif:hover {
      background: var(--accent-voile);
    }
  }

  /* Déplié (voir `li.deplie` plus haut) : le rayon droit de la ligne
     (pilule autour du chevron, hors dépliage) n'a plus lieu d'être — le
     bloc entier a déjà son propre rayon sur les quatre coins, une
     deuxième forme arrondie imbriquée dedans ferait double emploi. */
  .episodes li.deplie .ligne.actif {
    border-radius: 0;
  }

  @media (hover: hover) {
    .episodes li.deplie .ligne:hover {
      border-radius: 0;
    }
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

  .episodes li .jouer.actif {
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

  /* Cohérent avec le reste des contrôles custom du site (revue a11y) —
     même pattern que `.recherche input:focus-visible` (Site.svelte),
     `MiniTimeline`/`ResultatsRecherche` : sans lui, ce bouton s'appuyait
     sur l'anneau par défaut du navigateur plutôt que le style du design
     system. */
  .chevron:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* `--surface-haute` plutôt que `--surface` (retour d'usage, même
     raison que `.boutons-reduit button:hover` dans Site.svelte) : la ligne
     entière se survole désormais aussi en `--surface` (voir `.ligne:hover`
     plus haut) — un survol du chevron dans la même couleur ne s'y
     distinguerait pas du tout. */
  @media (hover: hover) {
    .chevron:hover {
      background: var(--surface-haute);
      color: var(--encre);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }

  /* Panneau déplié (issue #55) : ni fond, ni bordure, ni rayon propres —
     hérite du fond plat de `li.deplie` (plus haut), dont il n'est que le
     prolongement plutôt qu'un encart à part entière posé dessous. */
  .details {
    padding: var(--esp-1) var(--esp-3) var(--esp-3);
    font-size: 0.85rem;
    color: var(--encre-douce);
  }

  .details .resume {
    margin: 0 0 var(--esp-2);
  }

  .details .generique {
    margin: 0.3em 0;
  }

  /* `--encre-douce`, pas `--encre-pale` (revue a11y) : `--encre-pale` sur
     `--surface` ne donne que 3.1:1 en clair / 4.03:1 en sombre, sous le
     seuil AA de 4.5:1 pour du texte de cette taille (WCAG 1.4.3) —
     `--encre-douce` (6.55:1 / 7.67:1) passe large, pour un rôle de texte
     secondaire tout aussi adapté. */
  .details .etiquette {
    font-family: var(--police-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-douce);
    margin-right: 0.6em;
  }

  .details .non-exhaustif {
    color: var(--encre-douce);
    font-size: 0.78rem;
    margin-left: 0.4em;
  }

  .details .chargement {
    margin: 0;
    color: var(--encre-douce);
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
