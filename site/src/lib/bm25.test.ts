import { describe, expect, it } from 'vitest';
import { chercherBM25, creerIndexBM25, tokeniser } from './bm25';

interface Doc {
  id: string;
  texte: string;
}

function doc(id: string, texte: string): Doc {
  return { id, texte };
}

const CORPUS: Doc[] = [
  doc('a', "Séli a cuisiné une tarte aux myrtilles qui s'avère immangeable."),
  doc('b', "Perceval et Karadoc partent chasser un serpent géant en Écosse."),
  doc('c', 'Arthur reçoit à sa table un centurion romain venu critiquer les Bretons.'),
  doc('d', "Le Répurgateur vient soumettre au roi une loi interdisant la polygamie."),
];

const index = creerIndexBM25(CORPUS, (d) => d.texte);

describe('tokeniser', () => {
  it('normalise la casse et les accents', () => {
    expect(tokeniser('Épisode')).toEqual(['episode']);
  });

  it('retire les mots vides français', () => {
    expect(tokeniser('le roi et la reine')).toEqual(['roi', 'reine']);
  });

  it('ignore les mots trop courts', () => {
    expect(tokeniser('un a')).toEqual([]);
  });
});

describe('chercherBM25', () => {
  it('ne renvoie rien pour une requête vide ou sans rapport', () => {
    expect(chercherBM25(index, '')).toEqual([]);
    expect(chercherBM25(index, 'dragon licorne')).toEqual([]);
  });

  it('classe le bon document en tête sur un mot distinctif', () => {
    const r = chercherBM25(index, 'myrtilles');
    expect(r[0]?.item.id).toBe('a');
  });

  it('cumule le score sur plusieurs mots-clés partagés', () => {
    const r = chercherBM25(index, 'serpent Karadoc Écosse');
    expect(r[0]?.item.id).toBe('b');
    // Un document qui matche les 3 mots doit dominer un doc qui n'en
    // partage aucun.
    expect(r.map((x) => x.item.id)).not.toContain('c');
  });

  it('tolère une faute de frappe sur un mot du corpus (distance 1)', () => {
    const r = chercherBM25(index, 'myrtiles'); // "myrtilles" avec un seul "l"
    expect(r[0]?.item.id).toBe('a');
  });

  it('ne tolère pas une faute trop éloignée (pas de recherche floue générale)', () => {
    const r = chercherBM25(index, 'myrtxxxxlles');
    expect(r).toEqual([]);
  });

  it('trie par pertinence décroissante', () => {
    const r = chercherBM25(index, 'roi');
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    }
  });

  it('en cas de faute équidistante entre deux mots du corpus, corrige vers le plus fréquent', () => {
    // "aable" n'existe dans aucun texte, à distance 1 à la fois de "table"
    // (3 documents) et de "cable" (1 document) — doit se corriger vers le
    // plus fréquent plutôt que le premier rencontré dans le vocabulaire
    // (retour d'usage sur la revue de la PR #62 : l'ordre d'insertion était
    // arbitraire, pas un choix de pertinence).
    const corpus = [
      doc('t1', 'Une table ronde réunit les chevaliers.'),
      doc('t2', 'La table est dressée pour le banquet.'),
      doc('t3', 'Autour de la table, on débat longuement.'),
      doc('c1', 'Un cable relie les deux tours du château.'),
    ];
    const idx = creerIndexBM25(corpus, (d) => d.texte);
    const r = chercherBM25(idx, 'aable');
    expect(r.map((x) => x.item.id).sort()).toEqual(['t1', 't2', 't3']);
  });
});
