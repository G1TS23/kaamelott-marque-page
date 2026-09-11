<script lang="ts">
  /**
   * Sélecteur de livre (onglets) — extrait de l'ex-`SelecteurLivre.svelte`
   * (issue #54, retour d'usage sur la première version du lecteur collant).
   * Le lecteur réduit doit coller juste à côté des onglets (« groupe
   * collant », voir le style de `Site.svelte`), ce qui suppose que les deux
   * soient des frères DOM directs — impossible tant que les onglets
   * vivaient dans le même composant que la liste des épisodes.
   *
   * Purement présentationnel, comme avant l'extraction : `livreActif` et
   * l'épisode en cours sont décidés par `Site.svelte`.
   */
  import type { LivreEnListe, NumeroLivre } from '../lib/episodes.ts';

  let {
    livres,
    livreActif,
    episodeActif,
    onLivreChange,
  }: {
    livres: LivreEnListe[];
    livreActif: NumeroLivre;
    episodeActif: { livre: NumeroLivre; episode: number } | null;
    onLivreChange: (livre: NumeroLivre) => void;
  } = $props();
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

<style>
  /*
   * Conventions du design system (issue #51, docs/SPECS.md section 8) :
   * pilules pour les onglets, état actif signalé par --accent-voile /
   * --accent-fort.
   */

  .onglets {
    display: flex;
    gap: var(--esp-2);
    flex-wrap: wrap;
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
    /* rem (pas px) comme le reste du système de tailles — sinon le texte
       déborde de la pilule dès que la police racine grandit (accessibilité
       « agrandir le texte »), le padding suivant mais pas la hauteur.
       22.4px / 16 = 1.4rem. */
    height: 1.4rem;
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
     (affiché ou non), comme les indicateurs de direct habituels. Toujours
     rendue (juste transparente si inactive), pas seulement quand un livre
     joue : sinon la largeur de l'onglet changerait selon qu'un livre est en
     cours de lecture ou non.

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
    left: calc((var(--esp-4) - 0.5rem - 1px) / 2);
    top: 50%;
    transform: translateY(-50%);
    width: 0.5rem;
    height: 0.5rem;
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
</style>
