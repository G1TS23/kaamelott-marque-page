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
   *   groupe ne doit se réduire que si une vidéo a été *réellement* lancée
   *   — pas juste affichée en vignette, sans quoi parcourir le sommaire
   *   sans rien écouter collait quand même un lecteur en pleine taille
   *   inutilement. Une pause, elle, ne décolle pas le groupe : voir
   *   `lectureEngagee` plus bas pour le détail des états qui comptent.
   * - enfin (#56) : l'épisode « en cours » (ligne surlignée du sommaire,
   *   repère du lecteur réduit) suit la position de lecture réelle, pas
   *   seulement le dernier épisode cliqué — voir `videoIdActif` et
   *   `tempsCourant` plus bas.
   */
  import {
    aplatir,
    type DonneesRecherche,
    type EpisodeListe,
    type LivreEnListe,
    type NumeroLivre,
  } from '../lib/episodes.ts';
  import {
    chercherEpisodes,
    creerIndexPersonnages,
    creerIndexResumes,
    creerIndexTitres,
    joindreDonneesRecherche,
  } from '../lib/recherche.ts';
  import Lecteur from './Lecteur.svelte';
  import Onglets from './Onglets.svelte';
  import RechercheMobile from './RechercheMobile.svelte';
  import ResultatsRecherche from './ResultatsRecherche.svelte';
  import Sommaire from './Sommaire.svelte';

  let { livres }: { livres: LivreEnListe[] } = $props();

  let livreActif = $state<NumeroLivre>(livres[0].livre);
  let requete = $state('');
  // Champ de recherche en ligne dans l'en-tête (desktop) vs plein écran
  // ouvert par une loupe (mobile, sous 640px) — retour d'usage : le champ
  // en ligne débordait sur un petit écran, pas la place pour le nom du
  // site *et* un champ utilisable (voir le CSS de l'en-tête).
  let rechercheMobileOuverte = $state(false);
  // La vidéo actuellement chargée dans le lecteur et la position de lecture
  // (secondes) — c'est ce couple, pas « le dernier épisode cliqué », qui
  // détermine l'épisode en cours (`episodeActif` plus bas, issue #56) :
  // laisser la vidéo avancer jusqu'à l'épisode suivant sans rien cliquer,
  // ou sauter dans la barre de progrès YouTube, doivent aussi mettre à jour
  // la ligne surlignée du sommaire et le repère du lecteur réduit — un état
  // posé une fois au clic ne le permettrait pas. `videoIdActif` change au
  // clic (`onEpisodeClick`) ; `tempsCourant` suit aussi `onProgression`
  // (Lecteur.svelte), qui sonde `getCurrentTime()`.
  let videoIdActif = $state(videoIdDuLivre(livres[0].livre));
  let tempsCourant = $state(0);
  let lecteur: Lecteur;
  let sentinelle: HTMLDivElement;
  // Vrai une fois le groupe lecteur + onglets scrollé sous l'en-tête —
  // ne suffit pas à lui seul à décider de la réduction, voir `reduit`.
  let collant = $state(false);
  // Vrai dès qu'une vidéo a été lancée, et tant qu'elle ne repasse pas à
  // l'état « vignette » (retour d'usage : une simple vignette affichée ne
  // justifie pas de coller un mini-lecteur — mais une fois lancée, une
  // pause ne doit pas le décoller pour autant, on garde le contexte de ce
  // qu'on écoutait). Voir `Lecteur.svelte` pour le détail des états qui
  // comptent comme « engagée ».
  let lectureEngagee = $state(false);
  // Les deux conditions à la fois pilotent la réduction du lecteur, le
  // collage du groupe et l'apparition du repère d'épisode.
  const reduit = $derived(collant && lectureEngagee);

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

  // Index du titre, construit une fois : `requete` est réactif, pas l'index.
  const episodesAvecLivre = aplatir(livres);
  const indexTitres = creerIndexTitres(episodesAvecLivre);

  // Résumé et personnages (issue #16) : chargés à part du HTML initial
  // (~300 Ko de résumés, docs/SPECS.md section 5) via `/recherche.json`,
  // récupérés une fois au montage de l'îlot. `null` tant que le fetch n'a
  // pas résolu — la recherche par titre reste utilisable seule en
  // attendant, personnage et résumé s'ajoutent dès que prêts (réactivité :
  // `donneesRecherche` passe de `null` à peuplé, tout ce qui en dépend se
  // recalcule tout seul).
  let donneesRecherche = $state<DonneesRecherche[] | null>(null);

  $effect(() => {
    fetch('/recherche.json')
      .then((r) => r.json())
      .then((donnees: DonneesRecherche[]) => {
        donneesRecherche = donnees;
      })
      .catch(() => {
        // Pas grave : la recherche par titre reste utilisable seule.
      });
  });

  const episodesRecherche = $derived(
    donneesRecherche ? joindreDonneesRecherche(episodesAvecLivre, donneesRecherche) : null,
  );
  const indexPersonnages = $derived(
    episodesRecherche ? creerIndexPersonnages(episodesRecherche) : null,
  );
  const indexResumes = $derived(episodesRecherche ? creerIndexResumes(episodesRecherche) : null);

  // `[]` tant qu'il n'y a pas de requête (ou trop courte) comme sans
  // résultat — c'est `requete.trim()` ci-dessous qui distingue les deux
  // pour l'affichage (pas de recherche active → sommaire ; recherche sans
  // résultat → message dédié dans `ResultatsRecherche.svelte`).
  const resultats = $derived(
    chercherEpisodes(indexTitres, indexPersonnages, indexResumes, requete),
  );
  const rechercheActive = $derived(requete.trim().length > 0);

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

  // Sens inverse de `videoIdDuLivre` : à quel livre appartient la vidéo
  // chargée. Chaque livre a sa propre vidéo (jamais partagée), une
  // correspondance directe suffit — pas besoin de connaître l'épisode.
  function livreDuVideoId(videoId: string): NumeroLivre {
    return livres.find((l) => l.episodes[0].video_id === videoId)?.livre ?? livres[0].livre;
  }

  const livreEnCours = $derived(livreDuVideoId(videoIdActif));

  // Dernier épisode du livre en cours dont le `start_seconds` est atteint —
  // les épisodes d'un livre sont triés par numéro (`chargerLivre`), donc
  // aussi par `start_seconds` croissant, un simple parcours suffit. `null`
  // uniquement si `tempsCourant` est avant le premier épisode (ne devrait
  // pas arriver en pratique, chaque vidéo commençant par son épisode 1).
  const episodeEnCoursDetails = $derived.by(() => {
    const episodes = livres.find((l) => l.livre === livreEnCours)?.episodes ?? [];
    let trouve: EpisodeListe | null = null;
    for (const episode of episodes) {
      if (episode.start_seconds > tempsCourant) break;
      trouve = episode;
    }
    return trouve;
  });

  // `null` tant qu'aucune vidéo n'a été réellement lancée (retour d'usage
  // #54) : sans lecture engagée, ni la ligne du sommaire ni le repère du
  // lecteur réduit ne doivent pointer un épisode — le lecteur n'affiche
  // encore qu'une vignette, pas une lecture en cours (issue #56 : suit
  // maintenant la position de lecture, pas le dernier épisode cliqué, voir
  // `videoIdActif`/`tempsCourant` plus haut).
  const episodeActif = $derived(
    lectureEngagee && episodeEnCoursDetails
      ? { livre: livreEnCours, episode: episodeEnCoursDetails.episode }
      : null,
  );
  const episodeActifDetails = $derived(lectureEngagee ? episodeEnCoursDetails : null);

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
    // Mise à jour optimiste (issue #56) : `onProgression` (sondage,
    // `Lecteur.svelte`) rattraperait ces valeurs de toute façon, mais dans
    // la seconde qui suit le clic — sans ça la ligne surlignée et le repère
    // resteraient un instant sur l'ancien épisode.
    videoIdActif = episode.video_id;
    tempsCourant = episode.start_seconds;
    lecteur?.allerA(episode.video_id, episode.start_seconds);
    // Retour en douceur en haut (issue #54, retour d'usage) : cliquer un
    // épisode pendant que le groupe est réduit doit ramener le lecteur en
    // grand, pas juste changer ce qui joue hors champ.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Referme le panneau de résultats desktop après un clic (retour d'usage :
  // un panneau flottant qui reste ouvert sur un épisode qu'on vient de
  // quitter donne l'impression d'un bug, contrairement à l'ancien
  // remplacement en place du sommaire, qui pouvait rester affiché).
  function onResultatClick(livre: NumeroLivre, episode: EpisodeListe) {
    onEpisodeClick(livre, episode);
    requete = '';
  }
