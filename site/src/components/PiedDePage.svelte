<script lang="ts">
  /**
   * Pied de page (issue #20) : crédit permanent à Shisheyu (déjà rappelé à
   * la première visite, popin #19 — ce lien-ci reste accessible en
   * permanence, contrairement à la popin qu'on ne revoit pas), plus les
   * deux sources du livre affiché (vidéo YouTube, page Wikipédia).
   *
   * Purement présentationnel : `livre` et `videoId` sont décidés par
   * `Site.svelte`, comme le reste des composants de navigation.
   */
  import type { NumeroLivre } from '../lib/episodes.ts';
  import { URL_CHAINE_SHISHEYU, URL_WIKIPEDIA_SAISON, urlVideoYouTube } from '../lib/liens.ts';

  let { livre, videoId }: { livre: NumeroLivre; videoId: string } = $props();
</script>

<footer class="pied-de-page">
  <a href={urlVideoYouTube(videoId)} target="_blank" rel="noopener noreferrer">
    Vidéo du Livre {livre} sur YouTube
  </a>
  <span class="separateur" aria-hidden="true">·</span>
  <a href={URL_WIKIPEDIA_SAISON[livre]} target="_blank" rel="noopener noreferrer">
    Livre {livre} sur Wikipédia
  </a>
  <span class="separateur" aria-hidden="true">·</span>
  <a href={URL_CHAINE_SHISHEYU} target="_blank" rel="noopener noreferrer">
    Chaîne YouTube de Shisheyu
  </a>
</footer>

<style>
  .pied-de-page {
    margin-top: var(--esp-6);
    padding-top: var(--esp-3);
    border-top: 1px solid var(--trait);
    display: flex;
    flex-wrap: wrap;
    gap: var(--esp-2);
    font-size: 0.85rem;
    color: var(--encre-pale);
  }

  .pied-de-page a {
    color: var(--profond);
  }

  .separateur {
    color: var(--trait);
  }
</style>
