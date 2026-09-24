<script lang="ts">
  /**
   * Écran de recherche plein écran, mobile uniquement (retour d'usage sur
   * #54) : la recherche en ligne dans l'en-tête débordait sur un petit
   * écran (pas la place pour le nom du site *et* un champ utilisable).
   * Ouvert par une simple loupe (bouton dans `Site.svelte`, visible sous
   * 640px), fermé par le bouton retour ou <kbd>Échap</kbd>.
   *
   * Requête vide → recherches récentes (`localStorage`, tolérant : une
   * recherche qui ne persiste pas d'une visite à l'autre — navigation
   * privée, quota — ne doit pas empêcher de chercher). Requête non vide →
   * `ResultatsRecherche.svelte` (issue #16), en pleine largeur — pas de
   * logique de rendu dupliquée ici, le même composant sert le panneau
   * flottant desktop dans `Site.svelte`.
   */
  import type { EpisodeListe, NumeroLivre } from '../lib/episodes.ts';
  import type { ResultatRecherche } from '../lib/recherche.ts';
  import ResultatsRecherche from './ResultatsRecherche.svelte';

  let {
    requete,
    resultats,
    onRequeteChange,
    onEpisodeClick,
    onFermer,
  }: {
    requete: string;
    resultats: ResultatRecherche[];
    onRequeteChange: (v: string) => void;
    onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
    onFermer: () => void;
  } = $props();

  const CLE_STOCKAGE = 'marque-page:recherches-recentes';
  const MAX_RECENTES = 8;

  let recentes = $state<string[]>(lireRecentes());
  let champ: HTMLInputElement;

  function lireRecentes(): string[] {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      const valeur = brut ? JSON.parse(brut) : [];
      return Array.isArray(valeur) ? valeur : [];
    } catch {
      return [];
    }
  }

  function enregistrerRecente(q: string) {
    const propre = q.trim();
    if (!propre) return;
    const sansDoublon = recentes.filter((r) => r.toLowerCase() !== propre.toLowerCase());
    recentes = [propre, ...sansDoublon].slice(0, MAX_RECENTES);
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(recentes));
    } catch {
      // Pas grave si ça ne persiste pas d'une visite à l'autre.
    }
  }

  function fermer() {
    enregistrerRecente(requete);
    onFermer();
  }

  function choisirRecente(q: string) {
    onRequeteChange(q);
    champ?.focus();
  }

  function clicEpisode(livre: NumeroLivre, episode: EpisodeListe) {
    enregistrerRecente(requete);
    onEpisodeClick(livre, episode);
    onFermer();
  }

  function surTouche(e: KeyboardEvent) {
    if (e.key === 'Escape') fermer();
  }

  // Referme le clavier virtuel sur Entrée (retour d'usage : sans ça, sur
  // mobile, la touche Entrée du clavier n'avait aucune action définie — pas
  // de <form> à soumettre — et certains claviers l'affichent alors comme un
  // retour à la ligne plutôt qu'une action de recherche). Les résultats sont
  // déjà à jour à chaque frappe (`oninput`) : Entrée n'a qu'à dégager le
  // clavier pour les montrer.
  function surEntree(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      champ?.blur();
    }
  }

  $effect(() => {
    champ?.focus();
  });

  // Verrouille le défilement de la page derrière l'écran (retour d'usage :
  // deux scrollbars visibles à la fois, celle des résultats et celle de la
  // page en dessous). `position: fixed; inset: 0` sur `.ecran` ne suffit
  // pas à lui seul à empêcher ça sur mobile — restauré à la fermeture.
  $effect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  });
</script>

<svelte:window onkeydown={surTouche} />

