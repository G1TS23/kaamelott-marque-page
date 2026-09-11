<script lang="ts">
  /**
   * Onglets de livre + zone de liste : sommaire du livre actif par défaut,
   * résultats de recherche dès qu'une requête est tapée (issues #13, #15).
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
    onLivreChange,
    onEpisodeClick,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    requete: string;
    /** `null` = pas de recherche → sommaire ; `[]` = recherche sans résultat. */
    resultats: EpisodeAvecLivre[] | null;
    episodeActif: { livre: NumeroLivre; episode: number } | null;
    onLivreChange: (livre: NumeroLivre) => void;
    onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
  } = $props();

  const episodesDuLivre = $derived(
    livres.find((l) => l.livre === livreActif)?.episodes ?? [],
  );

  function estActif(livre: NumeroLivre, episode: number): boolean {
    return episodeActif?.livre === livre && episodeActif.episode === episode;
  }
</script>

<nav class="onglets" aria-label="Choix du livre">
  {#each livres as livre (livre.livre)}
    <button
      type="button"
      class:actif={livre.livre === livreActif}
      aria-current={livre.livre === livreActif ? 'true' : undefined}
      onclick={() => onLivreChange(livre.livre)}
    >
      <span
        class="pastille"
        class:pastille-active={episodeActif?.livre === livre.livre}
        aria-hidden="true"
      ></span>
      {#if episodeActif?.livre === livre.livre}
        <span class="sr-only">En cours de lecture.</span>
      {/if}
      Livre {livre.livre}
    </button>
  {/each}
</nav>

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
   * pilules pour les onglets, mono à chiffres tabulaires pour les nombres,
   * état actif signalé par --accent-voile / --accent-fort.
   */

  .onglets {
    display: flex;
    gap: var(--esp-2);
    flex-wrap: wrap;
    margin-bottom: var(--esp-4);
  }

  .onglets button {
    display: inline-flex;
    align-items: center;
    position: relative;
    font-family: var(--police-mono);
    font-size: 0.82rem;
    /* --esp-4 (20px) plutôt que --esp-3 (14px) : la pastille se loge dans
       ce padding (voir .pastille) au lieu d'agrandir l'onglet — à 14px elle
       n'avait que 4.5px de marge de chaque côté, trop serré. Horizontal
       seul : la hauteur est explicite ci-dessous, pas déduite d'un padding
       vertical + line-height hérité. */
    padding: 0 var(--esp-4);
    height: 22.4px;
    line-height: 1;
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

  /* Le livre en cours de lecture peut différer du livre affiché (on
     parcourt un autre sommaire pendant qu'un épisode joue, issue #18) :
     une pastille « en direct » lève l'ambiguïté sans dépendre de la couleur
     de l'onglet — rouge et pulsante quel que soit l'état de l'onglet
     (affiché ou non), comme les indicateurs de direct habituels.
     Toujours rendue (juste transparente si inactive), pas seulement quand
     un livre joue : sinon la largeur de l'onglet changerait selon qu'un
     livre est en cours de lecture ou non.

     Positionnée en absolu et centrée dans le padding gauche du bouton,
     plutôt qu'un élément du flex qui pousse le texte (retour d'usage après
     une première version en `gap` : un point dans le flux ne peut pas
     garantir à la fois une largeur d'onglet fixe, un padding symétrique
     autour du texte et un espacement égal des deux côtés du point — la
     position absolue garantit les trois par construction, pas par réglage
     de valeurs qu'un futur changement pourrait recasser). Le -1px dans le
     calc soustrait la bordure du bouton : le bloc de positionnement d'un
     absolu est le bord du *padding* de l'ancêtre, pas son bord visible —
     sans le soustraire, le point atterrit 1px trop loin du bord visible par
     rapport au texte. Mesuré : 6.5px de marge des deux côtés du point. */
  .pastille {
    position: absolute;
    left: calc((var(--esp-4) - 8px - 1px) / 2);
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
  }

  .pastille-active {
    background: var(--alerte);
  }

  .pastille-active::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--alerte);
    /* Échelle 2.4 (pas 2.8) sur retour d'usage : l'anneau ne vise plus le
       bord arrondi de l'onglet, juste à rester visible sans être imposant. */
    animation: pastille-irradie 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes pastille-irradie {
    from {
      transform: scale(1);
      opacity: 0.7;
    }
    to {
      transform: scale(2.4);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pastille-active::before {
      animation: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
