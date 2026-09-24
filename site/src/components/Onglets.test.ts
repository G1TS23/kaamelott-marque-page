// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import Onglets from './Onglets.svelte';
import type { LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

const livres: LivreEnListe[] = [1, 2, 3, 4].map((livre) => ({
  livre: livre as NumeroLivre,
  episodes: [],
}));

interface PropsOnglets {
  livres: LivreEnListe[];
  livreActif: NumeroLivre;
  episodeActif: { livre: NumeroLivre; episode: number } | null;
  onLivreChange: (livre: NumeroLivre) => void;
}

function props(overrides: Partial<PropsOnglets> = {}): PropsOnglets {
  return {
    livres,
    livreActif: 1,
    episodeActif: null,
    onLivreChange: vi.fn(),
    ...overrides,
  };
}

describe('Onglets', () => {
  it('affiche un onglet par livre', () => {
    render(Onglets, props());

    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByRole('button', { name: new RegExp(`Livre ${n}`) })).toBeTruthy();
    }
  });

  it('appelle onLivreChange avec le numéro cliqué', () => {
    const onLivreChange = vi.fn();
    render(Onglets, props({ onLivreChange }));

    screen.getByRole('button', { name: /Livre 3/ }).click();

    expect(onLivreChange).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('marque uniquement le livre affiché comme actif (aria-current)', () => {
    render(Onglets, props({ livreActif: 2 }));

    expect(screen.getByRole('button', { name: /Livre 2/ }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /Livre 1/ }).getAttribute('aria-current')).toBeNull();
  });

  it('annonce « en cours de lecture » sur le livre en cours, même si un autre livre est affiché (issue #18)', () => {
    render(Onglets, props({ livreActif: 1, episodeActif: { livre: 3, episode: 5 } }));

    const ongletTrois = screen.getByRole('button', { name: /Livre 3/ });
    expect(ongletTrois.textContent).toContain('En cours de lecture.');
    const ongletUn = screen.getByRole('button', { name: /Livre 1/ });
    expect(ongletUn.textContent).not.toContain('En cours de lecture.');
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(Onglets, props({ episodeActif: { livre: 1, episode: 1 } }));
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
