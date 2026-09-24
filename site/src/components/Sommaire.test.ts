// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Sommaire from './Sommaire.svelte';
import type { DonneesRecherche, EpisodeListe, LivreEnListe, NumeroLivre } from '../lib/episodes.ts';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

const livres: LivreEnListe[] = [
  {
    livre: 1,
    episodes: [
      { id: '1e0', episode: 0, title: 'Intro', start_seconds: 0, video_id: 'vid1' },
      { id: '1e1', episode: 1, title: 'Un', start_seconds: 10, video_id: 'vid1' },
      { id: '1e2', episode: 2, title: 'Deux', start_seconds: 20, video_id: 'vid1' },
    ],
  },
  {
    livre: 2,
    episodes: [{ id: '2e1', episode: 1, title: 'Autre livre', start_seconds: 0, video_id: 'vid2' }],
  },
];

interface PropsSommaire {
  livres: LivreEnListe[];
  livreActif: NumeroLivre;
  episodeActif: { livre: NumeroLivre; episode: number } | null;
  onEpisodeClick: (livre: NumeroLivre, episode: EpisodeListe) => void;
  donneesRecherche: DonneesRecherche[] | null;
}

function props(overrides: Partial<PropsSommaire> = {}): PropsSommaire {
  return {
    livres,
    livreActif: 1,
    episodeActif: null,
    onEpisodeClick: vi.fn(),
    donneesRecherche: null,
    ...overrides,
  };
}

describe('Sommaire', () => {
  it('affiche uniquement les épisodes du livre actif', () => {
    render(Sommaire, props());

    expect(screen.getByText('Un')).toBeTruthy();
    expect(screen.getByText('Deux')).toBeTruthy();
    expect(screen.queryByText('Autre livre')).toBeNull();
  });

  it("appelle onEpisodeClick avec le livre et l'épisode cliqués", () => {
    const onEpisodeClick = vi.fn();
    render(Sommaire, props({ onEpisodeClick }));

    screen.getByText('Un').closest('button')!.click();

    expect(onEpisodeClick).toHaveBeenCalledExactlyOnceWith(1, livres[0].episodes[1]);
  });

  it('marque la ligne active via aria-current, et aucune autre', () => {
    render(Sommaire, props({ episodeActif: { livre: 1, episode: 2 } }));

    const ligneUn = screen.getByText('Un').closest('button')!;
    const ligneDeux = screen.getByText('Deux').closest('button')!;

    expect(ligneUn.getAttribute('aria-current')).toBeNull();
    expect(ligneDeux.getAttribute('aria-current')).toBe('true');
  });

  it("l'intro n'a pas de chevron de détails (issue #71)", () => {
    render(Sommaire, props());
    const ligneIntro = screen.getByText('Intro').closest('li')!;

    expect(ligneIntro.querySelector('.chevron')).toBeNull();
    expect(ligneIntro.querySelector('.chevron-espace')).not.toBeNull();
  });

  it('le chevron déplie et replie les détails, un seul à la fois (accordéon)', async () => {
    render(Sommaire, props());

    const chevronUn = screen.getByRole('button', { name: 'Afficher les détails de Un' });
    const chevronDeux = screen.getByRole('button', { name: 'Afficher les détails de Deux' });
    const detailsUn = document.getElementById('details-1e1')!;
    const detailsDeux = document.getElementById('details-1e2')!;

    expect(detailsUn.hidden).toBe(true);

    chevronUn.click();
    await tick();
    expect(detailsUn.hidden).toBe(false);
    expect(chevronUn.getAttribute('aria-expanded')).toBe('true');

    // Ouvrir le second referme le premier (état `ligneDepliee` unique,
    // pas un `Set` — un accordéon classique, pas une liste multi-ouverte).
    chevronDeux.click();
    await tick();
    expect(detailsDeux.hidden).toBe(false);
    expect(detailsUn.hidden).toBe(true);

    // Recliquer le même chevron replie.
    screen.getByRole('button', { name: 'Masquer les détails de Deux' }).click();
    await tick();
    expect(detailsDeux.hidden).toBe(true);
  });

  it("affiche un état de chargement si les détails ne sont pas encore résolus, puis le résumé une fois arrivés", async () => {
    const { rerender } = render(Sommaire, props({ donneesRecherche: null }));

    screen.getByRole('button', { name: 'Afficher les détails de Un' }).click();
    await tick();
    const details = document.getElementById('details-1e1')!;
    expect(details.textContent).toContain('Chargement…');

    await rerender(
      props({
        donneesRecherche: [
          {
            id: '1e1',
            summary: 'Un résumé.',
            characters: ['Arthur'],
            channel: 'M6',
            director: 'A. Astier',
            writer: 'A. Astier',
            guests: [],
          },
        ],
      }),
    );

    expect(details.textContent).toContain('Un résumé.');
    expect(details.textContent).not.toContain('Chargement…');
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(Sommaire, props());
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
