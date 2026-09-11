<script lang="ts">
  /**
   * Racine de l'îlot du site : possède l'état que le lecteur, les onglets,
   * le sommaire et la recherche doivent partager — `livreActif`, la requête
   * de recherche, et l'épisode en cours de lecture.
   *
   * Un clic (onglet, épisode, résultat) ne fait rien lui-même : il remonte
   * ici, et c'est ce niveau qui décide comment le lecteur réagit
   * (specs section 6) et ce que la liste affiche.
   */
  import {
    aplatir,
    type EpisodeListe,
    type LivreEnListe,
    type NumeroLivre,
  } from '../lib/episodes.ts';
  import { chercherParTitre, creerIndexTitres } from '../lib/recherche.ts';
  import Lecteur from './Lecteur.svelte';
  import SelecteurLivre from './SelecteurLivre.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let requete = $state('');
  // Quel épisode le lecteur joue actuellement — c'est le dernier cliqué
  // (#14 ne fournit pas d'événement « je suis rendu à l'épisode N » ;
  // #56 l'affinera via getCurrentTime).
  let episodeActif = $state<{ livre: NumeroLivre; episode: number } | null>(null);
  let lecteur: Lecteur;

  // Index des ~400 titres, construit une fois : `requete` est réactif, pas
  // l'index.
  const indexTitres = creerIndexTitres(aplatir(livres));

  // `null` = pas de recherche active → on montre le sommaire.
  // `[]` = recherche sans résultat.
  const resultats = $derived(
    requete.trim() ? chercherParTitre(indexTitres, requete) : null,
  );

  function videoIdDuLivre(livre: NumeroLivre): string {
    // Chaque épisode porte le video_id de son livre (redondant mais déjà
    // établi par le modèle de données, docs/SPECS.md section 4) : le premier
    // suffit à connaître la vidéo du livre entier.
    return livres.find((l) => l.livre === livre)!.episodes[0].video_id;
  }

  // Constante : la vidéo du livre affiché au chargement. `Lecteur` traque sa
  // prop `videoIdInitial` comme dépendance de l'effet qui crée le player —
  // la lier à `livreActif` recréerait un player à chaque bascule d'onglet.
  const videoIdInitial = videoIdDuLivre(livres[0].livre);

  // `bind:this` est résolu au montage de l'enfant, avant tout clic — le `?.`
  // n'est qu'une ceinture : un clic ne doit jamais lever si le lecteur n'est
  // pas encore là, juste ne rien faire.
  function onLivreChange(livre: NumeroLivre) {
    livreActif = livre;
    lecteur?.choisirLivre(videoIdDuLivre(livre));
  }

  function onEpisodeClick(livre: NumeroLivre, episode: EpisodeListe) {
    // Un résultat de recherche peut venir d'un autre livre que celui affiché
    // (issue #18) : l'onglet suit, pour que le sommaire retrouve le bon
    // livre une fois la recherche effacée. `allerA` charge déjà la bonne
    // vidéo quel que soit l'onglet — pas besoin de `choisirLivre` en plus.
    livreActif = livre;
    episodeActif = { livre, episode: episode.episode };
    lecteur?.allerA(episode.video_id, episode.start_seconds);
  }
</script>

<Lecteur bind:this={lecteur} {videoIdInitial} />

<div class="recherche">
  <label for="recherche-titre">Rechercher un épisode par titre</label>
  <input
    id="recherche-titre"
    type="search"
    bind:value={requete}
    placeholder="filtrer par titre…"
    autocomplete="off"
  />
</div>

<SelecteurLivre
  {livres}
  {livreActif}
  {requete}
  {resultats}
  {episodeActif}
  {onLivreChange}
  {onEpisodeClick}
/>

<style>
  .recherche {
    margin-bottom: var(--esp-4);
  }

  .recherche label {
    display: block;
    font-family: var(--police-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--encre-pale);
    margin-bottom: var(--esp-1);
  }

  .recherche input {
    width: 100%;
    padding: var(--esp-2) var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    background: var(--surface);
    color: var(--encre);
    font: inherit;
  }

  .recherche input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .recherche input::placeholder {
    color: var(--encre-pale);
  }
</style>
