<script lang="ts">
  /**
   * Racine de l'îlot du site : possède l'état que le lecteur, les onglets,
   * le sommaire et la recherche doivent partager.
   *
   * Trois responsabilités bien séparées, retour d'usage sur #18 : parcourir
   * un livre (onglet) et écouter un épisode (lecteur) sont deux actions
   * indépendantes depuis que la recherche permet de lire un épisode d'un
   * livre différent de celui affiché — avant, elles coïncidaient toujours,
   * un onglet pouvait se permettre de piloter le lecteur sans que ça se
   * voie. Ce n'est plus vrai :
   * - `livreActif` — quel sommaire est affiché. Change au clic d'onglet et
   *   au clic d'épisode (pour que le sommaire retrouve le bon livre une
   *   fois la recherche effacée), jamais tout seul.
   * - `requete` — la recherche en cours. Vidée par un clic d'onglet : un
   *   onglet dit « montre-moi ce livre », pas « garde mes résultats ».
   * - le lecteur — jamais touché par la navigation (onglet ou recherche),
   *   seulement par un clic sur un épisode précis.
   *
   * Issue #54 (lecteur collant), après relecture d'un premier essai jugé
   * trop brut (lecteur plein écran collé, sans marge, recherche/onglets
   * inaccessibles, rien en dessous) : le nom du site et la recherche sont
   * remontés dans un en-tête toujours collée (comme YouTube) ; le lecteur
   * et les onglets collent *ensemble*, réduits, avec une marge visible
   * (« groupe collant », direction comparée sur plusieurs maquettes avant
   * d'être choisie — docs/qc-lecteur-collant.md).
   */
  import {
    aplatir,
    type EpisodeListe,
    type LivreEnListe,
    type NumeroLivre,
  } from '../lib/episodes.ts';
  import { chercherParTitre, creerIndexTitres } from '../lib/recherche.ts';
  import Lecteur from './Lecteur.svelte';
  import Onglets from './Onglets.svelte';
  import Sommaire from './Sommaire.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let requete = $state('');
  // Quel épisode le lecteur joue actuellement — c'est le dernier cliqué
  // (#14 ne fournit pas d'événement « je suis rendu à l'épisode N » ;
  // #56 l'affinera via getCurrentTime).
  let episodeActif = $state<{ livre: NumeroLivre; episode: number } | null>(null);
  let lecteur: Lecteur;
  let sentinelle: HTMLDivElement;
  // Vrai une fois le groupe lecteur + onglets réellement collé en haut de
  // la fenêtre (issue #54) — `position: sticky` seul ne le dit pas, d'où la
  // sentinelle plus bas. Pilote la réduction du lecteur et l'apparition du
  // repère d'épisode à côté.
  let collant = $state(false);

  // Index des ~400 titres, construit une fois : `requete` est réactif, pas
  // l'index.
  const indexTitres = creerIndexTitres(aplatir(livres));

  // `null` = pas de recherche active → on montre le sommaire.
  // `[]` = recherche sans résultat.
  const resultats = $derived(
    requete.trim() ? chercherParTitre(indexTitres, requete) : null,
  );

  // Titre de l'épisode en cours, pour le repère affiché à côté du lecteur
  // réduit — `null` tant qu'aucun épisode n'a été explicitement cliqué (le
  // lecteur affiche alors juste la vidéo du premier livre, sans qu'un
  // épisode précis soit « en cours » au sens de #14).
  const episodeActifDetails = $derived.by(() => {
    if (!episodeActif) return null;
    const livre = livres.find((l) => l.livre === episodeActif.livre);
    return livre?.episodes.find((e) => e.episode === episodeActif.episode) ?? null;
  });

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

  $effect(() => {
    // `position: sticky` ne déclenche aucun événement natif quand le
    // groupe se colle réellement — technique standard : une sentinelle
    // sans hauteur utile juste au-dessus, observée par rapport à la
    // fenêtre. `rootMargin` décale la zone d'observation du même montant
    // que le `top` du groupe (3rem d'en-tête + --esp-2 de marge, voir le
    // CSS) : sans ça la sentinelle sortirait de la zone visible avant même
    // que le groupe n'atteigne son seuil de collage, et il se réduirait
    // trop tôt.
    const observateur = new IntersectionObserver(
      ([entree]) => {
        collant = !entree.isIntersecting;
      },
      { threshold: 0, rootMargin: '-56px 0px 0px 0px' },
    );
    observateur.observe(sentinelle);
    return () => observateur.disconnect();
  });

  // Un onglet ne fait que changer la liste affichée : ni la recherche
  // (qui montrerait encore des résultats d'un autre livre) ni le lecteur
  // (qui couperait une lecture en cours) ne doivent rester dans les
  // pattes de ce geste de pure navigation.
  function onLivreChange(livre: NumeroLivre) {
    livreActif = livre;
    requete = '';
  }

  function onEpisodeClick(livre: NumeroLivre, episode: EpisodeListe) {
    // Un résultat de recherche peut venir d'un autre livre que celui affiché
    // (issue #18) : l'onglet suit, pour que le sommaire retrouve le bon
    // livre une fois la recherche effacée. `bind:this` est résolu avant
    // tout clic — le `?.` n'est qu'une ceinture.
    livreActif = livre;
    episodeActif = { livre, episode: episode.episode };
    lecteur?.allerA(episode.video_id, episode.start_seconds);
    // Retour en douceur en haut (issue #54, retour d'usage) : cliquer un
    // épisode pendant que le groupe est réduit doit ramener le lecteur en
    // grand, pas juste changer ce qui joue hors champ.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<header class="entete-collante">
  <span class="marque">Marque-Page</span>
  <div class="recherche">
    <label for="recherche-titre" class="sr-only">Rechercher un épisode par titre</label>
    <input
      id="recherche-titre"
      type="search"
      bind:value={requete}
      placeholder="filtrer par titre…"
      autocomplete="off"
    />
  </div>
</header>

<div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
<div class="groupe-collant">
  <div class="groupe-interieur" class:collant>
    <div class="groupe-ligne">
      <Lecteur bind:this={lecteur} {videoIdInitial} reduit={collant} />
      {#if collant}
        <p class="groupe-repere">
          Livre {episodeActif?.livre ?? livreActif}
          {#if episodeActifDetails}
            · <strong>{episodeActifDetails.title}</strong>
          {/if}
        </p>
      {/if}
    </div>
    <Onglets {livres} {livreActif} {episodeActif} {onLivreChange} />
  </div>
</div>

<Sommaire {livres} {livreActif} {requete} {resultats} {episodeActif} {onEpisodeClick} />

<style>
  /* Toujours collée dès le chargement, comme YouTube (issue #54, retour
     d'usage) : le nom du site et la recherche ne doivent pas attendre un
     scroll pour redevenir accessibles. */
  .entete-collante {
    position: sticky;
    top: 0;
    z-index: 6;
    height: 3rem;
    display: flex;
    align-items: center;
    gap: var(--esp-3);
    padding: 0 var(--esp-3);
    margin-bottom: var(--esp-4);
    background: var(--surface-haute);
    border-bottom: 1px solid var(--trait);
  }

  .marque {
    font-family: var(--police-titre);
    font-size: 1.05rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .recherche {
    flex: 1;
    min-width: 0;
  }

  .recherche input {
    width: 100%;
    padding: 0.4em var(--esp-3);
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

  /* Hauteur nulle : ne sert qu'à donner à l'IntersectionObserver un point
     de mesure situé juste au-dessus du groupe collant (voir le script). */
  .sentinelle {
    height: 1px;
  }

  /* Le lecteur et les onglets collent ensemble, réduits, plutôt que le
     lecteur seul en pleine taille (issue #54 — un premier essai en pleine
     largeur prenait trop de place, cachait tout en dessous sans transition,
     et rendait la recherche/les onglets inaccessibles). `top` avec une
     marge (`--esp-2`), pas plaqué au bord de la fenêtre. */
  .groupe-collant {
    position: sticky;
    top: calc(3rem + var(--esp-2));
    z-index: 5;
  }

  /* La carte (fond + ombre) n'apparaît qu'une fois réellement collé : au
     repos, le lecteur garde son propre cadre (Lecteur.svelte) sans carte
     autour, comme n'importe quel contenu de la page. */
  .groupe-interieur {
    border-radius: var(--rayon-carte);
    padding: 0;
    transition: padding 0.22s ease, box-shadow 0.22s ease;
  }

  .groupe-interieur.collant {
    padding: var(--esp-2);
    background: var(--surface);
    box-shadow: var(--ombre);
  }

  .groupe-ligne {
    display: flex;
    align-items: center;
    gap: var(--esp-3);
  }

  .groupe-repere {
    margin: 0;
    font-family: var(--police-mono);
    font-size: 0.78rem;
    color: var(--encre-douce);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .groupe-repere strong {
    color: var(--encre);
  }

  .groupe-interieur:not(.collant) .groupe-repere {
    display: none;
  }

  .groupe-interieur :global(.onglets) {
    margin-top: var(--esp-3);
    transition: margin-top 0.22s ease;
  }

  .groupe-interieur.collant :global(.onglets) {
    margin-top: var(--esp-2);
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

  @media (prefers-reduced-motion: reduce) {
    .groupe-interieur,
    .groupe-interieur :global(.onglets) {
      transition: none;
    }
  }
</style>
