// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import RechercheMobile from './RechercheMobile.svelte';

afterEach(cleanup);

function props() {
  return {
    requete: '',
    resultats: [],
    onRequeteChange: vi.fn(),
    onEpisodeClick: vi.fn(),
    onFermer: vi.fn(),
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
});
