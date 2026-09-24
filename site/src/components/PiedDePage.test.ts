// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import PiedDePage from './PiedDePage.svelte';
import { verifierAccessibilite } from '../test-utils/axe';

// `@testing-library/svelte` ne démonte pas automatiquement le composant
// rendu par un test précédent (contrairement à son intégration React) :
// sans ce `cleanup`, un deuxième test voit deux fois le même contenu monté
// et les requêtes `getByRole` échouent pour ambiguïté.
afterEach(cleanup);

/**
 * Test de fumée (issue #85) : valide que l'outillage de test de composant
 * (happy-dom + @testing-library/svelte + plugin Svelte, vitest.config.ts)
 * fonctionne bout en bout avant de s'attaquer aux composants complexes
 * (Site.svelte, Lecteur.svelte) — pas un test exhaustif de PiedDePage.svelte
 * lui-même, choisi pour sa simplicité (pas d'état interne, pas d'API
 * externe à simuler).
 */
describe('PiedDePage', () => {
  it('affiche les liens attendus', () => {
    render(PiedDePage);

    expect(screen.getByRole('link', { name: 'Shisheyu sur YouTube (nouvel onglet)' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shisheyu sur Twitch (nouvel onglet)' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toBeTruthy();
  });

  it('délègue le clic sur « Mentions légales » à onMentionsLegalesClick quand fourni', async () => {
    const onMentionsLegalesClick = vi.fn();
    render(PiedDePage, { onMentionsLegalesClick });

    screen.getByRole('link', { name: 'Mentions légales' }).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(onMentionsLegalesClick).toHaveBeenCalledOnce();
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(PiedDePage);
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
