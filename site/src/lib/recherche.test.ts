import { describe, expect, it } from 'vitest';
import {
  chercherEpisodes,
  chercherParPersonnage,
  chercherParResume,
  chercherParTitre,
  creerIndexPersonnages,
  creerIndexResumes,
  creerIndexTitres,
  joindreDonneesRecherche,
  type EpisodeRecherche,
} from './recherche';
import type { DonneesRecherche, EpisodeAvecLivre } from './episodes';

function ep(livre: 1 | 2 | 3 | 4, episode: number, title: string): EpisodeAvecLivre {
  return {
    id: `s${livre}e${episode}`,
    livre,
    episode,
    title,
    start_seconds: episode * 200,
    video_id: `vid${livre}`,
  };
}

const CATALOGUE: EpisodeAvecLivre[] = [
  ep(1, 1, 'Heat'),
  ep(1, 2, 'Les Tartes aux myrtilles'),
  ep(1, 3, 'La Table de Breccan'),
  ep(2, 1, 'Spangenhelm'),
  ep(2, 40, 'La Tarte de Trelan'),
  ep(3, 12, 'Le Baptême du roi'),
  // Titres réels ajoutés pour le test de non-régression ci-dessous.
  ep(1, 66, 'Haunted'),
  ep(1, 76, 'Le Porte-bonheur'),
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

  it('reste précis sur une requête courte (retour d\'usage)', () => {
    // Contre les vrais titres, "hea" à threshold 0.4 ramenait 49 résultats,
    // dont "Le Porte-bonheur" et "Haunted" — sans rapport avec ce qui a été
    // tapé. Doit ne renvoyer que ce qui commence vraiment par "hea".
    const titres = chercherParTitre(index, 'hea').map((e) => e.title);
    expect(titres).toEqual(['Heat']);
  });
});

// Champs génériques (issue #55), sans rapport avec ce que ces tests
// vérifient (recherche titre/résumé/personnage) — mêmes valeurs partout,
// seuls `summary`/`characters` varient utilement d'un épisode à l'autre.
const GENERIQUE = { channel: 'M6', director: 'Alexandre Astier', writer: 'Alexandre Astier', guests: [] };

const DONNEES: DonneesRecherche[] = [
  {
    id: 's1e1',
    summary:
      'Arthur, Léodagan et Perceval sont isolés en forêt pendant une bataille et se cachent derrière des arbres.',
    characters: ['Arthur', 'Léodagan', 'Perceval'],
    ...GENERIQUE,
  },
  {
    id: 's1e2',
    summary:
      "Séli a cuisiné une tarte aux myrtilles qui s'avère immangeable, mais les convives doivent la goûter.",
    characters: ['Arthur', 'Guenièvre', 'Léodagan', 'Séli'],
    ...GENERIQUE,
  },
  {
    id: 's1e3',
    summary: 'Breccan, un artisan, livre une table ronde commandée par Arthur.',
    characters: ['Arthur', 'Breccan', 'Père Blaise'],
    ...GENERIQUE,
  },
  {
    id: 's2e1',
    summary: 'Arthur reçoit un casque venu de loin, le spangenhelm, cadeau encombrant.',
    characters: ['Arthur'],
    ...GENERIQUE,
  },
  {
    id: 's2e40',
    // Partage "tarte" avec s1e2 mais pas "myrtilles" — sert à vérifier que
    // le résultat qui matche les deux mots de la requête passe devant celui
    // qui n'en matche qu'un seul.
    summary: 'Une tarte différente provoque un esclandre à la table du roi.',
    characters: ['Léodagan'],
    ...GENERIQUE,
  },
  {
    id: 's3e12',
    summary: 'Le baptême du jeune roi rassemble toute la cour.',
    characters: ['Arthur'],
    ...GENERIQUE,
  },
  {
    id: 's1e66',
    summary: 'Un épisode sans rapport avec ce qui précède.',
    characters: [],
    ...GENERIQUE,
  },
  {
    id: 's1e76',
    summary: 'Encore un épisode sans rapport.',
    characters: [],
    ...GENERIQUE,
  },
];

const EPISODES_RECHERCHE: EpisodeRecherche[] = joindreDonneesRecherche(CATALOGUE, DONNEES);
const indexPersonnages = creerIndexPersonnages(EPISODES_RECHERCHE);
const indexResumes = creerIndexResumes(EPISODES_RECHERCHE);

