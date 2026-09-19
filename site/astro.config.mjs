// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  // URL de prod (issue #79) : nécessaire pour que `Astro.site` résolve les
  // URL absolues des balises OpenGraph (og:url, og:image — le protocole
  // n'admet pas de chemin relatif) dans Base.astro.
  site: 'https://kaamelott.falahi.org',
  integrations: [svelte()],
  vite: {
    server: {
      fs: {
        // Les données d'épisodes vivent à la racine du dépôt (`data/`), hors
        // du dossier du site : sans ça, le serveur de dev refuse de les
        // servir. Le build, lui, les inline via les imports statiques de
        // src/lib/episodes.js.
        allow: ['..'],
      },
    },
  },
});
