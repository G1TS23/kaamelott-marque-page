import { defineConfig } from '@playwright/test';

// Suite e2e ciblée (issue #128) sur les parcours déjà documentés à la main
// dans docs/qc-lecteur-collant.md et docs/qc-bascule-onglet-resultat.md.
// Sur un build de production (comme la suite a11y de randomfolio) : le
// serveur de dev n'applique pas les mêmes en-têtes/optimisations que la
// prod, et ce sont ces deux docs qui font foi sur le comportement attendu.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4332',
    url: 'http://localhost:4332',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4332', browserName: 'chromium' },
});
