<script lang="ts">
  /**
   * Contenu des mentions légales (issue #77), partagé entre la page
   * statique (`mentions-legales.astro`, sans `client:*` — Astro rend un
   * composant Svelte en HTML pur sans directive, exactement comme du
   * markup Astro classique, zéro JS expédié) et le panneau ouvert depuis
   * le site (`PanneauMentionsLegales.svelte`) : un seul texte à tenir à
   * jour, pas deux copies qui pourraient diverger.
   *
   * Pas de `<h1>` ici (délibéré) : chaque contexte a déjà le sien à un
   * niveau différent — le titre de page sur `mentions-legales.astro`, le
   * titre du site sur la page principale (le panneau utilise son propre
   * `<h2>` d'en-tête, voir `PanneauMentionsLegales.svelte`).
   */
</script>

<h2>Éditeur</h2>
<p>
  Ce site est édité par Olivier Falahi, agissant à titre non professionnel.
  Contact : <a href="mailto:olivier@falahi.org">olivier@falahi.org</a>.
</p>

<h2>Hébergement</h2>
<p>
  Netlify, Inc.<br />
  101 2nd Street, San Francisco, CA 94105-2239, États-Unis<br />
  <a href="https://www.netlify.com" target="_blank" rel="noopener noreferrer">
    netlify.com
  </a>
</p>

<h2>Propriété intellectuelle</h2>
<p>
  Kaamelott et ses dialogues appartiennent à Alexandre Astier et aux ayants
  droit d'origine de l'œuvre. Ce site n'est affilié ni à Alexandre Astier et
  ses ayants droit, ni à Shisheyu, c'est un outil non officiel qui aide à
  naviguer dans les lectures-interprétations publiées par Shisheyu sur
  YouTube, sans en reproduire le contenu.
</p>

<h2>Données personnelles</h2>
<p>
  Ce site ne collecte et ne transmet aucune donnée personnelle de son propre
  fait : pas de compte, pas de suivi statistique, pas de cookie posé par le
  site lui-même. Les recherches récentes affichées dans l'écran de recherche
  mobile restent uniquement dans le navigateur (stockage local), jamais
  envoyées où que ce soit.
</p>
<p>
  Le lecteur vidéo intégré charge des vidéos depuis YouTube (Google LLC),
  qui peut déposer ses propres cookies et traiter des données selon ses
  propres règles. Voir la <a
    href="https://policies.google.com/privacy"
    target="_blank"
    rel="noopener noreferrer">politique de confidentialité de Google</a>.
</p>

<style>
  h2 {
    margin-top: var(--esp-6);
  }

  p {
    color: var(--encre-douce);
  }

  /* Soulignés en permanence, pas seulement au survol — WCAG 1.4.1 (la
     couleur seule ne suffit pas à distinguer un lien), même règle que le
     pied de page. */
  a {
    text-decoration: underline;
  }
</style>