describe('joindreDonneesRecherche', () => {
  it('recolle chaque épisode à ses données par id', () => {
    const r = joindreDonneesRecherche(CATALOGUE, DONNEES);
    expect(r).toHaveLength(CATALOGUE.length);
    expect(r.find((e) => e.id === 's1e2')?.characters).toContain('Séli');
  });

  it('ignore un épisode sans donnée de recherche correspondante', () => {
    const r = joindreDonneesRecherche(CATALOGUE, DONNEES.slice(0, 1));
    expect(r).toHaveLength(1);
  });
});

describe('chercherParPersonnage', () => {
  it('ne renvoie rien pour une requête vide ou trop courte', () => {
    expect(chercherParPersonnage(indexPersonnages, '')).toEqual([]);
    expect(chercherParPersonnage(indexPersonnages, 'a')).toEqual([]);
  });

  it('trouve tous les épisodes où un personnage apparaît', () => {
    const titres = chercherParPersonnage(indexPersonnages, 'Léodagan').map((e) => e.title);
    expect(titres).toEqual(
      expect.arrayContaining(['Heat', 'Les Tartes aux myrtilles', 'La Tarte de Trelan']),
    );
  });

  it('tolère une faute de frappe sur un nom', () => {
    const titres = chercherParPersonnage(indexPersonnages, 'Leodagan').map((e) => e.title);
    expect(titres).toContain('Heat');
  });
});

describe('chercherParResume', () => {
  it('classe en tête le résumé qui partage le plus de mots avec la requête', () => {
    const r = chercherParResume(indexResumes, 'tarte aux myrtilles');
    expect(r[0]?.item.title).toBe('Les Tartes aux myrtilles');
  });

  it('ne renvoie rien sur une description qui ne partage aucun mot avec aucun résumé', () => {
    // Même limite que celle documentée dans l'issue #60 (« celui où Perceval
    // empile des piques ») : le lexical ne trouve rien sans vocabulaire partagé.
    expect(chercherParResume(indexResumes, 'chevalier licorne dragon')).toEqual([]);
  });
});

describe('chercherEpisodes', () => {
  it('ne renvoie rien pour une requête vide ou trop courte', () => {
    expect(chercherEpisodes(index, indexPersonnages, indexResumes, '')).toEqual([]);
    expect(chercherEpisodes(index, indexPersonnages, indexResumes, 'a')).toEqual([]);
  });

  it('fonctionne titre seul quand personnage/résumé ne sont pas encore prêts', () => {
    const r = chercherEpisodes(index, null, null, 'Les Tartes aux myrtilles');
    expect(r[0]?.episode.title).toBe('Les Tartes aux myrtilles');
    expect(r[0]?.correspond).toEqual(['titre']);
  });

  it('dédoublonne un épisode qui matche sur plusieurs axes à la fois', () => {
    // "myrtilles" matche le titre ET le résumé du même épisode : un seul
    // résultat, étiqueté des deux, pas deux lignes.
    const r = chercherEpisodes(index, indexPersonnages, indexResumes, 'myrtilles');
    const occurences = r.filter((x) => x.episode.title === 'Les Tartes aux myrtilles');
    expect(occurences).toHaveLength(1);
    expect(occurences[0].correspond).toEqual(expect.arrayContaining(['titre', 'résumé']));
  });

  it('un nom de personnage ramène tous ses épisodes, dédupliqués', () => {
    const r = chercherEpisodes(index, indexPersonnages, indexResumes, 'Léodagan');
    const titres = r.map((x) => x.episode.title);
    expect(titres).toEqual(
      expect.arrayContaining(['Heat', 'Les Tartes aux myrtilles', 'La Tarte de Trelan']),
    );
    expect(new Set(titres).size).toBe(titres.length);
    for (const x of r) {
      if (x.episode.title === 'Les Tartes aux myrtilles') {
        expect(x.correspond).toContain('personnage');
      }
    }
  });

  it('classe le meilleur résultat en tête', () => {
    const r = chercherEpisodes(index, indexPersonnages, indexResumes, 'Les Tartes aux myrtilles');
    expect(r[0].episode.title).toBe('Les Tartes aux myrtilles');
  });
});
