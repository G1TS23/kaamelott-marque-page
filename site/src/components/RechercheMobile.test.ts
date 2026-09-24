// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import RechercheMobile from './RechercheMobile.svelte';
import type { ResultatRecherche } from '../lib/recherche.ts';
import { verifierAccessibilite } from '../test-utils/axe';

const CLE_STOCKAGE = 'marque-page:recherches-recentes';

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

interface Props {
  requete: string;
  resultats: ResultatRecherche[];
  onRequeteChange: (v: string) => void;
  onEpisodeClick: (livre: number, episode: unknown) => void;
  onFermer: () => void;
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    requete: '',
    resultats: [],
    onRequeteChange: vi.fn(),
    onEpisodeClick: vi.fn(),
    onFermer: vi.fn(),
    ...overrides,
  };
}

describe('RechercheMobile', () => {
  it("associe un <label> au champ (issue #114) plutôt que de ne dépendre que de l'aria-label du dialogue", () => {
    render(RechercheMobile, props());

    // `getByLabelText` échoue si l'input n'a pas de nom accessible via un
    // <label> associé — exactement ce que #114 corrige.
    expect(
      screen.getByLabelText('Rechercher un épisode par titre, résumé ou personnage'),
    ).toBeTruthy();
  });

  it('appelle onFermer sur Échap et au clic sur le bouton retour', () => {
    const onFermer = vi.fn();
    render(RechercheMobile, props({ onFermer }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onFermer).toHaveBeenCalledOnce();

    screen.getByRole('button', { name: 'Fermer la recherche' }).click();
    expect(onFermer).toHaveBeenCalledTimes(2);
  });

  it('affiche les recherches récentes tant que la requête est vide, pas de résultats', () => {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(['léodagan']));
    render(RechercheMobile, props({ requete: '' }));

    expect(screen.getByText('léodagan')).toBeTruthy();
  });

  it("choisir une recherche récente met à jour la requête", () => {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(['perceval']));
    const onRequeteChange = vi.fn();
    render(RechercheMobile, props({ requete: '', onRequeteChange }));

    screen.getByRole('button', { name: /perceval/ }).click();

    expect(onRequeteChange).toHaveBeenCalledExactlyOnceWith('perceval');
  });

  it('affiche les résultats (pas les recherches récentes) dès que la requête est non vide', () => {
    const resultats: ResultatRecherche[] = [
      {
        episode: { id: '1e1', episode: 1, title: 'Un', start_seconds: 0, video_id: 'vid1', livre: 1 },
        correspond: ['titre'],
      },
    ];
    render(RechercheMobile, props({ requete: 'un', resultats }));

    expect(screen.getByText('Un')).toBeTruthy();
  });

  it("cliquer un résultat déclenche onEpisodeClick, ferme l'écran et enregistre la requête en récente", () => {
    const resultats: ResultatRecherche[] = [
      {
        episode: { id: '1e1', episode: 1, title: 'Un', start_seconds: 0, video_id: 'vid1', livre: 1 },
        correspond: ['titre'],
      },
    ];
    const onEpisodeClick = vi.fn();
    const onFermer = vi.fn();
    render(RechercheMobile, props({ requete: 'un', resultats, onEpisodeClick, onFermer }));

    screen.getByText('Un').closest('button')!.click();

    expect(onEpisodeClick).toHaveBeenCalledExactlyOnceWith(1, resultats[0].episode);
    expect(onFermer).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(CLE_STOCKAGE)!)).toEqual(['un']);
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(RechercheMobile, props());
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
