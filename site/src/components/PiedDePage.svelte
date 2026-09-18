<script lang="ts">
  /**
   * Pied de page (issue #20, périmètre redéfini en revue) : crédit
   * permanent à Shisheyu — YouTube et Twitch, logos monochromes
   * (`currentColor`, comme les autres icônes du site — pas de couleur de
   * marque en dur, cf. tokens.test.ts) — plus le site et le GitHub de
   * l'auteur du projet (GitHub en icône seule, sans libellé). Toujours
   * visible en bas de l'écran, sur une seule ligne même en mobile.
   *
   * Accessibilité (retour d'usage) :
   * - Liens toujours soulignés, pas seulement au survol — WCAG 1.4.1 (« Use
   *   of Color ») : un lien doit se distinguer du texte autour par plus que
   *   sa seule couleur.
   * - Couleur `--profond` plutôt que `--encre-pale` : c'est le token dédié
   *   aux liens dans le design system (tokens.css), et surtout le seul des
   *   deux qui passe le contraste AA (~5.7:1 en clair, ~8.3:1 en sombre,
   *   contre ~2.8:1/4.4:1 pour `--encre-pale` — mesuré, `--encre-pale` est
   *   pensé pour du texte secondaire non interactif, pas des liens).
   * - « Shisheyu » apparaît deux fois (YouTube, Twitch) : un texte visible
   *   identique sur deux liens vers des destinations différentes est
   *   ambigu au lecteur d'écran (l'icône seule ne porte pas cette
   *   distinction, `aria-hidden`) — complété par un texte masqué qui
   *   nomme la plateforme (WCAG 2.5.3, le nom accessible contient bien le
   *   texte visible).
   * - Chaque lien précise qu'il s'ouvre dans un nouvel onglet (texte
   *   masqué ou `aria-label` selon le lien) — changement de contexte pas
   *   annoncé autrement.
   *
   * `gouttiere` : même correction que l'en-tête (Site.svelte) pour que le
   * bord droit du bandeau touche vraiment le bord de la fenêtre malgré la
   * réserve de scrollbar (`scrollbar-gutter: stable`, Base.astro).
   */
  import {
    URL_CHAINE_TWITCH_SHISHEYU,
    URL_CHAINE_YOUTUBE_SHISHEYU,
    URL_GITHUB_AUTEUR,
    URL_SITE_AUTEUR,
  } from '../lib/liens.ts';

  let { gouttiere = 0 }: { gouttiere?: number } = $props();
</script>

<footer class="pied-de-page" style="--gouttiere: {gouttiere}px">
  <a href={URL_CHAINE_YOUTUBE_SHISHEYU} target="_blank" rel="noopener noreferrer" class="lien-icone">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        fill="currentColor"
      />
    </svg>
    <span aria-hidden="true">Shisheyu</span>
    <span class="sr-only">Shisheyu sur YouTube (nouvel onglet)</span>
  </a>
  <a href={URL_CHAINE_TWITCH_SHISHEYU} target="_blank" rel="noopener noreferrer" class="lien-icone">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0Zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"
        fill="currentColor"
      />
    </svg>
    <span aria-hidden="true">Shisheyu</span>
    <span class="sr-only">Shisheyu sur Twitch (nouvel onglet)</span>
  </a>
  <span class="separateur" aria-hidden="true">·</span>
  <a href={URL_SITE_AUTEUR} target="_blank" rel="noopener noreferrer">
    olivier.falahi.org <span class="sr-only">(nouvel onglet)</span>
  </a>
  <a
    href={URL_GITHUB_AUTEUR}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Profil GitHub (nouvel onglet)"
    class="lien-icone"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
        fill="currentColor"
      />
    </svg>
  </a>
  <span class="separateur" aria-hidden="true">·</span>
  <a href="/mentions-legales">Mentions légales</a>
</footer>

<style>
  .pied-de-page {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    /* Voir le commentaire du script : compense la réserve de scrollbar,
       même technique que .entete-collante dans Site.svelte. */
    margin-right: calc(-1 * var(--gouttiere, 0px));
    z-index: 6;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--esp-4);
    height: 2.75rem;
    padding: 0 var(--esp-4);
    background: color-mix(in srgb, var(--fond) 85%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--trait);
    font-size: 0.85rem;
    color: var(--encre-pale);
    /* Une seule ligne toujours (retour d'usage), y compris en mobile —
       défilement horizontal en secours plutôt qu'un retour à la ligne, sur
       ce bandeau seulement (jamais la page entière). */
    white-space: nowrap;
    overflow-x: auto;
  }

  /* `--profond` (pas `--encre-pale`) : voir la note d'accessibilité dans le
     script — c'est le token de ce design system dédié aux liens, et le
     seul des deux qui passe le contraste AA sur le fond du bandeau.
     Soulignés en permanence, pas seulement au survol (WCAG 1.4.1). */
  .pied-de-page a {
    color: var(--profond);
    text-decoration: underline;
  }

  /* `(hover: hover)` plutôt qu'un `:hover` nu (même retour d'usage
     qu'ailleurs sur le site) : sur un écran tactile, la pseudo-classe
     reste collée après un tap tant qu'on ne touche pas ailleurs. */
  @media (hover: hover) {
    .pied-de-page a:hover {
      color: var(--accent-fort);
    }
  }

  .lien-icone {
    display: flex;
    align-items: center;
    gap: 0.35em;
    flex: none;
  }

  /* Un SVG inline garde par défaut l'espace de descente réservé au texte
     (vertical-align: baseline) — invisible sur un icône seul, mais décale
     verticalement de quelques pixels par rapport à un icône dans un
     conteneur flex centré (c'était le cas du lien GitHub, retour d'usage :
     seul lien sans .lien-icone avant ce correctif). `display: block`
     supprime cet espace pour de bon, sur toutes les icônes du bandeau. */
  .pied-de-page svg {
    display: block;
  }

  .separateur {
    color: var(--trait);
    flex: none;
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

  /* Sous ~430px (issue #74, mesuré) : le bandeau déborde encore même
     réduit (18px à 414px, 65px à 320px) — la quasi-totalité des mobiles
     réels, pas un cas limite. `overflow-x: auto` masquait le symptôme
     (rien ne signale qu'il y a plus de liens à découvrir en scrollant un
     pied de page) sans le résoudre. `flex-wrap: wrap` à la place : passe
     sur deux lignes plutôt que de déborder ou de scroller, `height: auto`
     avec un padding vertical au lieu de la hauteur fixe (variable selon
     le nombre de lignes réellement nécessaire à la largeur de l'écran). */
  @media (max-width: 640px) {
    .pied-de-page {
      flex-wrap: wrap;
      row-gap: var(--esp-1);
      column-gap: var(--esp-3);
      height: auto;
      padding: var(--esp-2) var(--esp-3);
      font-size: 0.78rem;
      white-space: normal;
      overflow-x: visible;
    }
  }
</style>
