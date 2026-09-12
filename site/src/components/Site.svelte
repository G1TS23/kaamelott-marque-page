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
   * Issue #54 (lecteur collant), deux retours d'usage successifs :
   * - un premier essai (lecteur plein écran collé au bord) jugé trop brut,
   *   remplacé par un en-tête toujours collée (nom du site + recherche,
   *   comme YouTube) et un groupe lecteur+onglets qui colle réduit, avec
   *   une marge visible — direction comparée sur plusieurs maquettes avant
   *   d'être choisie (docs/qc-lecteur-collant.md) ;
   * - puis : l'en-tête devait remplacer le grand titre de la page et
   *   prendre toute sa largeur (pas juste la largeur du contenu), et le
   *   groupe ne doit se réduire que si une vidéo est *réellement* en
   *   lecture — pas juste affichée (vignette) ou en pause, sans quoi
   *   parcourir le sommaire sans rien écouter collait quand même un
   *   lecteur en pleine taille inutilement.
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
  import RechercheMobile from './RechercheMobile.svelte';
  import Sommaire from './Sommaire.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let requete = $state('');
  // Champ de recherche en ligne dans l'en-tête (desktop) vs plein écran
  // ouvert par une loupe (mobile, sous 640px) — retour d'usage : le champ
  // en ligne débordait sur un petit écran, pas la place pour le nom du
  // site *et* un champ utilisable (voir le CSS de l'en-tête).
  let rechercheMobileOuverte = $state(false);
  // Quel épisode le lecteur joue actuellement — c'est le dernier cliqué
  // (#14 ne fournit pas d'événement « je suis rendu à l'épisode N » ;
  // #56 l'affinera via getCurrentTime).
  let episodeActif = $state<{ livre: NumeroLivre; episode: number } | null>(null);
  let lecteur: Lecteur;
  let sentinelle: HTMLDivElement;
  // Vrai une fois le groupe lecteur + onglets scrollé sous l'en-tête —
  // ne suffit pas à lui seul à décider de la réduction, voir `reduit`.
  let collant = $state(false);
  // Vrai quand le lecteur joue réellement (retour d'usage : une vignette
  // affichée ou une vidéo en pause ne justifient pas de coller un mini-
  // lecteur, seule une lecture active « perd son contexte » en scrollant).
  let enLecture = $state(false);
  // Les deux conditions à la fois pilotent la réduction du lecteur, le
  // collage du groupe et l'apparition du repère d'épisode.
  const reduit = $derived(collant && enLecture);

  // Largeur de la place réservée à la scrollbar (`scrollbar-gutter: stable`
  // sur `html`, Base.astro) — 0 sur mobile (scrollbar en survol, pas de
  // réserve). Sert uniquement à étirer l'en-tête collée jusqu'au vrai bord
  // de la fenêtre (voir `.entete-collante` plus bas) : `position: fixed`
  // s'arrête sinon au bord de cette réserve, pas de la fenêtre elle-même.
  let gouttiere = $state(0);

  $effect(() => {
    function mesurer() {
      gouttiere = window.innerWidth - document.documentElement.clientWidth;
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  });

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
    // que le `top` du groupe une fois réduit (3rem d'en-tête + --esp-2 de
    // marge, voir le CSS) : sans ça la sentinelle sortirait de la zone
    // visible avant même que le groupe n'atteigne son seuil de collage.
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

<header class="entete-collante" style="--gouttiere: {gouttiere}px">
  <div class="entete-interieur">
    <h1 class="marque">Le Marque-Page de la Relecture</h1>
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
    <button
      type="button"
      class="recherche-bouton"
      onclick={() => (rechercheMobileOuverte = true)}
      aria-label="Rechercher un épisode par titre"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"
          fill="currentColor"
        />
      </svg>
    </button>
  </div>
</header>

{#if rechercheMobileOuverte}
  <RechercheMobile
    {livres}
    {livreActif}
    {requete}
    {resultats}
    {episodeActif}
    onRequeteChange={(v) => (requete = v)}
    {onEpisodeClick}
    onFermer={() => (rechercheMobileOuverte = false)}
  />
{/if}

<div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
<div class="groupe-collant" class:actif={reduit}>
  <div class="groupe-ligne">
    <Lecteur bind:this={lecteur} {videoIdInitial} {reduit} onChangementLecture={(v) => (enLecture = v)} />
    {#if reduit}
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

<Sommaire {livres} {livreActif} {requete} {resultats} {episodeActif} {onEpisodeClick} />

<style>
  /* Toujours collée dès le chargement, comme YouTube (issue #54, retour
     d'usage) : le nom du site et la recherche ne doivent pas attendre un
     scroll pour redevenir accessibles. `fixed` (pas `sticky`) et non
     confinée à la largeur du contenu (`--largeur-contenu`) : elle a
     remplacé le grand titre de la page et doit occuper toute la largeur
     de la fenêtre, comme sur YouTube — un `sticky` resterait contraint à
     la largeur de son bloc englobant (`main`, centré et plafonné). */
  .entete-collante {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    /* `right: 0` s'arrête au bord de la place réservée pour la scrollbar
       (`scrollbar-gutter: stable` sur `html`, Base.astro) : un `fixed` ne
       la couvre pas de lui-même, d'où un liseré du fond de la page visible
       à droite (retour d'usage). `100vw - 100%` (l'astuce CSS habituelle
       pour ce cas) s'est révélé égal à 0 dans ce navigateur — `vw` y est
       déjà réduit par `scrollbar-gutter`, pas fiable ici. Mesurée en JS à
       la place (`--gouttiere`, ci-dessous) : différence entre la largeur
       de la fenêtre et celle réellement disponible, quelle que soit la
       largeur de la scrollbar (variable selon OS/navigateur, nulle sur
       mobile). */
    margin-right: calc(-1 * var(--gouttiere, 0px));
    z-index: 6;
    height: 3rem;
    background: var(--surface-haute);
    border-bottom: 1px solid var(--trait);
  }

  /* Contrairement au reste du site, le contenu de l'en-tête n'est *pas*
     aligné sur --largeur-contenu (760px) : avec un titre complet
     (« Le Marque-Page de la Relecture ») à gauche et une recherche de
     largeur confortable vraiment centrée, les deux se chevauchent dans une
     colonne aussi étroite — mathématiquement, pas un réglage à ajuster
     (255px de titre + une recherche centrée de 448px ne tiennent pas dans
     720px utiles). Comme sur YouTube, dont l'en-tête n'est pas non plus
     calé sur la largeur de son contenu : elle utilise toute la largeur de
     la fenêtre. Trois colonnes plutôt qu'un simple `flex` : `1fr` de
     chaque côté absorbe la différence quelle que soit la longueur du
     titre, en respectant d'abord son contenu minimal avant de s'égaliser —
     la recherche reste ainsi centrée dans l'espace restant. */
  .entete-interieur {
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--esp-3);
    padding: 0 var(--esp-4);
  }

  .marque {
    grid-column: 1;
    justify-self: start;
    min-width: 0;
    font-family: var(--police-titre);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recherche {
    grid-column: 2;
    width: 28rem;
    max-width: 100%;
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

  /* Juste une loupe sous 640px (retour d'usage) : le champ en ligne n'a
     pas la place d'exister à côté du nom du site sur un petit écran — au
     lieu de le rétrécir jusqu'à l'illisible, un écran de recherche dédié
     (RechercheMobile.svelte) s'ouvre au clic. Caché par défaut : c'est le
     champ en ligne la variante par défaut, pour les écrans assez larges. */
  .recherche-bouton {
    display: none;
    grid-column: 3;
    justify-self: end;
    padding: var(--esp-1);
    border: none;
    background: transparent;
    color: var(--encre);
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .recherche {
      display: none;
    }

    .recherche-bouton {
      display: flex;
    }
  }

  /* Hauteur nulle : ne sert qu'à donner à l'IntersectionObserver un point
     de mesure situé juste au-dessus du groupe collant (voir le script). */
  .sentinelle {
    height: 1px;
  }

  /* `position: static` par défaut — pas sticky tant que rien ne joue
     réellement (retour d'usage) : parcourir le sommaire sans écouter ne
     doit pas coller un lecteur en pleine taille pour rien, la vidéo doit
     simplement défiler comme le reste du contenu. `.actif` (= `reduit` du
     script) active le collage réduit, avec une marge visible plutôt que
     plaqué au bord. */
  .groupe-collant.actif {
    position: sticky;
    top: calc(3rem + var(--esp-2));
    z-index: 5;
    border-radius: var(--rayon-carte);
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

  .groupe-collant :global(.onglets) {
    margin-top: var(--esp-3);
  }

  .groupe-collant.actif :global(.onglets) {
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
</style>
