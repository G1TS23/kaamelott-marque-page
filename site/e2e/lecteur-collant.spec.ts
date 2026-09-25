import { test, expect, type Page } from '@playwright/test';
import { installerFausseAPIYoutube, pauserLecteurFactice } from './aides/fausse-api-youtube';

/**
 * Parcours documentés à la main dans docs/qc-lecteur-collant.md (issue #54
 * et suites), issue #128. La vraie lecture YouTube est remplacée par
 * `installerFausseAPIYoutube` (voir ce fichier) : seule façon fiable de
 * déclencher un état `PLAYING` en navigateur automatisé, l'autoplay réel
 * étant bloqué par les politiques des navigateurs (limite déjà consignée
 * dans le doc QC).
 */

test.beforeEach(async ({ page }) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');
});

/**
 * Clique la facade, attend que la lecture soit réellement engagée, puis
 * scrolle jusqu'à ce que le groupe lecteur+onglets se réduise — point de
 * départ commun à la plupart des scénarios ci-dessous.
 */
async function demarrerEtReduire(page: Page): Promise<void> {
  await page.locator('button.facade').click();
  // La facade est quittée dès le clic (le lecteur se construit puis se lance
  // automatiquement — voir `demarrer()`, Lecteur.svelte).
  await expect(page.getByRole('button', { name: 'Mettre en pause', exact: true })).toBeVisible();
  await page.mouse.wheel(0, 2000);
  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);
}

test('scroller sans lecture active ne réduit pas le lecteur', async ({ page }) => {
  // Facade jamais quittée : aucune lecture n'a été demandée.
  await expect(page.locator('button.facade')).toBeVisible();

  await page.mouse.wheel(0, 2000);

  await expect(page.locator('.groupe-collant')).not.toHaveClass(/actif/);
});

test('scroller pendant une lecture engagée réduit le lecteur (issue #54)', async ({ page }) => {
  await demarrerEtReduire(page);

  await expect(page.locator('.cadre')).toHaveClass(/reduit/);
});

test("mettre en pause pendant la réduction ne décolle pas le lecteur (retour d'usage #54)", async ({
  page,
}) => {
  await demarrerEtReduire(page);

  await pauserLecteurFactice(page);

  await expect(page.locator('.groupe-collant')).toHaveClass(/actif/);
});

test('cliquer un épisode pendant la réduction remonte en haut et repasse le lecteur en grand', async ({
  page,
}) => {
  await demarrerEtReduire(page);

  await page.locator('.jouer', { hasText: 'Heat' }).click();

  await expect(page.locator('.groupe-collant')).not.toHaveClass(/actif/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});
