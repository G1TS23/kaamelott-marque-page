<script lang="ts">
  /**
   * Racine de l'îlot du site (issue #14) : possède `livreActif`, seul état
   * que le lecteur et le sélecteur de livre doivent partager — c'est ce
   * partage, pas l'un ou l'autre composant, qui justifie ce niveau.
   *
   * Un clic sur un onglet ou un épisode ne fait rien lui-même : il ne fait
   * que dire ici ce qui vient de se passer, et c'est cette fonction qui
   * décide comment le lecteur doit réagir (specs section 6).
   */
  import type { EpisodeListe, LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
  import Lecteur from './Lecteur.svelte';
  import SelecteurLivre from './SelecteurLivre.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let lecteur: Lecteur;

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

  function onEpisodeClick(episode: EpisodeListe) {
    // Le sommaire ne liste que les épisodes du livre actif (#15/#18 pourront
    // un jour proposer un résultat d'un autre livre ; pas encore le cas ici) :
    // pas besoin de basculer d'onglet, seulement d'aller à la bonne seconde.
    lecteur?.allerA(episode.video_id, episode.start_seconds);
  }
</script>

<Lecteur bind:this={lecteur} {videoIdInitial} />
<SelecteurLivre {livres} {livreActif} {onLivreChange} {onEpisodeClick} />
