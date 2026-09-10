import { describe, expect, it } from 'vitest';
import { chercherParTitre, creerIndexTitres } from './recherche';
import type { EpisodeAvecLivre } from './episodes';

function ep(livre: 1 | 2 | 3 | 4, episode: number, title: string): EpisodeAvecLivre {
  return { livre, episode, title, start_seconds: episode * 200, video_id: `vid${livre}` };
}

const CATALOGUE: EpisodeAvecLivre[] = [
  ep(1, 1, 'Heat'),
  ep(1, 2, 'Les Tartes aux myrtilles'),
  ep(1, 3, 'La Table de Breccan'),
  ep(2, 1, 'Spangenhelm'),
  ep(2, 40, 'La Tarte de Trelan'),
  ep(3, 12, 'Le Baptême du roi'),
];

const index = creerIndexTitres(CATALOGUE);

describe('chercherParTitre', () => {
  it('ne renvoie rien pour une requête vide ou trop courte', () => {
    expect(chercherParTitre(index, '')).toEqual([]);
    expect(chercherParTitre(index, '   ')).toEqual([]);
    expect(chercherParTitre(index, 'a')).toEqual([]);
  });

  it('place la correspondance exacte en tête', () => {
    const r = chercherParTitre(index, 'Les Tartes aux myrtilles');
    expect(r[0]).toMatchObject({ livre: 1, episode: 2 });
  });

  it('tolère une faute de frappe', () => {
    const titres = chercherParTitre(index, 'tarte au myrtile').map((e) => e.title);
    expect(titres).toContain('Les Tartes aux myrtilles');
  });

  it('trouve sur un mot au milieu du titre', () => {
    const titres = chercherParTitre(index, 'breccan').map((e) => e.title);
    expect(titres).toContain('La Table de Breccan');
  });

  it('cherche dans les 4 livres et garde le livre de chaque résultat', () => {
    const r = chercherParTitre(index, 'tarte');
    const livres = new Set(r.map((e) => e.livre));
    expect(livres.has(1)).toBe(true); // Les Tartes aux myrtilles
    expect(livres.has(2)).toBe(true); // La Tarte de Trelan
    for (const item of r) {
      expect(item.video_id).toBe(`vid${item.livre}`);
    }
  });

  it('ne ramène pas un titre sans rapport', () => {
    const titres = chercherParTitre(index, 'baptême').map((e) => e.title);
    expect(titres).toContain('Le Baptême du roi');
    expect(titres).not.toContain('Heat');
  });
});
