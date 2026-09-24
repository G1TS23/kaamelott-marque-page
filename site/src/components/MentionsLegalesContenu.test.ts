// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import MentionsLegalesContenu from './MentionsLegalesContenu.svelte';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

describe('MentionsLegalesContenu', () => {
  it('affiche les quatre sections attendues', () => {
    render(MentionsLegalesContenu);

    for (const titre of ['Éditeur', 'Hébergement', 'Propriété intellectuelle', 'Données personnelles']) {
      expect(screen.getByRole('heading', { name: titre })).toBeTruthy();
    }
  });

  it('les liens externes ouvrent un nouvel onglet sans exposer window.opener', () => {
    render(MentionsLegalesContenu);

    for (const nom of [/netlify\.com/, /politique de confidentialité de Google/]) {
      const lien = screen.getByRole('link', { name: nom });
      expect(lien.getAttribute('target')).toBe('_blank');
      expect(lien.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(MentionsLegalesContenu);
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
