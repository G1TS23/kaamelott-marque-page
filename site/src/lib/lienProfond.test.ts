import { describe, expect, it } from 'vitest';

import type { LivreEnListe } from './episodes.ts';
import { analyserLienProfond, parametresLienProfond } from './lienProfond.ts';

const episodeHeat = {
  id: 's1e01',
  episode: 1,
  title: 'Heat',
  start_seconds: 514.83,
  video_id: 'REFu8UmXXE0',
};
const episodeTartes = {
  id: 's1e02',
  episode: 2,
  title: 'Les Tartes aux myrtilles',
  start_seconds: 744.8,
  video_id: 'REFu8UmXXE0',
};

const livres: LivreEnListe[] = [
  { livre: 1, episodes: [episodeHeat, episodeTartes] },
  { livre: 2, episodes: [] },
];

describe('analyserLienProfond', () => {
  it('retrouve le livre et l’épisode correspondant aux paramètres', () => {
    const params = new URLSearchParams({ livre: '1', episode: 's1e02' });
    expect(analyserLienProfond(params, livres)).toEqual({ livre: 1, episode: episodeTartes });
  });

  it('renvoie null sans aucun paramètre', () => {
    expect(analyserLienProfond(new URLSearchParams(), livres)).toBeNull();
  });

  it('renvoie null si un seul des deux paramètres est présent', () => {
    expect(analyserLienProfond(new URLSearchParams({ livre: '1' }), livres)).toBeNull();
    expect(analyserLienProfond(new URLSearchParams({ episode: 's1e02' }), livres)).toBeNull();
  });

  it("renvoie null si le livre n'existe pas", () => {
    const params = new URLSearchParams({ livre: '9', episode: 's1e02' });
    expect(analyserLienProfond(params, livres)).toBeNull();
  });

  it("renvoie null si l'épisode n'existe pas dans ce livre", () => {
    const params = new URLSearchParams({ livre: '2', episode: 's1e02' });
    expect(analyserLienProfond(params, livres)).toBeNull();
  });

  it('renvoie null pour un livre non numérique (lien corrompu)', () => {
    const params = new URLSearchParams({ livre: 'abc', episode: 's1e02' });
    expect(analyserLienProfond(params, livres)).toBeNull();
  });
});

describe('parametresLienProfond', () => {
  it('produit des paramètres que analyserLienProfond sait relire', () => {
    const params = parametresLienProfond(1, episodeTartes);
    expect(analyserLienProfond(params, livres)).toEqual({ livre: 1, episode: episodeTartes });
  });

  it('utilise bien livre et episode comme noms de paramètres', () => {
    const params = parametresLienProfond(1, episodeHeat);
    expect(params.get('livre')).toBe('1');
    expect(params.get('episode')).toBe('s1e01');
  });
});