<div class="ecran" role="dialog" aria-modal="true" aria-label="Recherche">
  <div class="ecran-entete">
    <button type="button" class="retour" onclick={fermer} aria-label="Fermer la recherche">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z"
          fill="currentColor"
        />
      </svg>
    </button>
    <div class="champ-recherche">
      <label for="recherche-titre-mobile" class="sr-only">
        Rechercher un épisode par titre, résumé ou personnage
      </label>
      <input
        bind:this={champ}
        id="recherche-titre-mobile"
        type="search"
        value={requete}
        oninput={(e) => onRequeteChange(e.currentTarget.value)}
        onkeydown={surEntree}
        placeholder="titre, résumé, personnage…"
        autocomplete="off"
        enterkeyhint="search"
      />
      {#if requete}
        <button
          type="button"
          class="effacer"
          onclick={() => {
            onRequeteChange('');
            champ?.focus();
          }}
          aria-label="Effacer la recherche"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="ecran-corps">
    {#if !requete.trim()}
      {#if recentes.length > 0}
        <p class="recentes-titre">Recherches récentes</p>
        <ul class="recentes">
          {#each recentes as q (q)}
            <li>
              <button type="button" onclick={() => choisirRecente(q)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3z"
                    fill="currentColor"
                  />
                </svg>
                {q}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <ResultatsRecherche {resultats} onEpisodeClick={clicEpisode} />
    {/if}
  </div>
</div>

<style>
  .ecran {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: var(--fond);
  }

  .ecran-entete {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--esp-2);
    height: 3rem;
    padding: 0 var(--esp-3);
    /* Même traitement que l'en-tête principal (Site.svelte, retour
       d'usage) : même fond que la page, pas de bordure — seul le champ de
       recherche se détache visuellement. */
    background: var(--fond);
  }

  .retour {
    flex-shrink: 0;
    display: flex;
    padding: var(--esp-1);
    border: none;
    background: transparent;
    color: var(--encre);
    cursor: pointer;
  }

  /* Enveloppe le champ pour ancrer le bouton d'effacement (retour d'usage :
     la croix native de type="search" est incohérente d'un navigateur à
     l'autre — absente sur certains mobiles alors que Chrome l'affiche). */
  .champ-recherche {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .ecran-entete input {
    width: 100%;
    /* Marge à droite pour laisser la place au bouton d'effacement. */
    padding: 0.4em 2.75rem 0.4em var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    background: var(--surface-haute);
    color: var(--encre);
    font: inherit;
  }

  /* La croix native fait doublon avec le bouton ci-dessous, sur les
     navigateurs qui en affichent une (Chrome). */
  .ecran-entete input[type='search']::-webkit-search-cancel-button,
  .ecran-entete input[type='search']::-webkit-search-decoration {
    appearance: none;
  }

  /* Pas de halo de focus ici (retour d'usage) : l'écran se concentre déjà
     ce champ au clic sur la loupe (voir le script) — le halo apparaîtrait
     donc systématiquement à l'ouverture, sur un contexte tactile où il
     n'a pas la même utilité qu'au clavier. */
  .ecran-entete input:focus-visible {
    outline: none;
  }

  .ecran-entete input::placeholder {
    color: var(--encre-pale);
  }

  /* Zone de tap franchement plus grande que l'icône elle-même (retour
     d'usage : au doigt, un tap un peu à côté tombait sur le champ, qui
     sélectionnait son contenu au lieu d'être effacé) et détachée du bord
     du champ plutôt que collée dessus. */
  .effacer {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    /* Même couleur que le texte tapé (retour d'usage) — pas la teinte pâle
       des étiquettes, la croix doit se voir aussi nettement que ce qu'elle
       efface. */
    color: var(--encre);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* `:active` plutôt que `:hover` (retour d'usage sur le survol collant au
     toucher, voir plus haut) : ne dure que le temps du contact, confirme le
     tap sans jamais rester affiché après. */
  .effacer:active {
    background: var(--surface);
  }

  .ecran-corps {
    flex: 1;
    overflow-y: auto;
    padding: var(--esp-3) var(--esp-4);
  }

  .recentes-titre {
    margin: 0 0 var(--esp-2);
    font-family: var(--police-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--encre-pale);
  }

  .recentes {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recentes button {
    display: flex;
    align-items: center;
    gap: var(--esp-2);
    width: 100%;
    padding: var(--esp-2);
    border: none;
    background: transparent;
    color: var(--encre-douce);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* `(hover: hover)` plutôt qu'un `:hover` nu (retour d'usage) : sur un
     écran tactile la pseudo-classe reste collée après un tap. */
  @media (hover: hover) {
    .recentes button:hover {
      background: var(--surface);
    }
  }

  .recentes svg {
    flex-shrink: 0;
    color: var(--encre-pale);
  }

  /* Label du champ (issue 114, audit de stabilisation) : visuellement
     masqué, comme le champ desktop équivalent (Site.svelte) — jusqu'ici
     ce champ ne dépendait que du `aria-label` du `role="dialog"`
     englobant, un nom accessible plus faible/indirect que la version
     desktop, qui a les deux. */
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
</style>
