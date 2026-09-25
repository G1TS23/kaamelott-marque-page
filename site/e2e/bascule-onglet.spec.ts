import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  installerFausseAPIYoutube,
  lireCompteursLecteurFactice,
  lireVideoIdLecteurFactice,
} from './aides/fausse-api-youtube';

/**
 * Parcours documentés à la main dans docs/qc-bascule-onglet-resultat.md
 * (issue #18 et suites), issue #128.
 */

test.beforeEach(async ({ page }) => {
  await installerFausseAPIYoutube(page);
  await page.goto('/');
});

function ongletLivre(page: Page, numero: number): Locator {
  return page.locator('nav[aria-label="Choix du livre"] button', { hasText: `Livre ${numero}` });
}

/** Cherche `terme`, attend le résultat `texte` et clique dessus. */
async function chercherEtCliquer(page: Page, terme: string, texte: string): Promise<void> {
  await page.locator('#recherche-titre').fill(terme);
  const resultat = page.locator('ul[aria-label="Résultats de recherche"] button', {
    hasText: texte,
  });
  await expect(resultat).toBeVisible();
  await resultat.click();
}

test("cliquer un résultat d'un autre livre bascule l'onglet sur ce livre", async ({ page }) => {
  await chercherEtCliquer(page, 'table', 'L’Art de la table');

  await expect(ongletLivre(page, 4)).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => lireVideoIdLecteurFactice(page)).toBe('lTN7vNhawyg');
});

test("changer d'onglet après une lecture n'interrompt jamais la lecture en cours (découplage, issue #18)", async ({
  page,
}) => {
  await chercherEtCliquer(page, 'table', 'L’Art de la table');
  await expect(ongletLivre(page, 4)).toHaveAttribute('aria-current', 'true');

  const avant = await lireCompteursLecteurFactice(page);

  // Un onglet ne fait que changer la liste affichée (issue #18) : ne doit
  // jamais toucher au lecteur, même en pleine lecture d'un autre livre.
  await ongletLivre(page, 2).click();

  const apres = await lireCompteursLecteurFactice(page);
  expect(apres).toEqual(avant);

  // La recherche est vidée et le sommaire du livre choisi s'affiche...
  await expect(page.locator('#recherche-titre')).toHaveValue('');
  await expect(page.locator('.jouer', { hasText: 'Spangenhelm' })).toBeVisible();

  // ...mais le repère « en direct » reste sur l'onglet du livre qui joue
  // réellement (Livre 4), pas sur celui affiché (Livre 2).
  await expect(ongletLivre(page, 4).locator('.pastille')).toHaveClass(/pastille-active/);
});
