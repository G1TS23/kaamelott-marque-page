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
   * `Sommaire.svelte`, qui sait déjà afficher des résultats ou un message
   * « aucun résultat » ; pas de logique dupliquée ici.
   */
  import type {
    EpisodeAvecLivre,
    EpisodeListe,
    LivreEnListe,
    NumeroLivre,
  } from '../lib/episodes.ts';
  import Sommaire from './Sommaire.svelte';

  let {
    livres,
    livreActif,
    requete,
    resultats,
    episodeActif,
    onRequeteChange,
    onEpisodeClick,
    onFermer,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    requete: string;
    resultats: EpisodeAvecLivre[] | null;
    episodeActif: { livre: NumeroLivre; episode: number } | null;
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

  $effect(() => {
    champ?.focus();
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
    <input
      bind:this={champ}
      type="search"
      value={requete}
      oninput={(e) => onRequeteChange(e.currentTarget.value)}
      placeholder="filtrer par titre…"
      autocomplete="off"
    />
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
      <Sommaire
        {livres}
        {livreActif}
        {requete}
        {resultats}
        {episodeActif}
        onEpisodeClick={clicEpisode}
      />
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

  .ecran-entete input {
    flex: 1;
    min-width: 0;
    padding: 0.4em var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    background: var(--surface-haute);
    color: var(--encre);
    font: inherit;
  }

  .ecran-entete input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .ecran-entete input::placeholder {
    color: var(--encre-pale);
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

  .recentes button:hover {
    background: var(--surface);
  }

  .recentes svg {
    flex-shrink: 0;
    color: var(--encre-pale);
  }
</style>