</script>

<header class="entete-collante" style="--gouttiere: {gouttiere}px">
  <div class="entete-interieur">
    <h1 class="marque">Le Marque-Page de la Relecture</h1>
    <div class="recherche">
      <label for="recherche-titre" class="sr-only">
        Rechercher un épisode par titre, résumé ou personnage
      </label>
      <input
        id="recherche-titre"
        type="search"
        bind:value={requete}
        placeholder="titre, résumé, personnage…"
        autocomplete="off"
      />
      {#if rechercheActive}
        <div class="panneau-resultats">
          <ResultatsRecherche {resultats} {livreActif} onEpisodeClick={onResultatClick} />
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="recherche-bouton"
      onclick={() => (rechercheMobileOuverte = true)}
      aria-label="Rechercher un épisode par titre"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
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
    {requete}
    {resultats}
    {livreActif}
    onRequeteChange={(v) => (requete = v)}
    {onEpisodeClick}
    onFermer={() => (rechercheMobileOuverte = false)}
  />
{/if}

<div bind:this={sentinelle} class="sentinelle" aria-hidden="true"></div>
<div class="groupe-collant" class:actif={reduit}>
  <div class="groupe-ligne">
    <Lecteur
      bind:this={lecteur}
      {videoIdInitial}
      {reduit}
      onChangementEngagement={(v) => (lectureEngagee = v)}
      onProgression={(s) => (tempsCourant = s)}
    />
    {#if reduit}
      <div class="groupe-repere">
        <span class="groupe-repere-livre">Livre {livreEnCours}</span>
        {#if episodeActifDetails}
          <span class="groupe-repere-episode">
            {episodeActifDetails.episode} - {episodeActifDetails.title}
          </span>
        {/if}
      </div>
    {/if}
  </div>
  <Onglets {livres} {livreActif} {episodeActif} {onLivreChange} />
</div>

<Sommaire {livres} {livreActif} {episodeActif} {onEpisodeClick} />

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
    /* Même fond que la page, pas de bordure : l'en-tête ne doit pas se
       détacher visuellement du contenu (retour d'usage) — seul le champ de
       recherche, lui, garde un fond distinct (voir .recherche input).
       Légèrement translucide + `backdrop-filter` (retour d'usage) : sans
       transparence, un flou n'aurait rien à flouter, le fond du dessous
       étant déjà uni. `color-mix` plutôt qu'une couleur en dur : reste un
       alias de `--fond`, pas une valeur qui échapperait au thème sombre.

       Constaté par l'usager : le flou se voyait dans Safari, pas dans
       Chrome (juste la transparence) — pas un bug de rendu, un bug de
       build. `-webkit-backdrop-filter` et `backdrop-filter` déclarés tous
       les deux (habitude par prudence) étaient traités comme deux formes
       redondantes de la même propriété par le minifieur CSS de Vite/Astro,
       qui n'en gardait qu'une seule (la préfixée, la dernière déclarée) —
       vérifié en inspectant `dist/_astro/*.css` après un build local, avec
       et sans minification. Chrome ne reconnaît que la forme standard,
       Safari reconnaissait les deux : d'où l'écart. `-webkit-` retiré
       plutôt que réordonné : rebuild avec Lightning CSS (le minifieur de
       Vite conscient des navigateurs réellement ciblés, --browserslist)
       confirme que la forme standard seule suffit désormais. */
    background: color-mix(in srgb, var(--fond) 70%, transparent);
    backdrop-filter: blur(8px);
    /* Calque GPU dédié : mesure de robustesse standard pour
       `backdrop-filter` sur un `position: fixed`, gardée par prudence même
       après avoir trouvé la vraie cause ci-dessus. */
    transform: translateZ(0);
  }

  /* Contrairement au reste du site, le contenu de l'en-tête n'est *pas*
     aligné sur --largeur-contenu (760px) : elle utilise toute la largeur
     de la fenêtre, comme sur YouTube. Trois colonnes : le titre (`auto`,
     jamais rétréci sous son contenu — voir plus bas pourquoi c'est
     important), la recherche (`1fr`, centrée dans l'espace qu'il reste),
     la loupe mobile (`auto`, vide sur desktop).

     Une vraie colonne centrale symétrique (`1fr auto 1fr`, essayée d'abord)
     imposerait la même largeur des deux côtés du titre — pour ne pas le
     recouvrir, le côté vide de droite devrait réserver *autant* de place
     que le titre en occupe à gauche, ce qui ne laisse plus assez de place
     pour une recherche utilisable entre 640 et ~1000px de large : question
     de géométrie, pas de réglage. Centrer la recherche dans l'espace
     restant *après* le titre (au lieu du milieu de la barre entière) coûte
     un centrage visuel légèrement décalé sur les très grands écrans, mais
     garantit que le titre ne soit jamais ni recouvert ni tronqué, à
     n'importe quelle largeur. */
  .entete-interieur {
    height: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--esp-3);
    padding: 0 var(--esp-4);
  }

  .marque {
    grid-column: 1;
    font-family: var(--police-titre);
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
  }

  .recherche {
    /* Ancre le panneau de résultats (issue #16, `.panneau-resultats`
       ci-dessous) : `position: absolute` s'y positionne, pas à la fenêtre. */
    position: relative;
    grid-column: 2;
    justify-self: center;
    /* Rétrécit avec la fenêtre plutôt que de rester fixe à 28rem (retour
       d'usage : elle recouvrait le titre entre 640 et 1000px) — un
       pourcentage de sa propre colonne (déjà nette du titre et de ses
       marges) plutôt que du viewport : s'adapte à la place réellement
       disponible, pas à une largeur de fenêtre qui ignorerait la longueur
       du titre. */
    width: min(28rem, 65%);
  }

  /* Panneau de résultats (issue #16), ancré au champ plutôt qu'un
   * remplacement en place du sommaire (retour d'usage sur la maquette :
   * https://claude.ai/code/artifact/2f432b47-3b4e-4b45-8600-41cafe85a4e4).
   * Largeur minimale supérieure au champ (qui peut descendre sous 28rem,
   * voir ci-dessus) et alignée sur son bord droit — demande explicite,
   * pour ne jamais paraître plus étroit que ce qui l'a ouvert. `min()`
   * plutôt qu'un couple min-width/max-width (qui se contrediraient) :
   * cible 32rem, cède seulement si la fenêtre est vraiment plus étroite —
   * en pratique jamais avant 640px, où `RechercheMobile` prend le relais. */
  .panneau-resultats {
    position: absolute;
    top: calc(100% + var(--esp-2));
    right: 0;
    width: min(32rem, calc(100vw - 2 * var(--esp-4)));
    max-height: 70vh;
    overflow-y: auto;
    background: var(--surface-haute);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-carte);
    box-shadow: var(--ombre);
    padding: var(--esp-2) var(--esp-3);
    /* Au-dessus de l'en-tête (6) qui la contient, sous le dialog de
       recherche mobile (10, `RechercheMobile.svelte`) — sans effet réel ici
       vu que `.entete-collante` fixe déjà toute sa stacking context
       au-dessus de `.groupe-collant` (5), gardé pour la lisibilité. */
    z-index: 7;
  }

  .recherche input {
    width: 100%;
    padding: 0.4em var(--esp-3);
    border: 1px solid var(--trait);
    border-radius: var(--rayon-pilule);
    /* Se détache du fond de l'en-tête (retour d'usage) — l'ancien fond de
       l'en-tête lui-même, avant qu'il ne devienne transparent. */
    background: var(--surface-haute);
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

  /* Sur deux lignes plutôt qu'une (retour d'usage) : le livre seul ne
     suffit pas à se repérer parmi ~100 épisodes par livre, il faut aussi
     le numéro. `min-width: 0` sur le conteneur et chaque ligne : dans un
     flex (`.groupe-ligne`), un enfant ne rétrécit pas sous son contenu par
     défaut, l'ellipse ne s'appliquerait donc jamais sans ça (déjà rencontré
     avec le titre de l'en-tête, voir plus haut). */
  .groupe-repere {
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    min-width: 0;
    font-family: var(--police-mono);
  }

  .groupe-repere-livre,
  .groupe-repere-episode {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .groupe-repere-livre {
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--encre-pale);
  }

  .groupe-repere-episode {
    font-size: 0.78rem;
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
