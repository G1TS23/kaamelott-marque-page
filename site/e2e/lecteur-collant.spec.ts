import { test, expect } from '@playwright/test';
import { installerFausseAPIYoutube } from './aides/fausse-api-youtube';

/**
 * Parcours documentés à la main dans docs/qc-lecteur-collant.md (issue #54
 * et suites), issue #128. La vraie lecture YouTube est remplacée par
 * `installerFausseAPIYoutube` (voir ce fichier) : seule façon fiable de
 * déclencher un état `PLAYING` en navigateur automatisé, l'autoplay réel
 * étant bloqué par les politiques des navigateurs (limite déjà consignée
 * dans le doc QC).
 */

test('scroller sans lecture active ne réduit pas le lecteur', async ({ page }) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  // Facade jamais quittée : aucune lecture n'a été demandée.
  await expect(page.locator('button.facade')).toBeVisible();

  await page.mouse.wheel(0, 2000);

  await expect(page.locator('.groupe-collant')).not.toHaveClass(/actif/);
});

test('scroller pendant une lecture engagée réduit le lecteur (issue #54)', async ({ page }) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  await page.locator('button.facade').click();
  // La facade est quittée dès le clic (le lecteur se construit puis se lance
  // automatiquement — voir `demarrer()`, Lecteur.svelte).
  await expect(page.getByRole('button', { name: 'Mettre en pause', exact: true })).toBeVisible();

  await page.mouse.wheel(0, 2000);

  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);
  await expect(page.locator('.cadre')).toHaveClass(/reduit/);
});

test("mettre en pause pendant la réduction ne décolle pas le lecteur (retour d'usage #54)", async ({
  page,
}) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  await page.locator('button.facade').click();
  await expect(page.getByRole('button', { name: 'Mettre en pause', exact: true })).toBeVisible();
  await page.mouse.wheel(0, 2000);
  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);

  // Pause déclenchée côté IFrame (contrôles natifs YouTube, pas notre
  // bouton) — c'est bien cette origine-là que #54 avait ratée à l'origine
  // (seul PLAYING comptait comme « engagé »).
  await page.evaluate(() => {
    const lecteurs = (window as unknown as { __lecteursFactices: { pauseVideo(): void }[] })
      .__lecteursFactices;
    lecteurs[0].pauseVideo();
  });

  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);
});

test('cliquer un épisode pendant la réduction remonte en haut et repasse le lecteur en grand', async ({
  page,
}) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');

  await page.locator('button.facade').click();
  await expect(page.getByRole('button', { name: 'Mettre en pause', exact: true })).toBeVisible();
  await page.mouse.wheel(0, 2000);
  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);

  await page.locator('.jouer', { hasText: 'Heat' }).click();

  await expect(page.locator('.groupe-collant')).not.toHaveClass(/actif/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});
