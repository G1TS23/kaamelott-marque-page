import { configDefaults, defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Config dédiée à Vitest (issue #85, audit de stabilisation) — jusqu'ici les
 * tests tournaient sur les défauts de Vitest (environnement Node, aucun
 * composant Svelte compilé), suffisant tant que seule la logique pure de
 * `src/lib/` était testée. Les composants (`src/components/*.svelte`)
 * n'étaient testables ni montés ni rendus : le plugin Svelte les compile
 * (Astro les compile déjà pour le site lui-même, `astro.config.mjs`, mais
 * Vitest tourne hors du pipeline Astro, il lui faut sa propre instance).
 *
 * `environment` n'est *pas* fixé globalement à `happy-dom` : les tests de
 * `src/lib/`/`src/styles/` sont du Node pur (ex. `tokens.test.ts` résout des
 * chemins de fichiers via `import.meta.url`, qui n'est plus une URL
 * `file:` sous un environnement navigateur simulé) — l'environnement par
 * défaut de Vitest (`node`) reste le bon pour eux. Chaque test de composant
 * choisit `happy-dom` explicitement via un commentaire
 * `// @vitest-environment happy-dom` en tête de fichier plutôt que d'y
 * forcer tout le monde.
 *
 * `resolve.conditions: ['browser']` (uniquement sous Vitest, `process.env.VITEST`) :
 * sans ça, Svelte résout sa propre build côté serveur (SSR) même dans un
 * test en environnement navigateur, et `mount()` (utilisé par
 * `@testing-library/svelte`) échoue avec « not available on the server » —
 * la configuration documentée par Svelte pour tester des composants sous
 * Vitest (https://svelte.dev/docs/svelte/testing).
 */
export default defineConfig({
  plugins: [svelte()],
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  // `e2e/` (issue #128) : suite Playwright, un exécuteur de test différent —
  // sans cette exclusion, Vitest tente aussi de lancer ces fichiers (son
  // `include` par défaut ne distingue pas *.spec.ts par dossier) et échoue,
  // `test()` de Playwright n'ayant pas de sens hors de son propre exécuteur.
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
