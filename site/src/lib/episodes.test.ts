import { describe, expect, it } from 'vitest';

import { LIVRES, chargerLivre, chargerTousLesEpisodes } from './episodes.ts';

/**
 * Ces tests portent sur les **vraies** données du pipeline, pas sur des
 * fixtures : ils doublent volontairement des garde-fous déjà présents côté
 * Python, mais au point de consommation. Une régénération de données qui
 * casserait le site échouerait ici, en CI, plutôt qu'en production.
 */

const EPISODES_ATTENDUS: Record<number, number> = { 1: 100, 2: 100, 3: 100, 4: 99 };

describe('chargerLivre', () => {
  it.each(LIVRES)('livre %i a son compte d’épisodes', (livre) => {
    expect(chargerLivre(livre)).toHaveLength(EPISODES_ATTENDUS[livre]);
  });

  it.each(LIVRES)('livre %i est numéroté de 1 à N sans trou', (livre) => {
    const numeros = chargerLivre(livre).map((e) => e.episode);
    expect(numeros).toEqual(
      Array.from({ length: EPISODES_ATTENDUS[livre] }, (_, i) => i + 1),
    );
  });

  it.each(LIVRES)('livre %i a un timestamp exploitable partout', (livre) => {
    for (const episode of chargerLivre(livre)) {
      expect(Number.isFinite(episode.start_seconds)).toBe(true);
      expect(episode.start_seconds).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(LIVRES)(
    'livre %i a des timestamps croissants avec le numéro d’épisode',
    (livre) => {
      // Une inversion signalerait un pointage ou une résolution erronée :
      // l'épisode 12 commencerait après le 13 dans la vidéo.
      const episodes = chargerLivre(livre);
      const inversions = episodes
        .slice(1)
        .map((e, i) => [episodes[i], e] as const)
        .filter(([precedent, suivant]) => suivant.start_seconds <= precedent.start_seconds)
        .map(([precedent, suivant]) => `${precedent.episode}->${suivant.episode}`);
      expect(inversions).toEqual([]);
    },
  );

  it.each(LIVRES)('livre %i pointe vers une seule vidéo', (livre) => {
    const videos = new Set(chargerLivre(livre).map((e) => e.video_id));
    expect(videos.size).toBe(1);
  });
});

describe('chargerTousLesEpisodes', () => {
  it('couvre les 399 épisodes des quatre livres', () => {
    expect(chargerTousLesEpisodes()).toHaveLength(399);
  });

  it('donne un identifiant unique à chaque épisode', () => {
    const episodes = chargerTousLesEpisodes();
    expect(new Set(episodes.map((e) => e.id)).size).toBe(episodes.length);
  });

  it('ne laisse aucun épisode marqué à repointer', () => {
    // Les 30 derniers cas incertains du Livre 4 ont été vérifiés un par un
    // par visionnage (issue #12) : plus rien ne doit être en attente.
    const aRepointer = chargerTousLesEpisodes().filter(
      (e) => e.confidence !== 'confirmé',
    );
    expect(aRepointer).toEqual([]);
  });
});
