// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// URL du déploiement courant (issue #79, retour d'usage) : nécessaire pour
// que `Astro.site` résolve les URL absolues des balises OpenGraph (og:url,
// og:image — le protocole n'admet pas de chemin relatif) dans Base.astro.
// Un domaine fixe casserait les deploy previews Netlify — chaque PR a sa
// propre URL, distincte de la prod, où `og-image.jpg` de cette PR-ci
// n'existe pas encore tant qu'elle n'est pas mergée. `DEPLOY_PRIME_URL`
// (Netlify, posée au build) vaut cette URL de déploiement — celle du
// preview en contexte deploy-preview, celle de la prod en contexte
// production (identique à `URL` dans ce cas). Repli sur la prod en dur
// pour un `npm run build` local, hors Netlify, où ces variables n'existent
// pas.
const urlDeploiement = process.env.DEPLOY_PRIME_URL ?? 'https://kaamelott.falahi.org';

// https://astro.build/config
export default defineConfig({
  site: urlDeploiement,
  // Gain limité vu la taille du site (2 pages : accueil + mentions légales),
  // mais standard peu coûteux à poser — vérifié par la plupart des outils/
  // audits SEO (issue #117).
  integrations: [svelte(), sitemap()],
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
