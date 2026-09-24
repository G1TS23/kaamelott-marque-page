// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import ResultatsRecherche from './ResultatsRecherche.svelte';
import type { ResultatRecherche } from '../lib/recherche.ts';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

const resultats: ResultatRecherche[] = [
  {
    episode: { id: '1e1', episode: 1, title: 'Un', start_seconds: 0, video_id: 'vid1', livre: 1 },
    correspond: ['titre'],
  },
  {
    episode: { id: '2e3', episode: 3, title: 'Trois', start_seconds: 10, video_id: 'vid2', livre: 2 },
    correspond: ['personnage', 'résumé'],
  },
];

describe('ResultatsRecherche', () => {
  it("affiche un message dédié quand il n'y a aucun résultat", () => {
    render(ResultatsRecherche, { resultats: [], onEpisodeClick: vi.fn() });

    expect(screen.getByText('Aucun épisode ne correspond.')).toBeTruthy();
  });

  it('affiche un résultat par épisode avec son type de correspondance', () => {
    render(ResultatsRecherche, { resultats, onEpisodeClick: vi.fn() });

    expect(screen.getByText('Un')).toBeTruthy();
    expect(screen.getByText('titre')).toBeTruthy();
    expect(screen.getByText('Trois')).toBeTruthy();
    expect(screen.getByText('personnage · résumé')).toBeTruthy();
  });

  it("appelle onEpisodeClick avec le livre et l'épisode du résultat cliqué", () => {
    const onEpisodeClick = vi.fn();
    render(ResultatsRecherche, { resultats, onEpisodeClick });

    screen.getByText('Trois').closest('button')!.click();

    expect(onEpisodeClick).toHaveBeenCalledExactlyOnceWith(2, resultats[1].episode);
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(ResultatsRecherche, { resultats, onEpisodeClick: vi.fn() });
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
