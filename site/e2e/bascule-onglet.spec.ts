import { test, expect } from '@playwright/test';
import { installerFausseAPIYoutube } from './aides/fausse-api-youtube';

/**
 * Parcours documentés à la main dans docs/qc-bascule-onglet-resultat.md
 * (issue #18 et suites), issue #128.
 */

test("cliquer un résultat d'un autre livre bascule l'onglet sur ce livre", async ({ page }) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  await page.locator('#recherche-titre').fill('table');

  const resultat = page.locator('ul[aria-label="Résultats de recherche"] button', {
    hasText: 'L’Art de la table',
  });
  await expect(resultat).toBeVisible();
  await resultat.click();

  await expect(
    page.locator('nav[aria-label="Choix du livre"] button', { hasText: 'Livre 4' }),
  ).toHaveAttribute('aria-current', 'true');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __lecteursFactices: { videoId: string }[] })
            .__lecteursFactices[0]?.videoId,
      ),
    )
    .toBe('lTN7vNhawyg');
});

test("changer d'onglet après une lecture n'interrompt jamais la lecture en cours (découplage, issue #18)", async ({
  page,
}) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  await page.locator('#recherche-titre').fill('table');
  const resultat = page.locator('ul[aria-label="Résultats de recherche"] button', {
    hasText: 'L’Art de la table',
  });
  await expect(resultat).toBeVisible();
  await resultat.click();

  await expect(
    page.locator('nav[aria-label="Choix du livre"] button', { hasText: 'Livre 4' }),
  ).toHaveAttribute('aria-current', 'true');

  type Compteurs = { play: number; pause: number; seek: number; chargement: number };
  const lireCompteurs = () =>
    page.evaluate(
      (): Compteurs => {
        const l = (
          window as unknown as {
            __lecteursFactices: {
              appelsPlay: number;
              appelsPause: number;
              appelsSeek: number[];
              appelsChargement: unknown[];
            }[];
          }
        ).__lecteursFactices[0];
        return {
          play: l.appelsPlay,
          pause: l.appelsPause,
          seek: l.appelsSeek.length,
          chargement: l.appelsChargement.length,
        };
      },
    );

  const avant = await lireCompteurs();

  // Un onglet ne fait que changer la liste affichée (issue #18) : ne doit
  // jamais toucher au lecteur, même en pleine lecture d'un autre livre.
  await page.locator('nav[aria-label="Choix du livre"] button', { hasText: 'Livre 2' }).click();

  const apres = await lireCompteurs();
  expect(apres).toEqual(avant);

  // La recherche est vidée et le sommaire du livre choisi s'affiche...
  await expect(page.locator('#recherche-titre')).toHaveValue('');
  await expect(page.locator('.jouer', { hasText: 'Spangenhelm' })).toBeVisible();

  // ...mais le repère « en direct » reste sur l'onglet du livre qui joue
  // réellement (Livre 4), pas sur celui affiché (Livre 2).
  const ongletLivre4 = page.locator('nav[aria-label="Choix du livre"] button', {
    hasText: 'Livre 4',
  });
  await expect(ongletLivre4.locator('.pastille')).toHaveClass(/pastille-active/);
});
