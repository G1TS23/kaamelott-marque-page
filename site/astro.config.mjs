// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
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
