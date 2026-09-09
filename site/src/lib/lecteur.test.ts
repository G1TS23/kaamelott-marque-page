import { describe, expect, it } from 'vitest';
import { commandePourEpisode } from './lecteur';

describe('commandePourEpisode', () => {
  it('reste sur la vidéo courante : seek quand la cible est déjà chargée', () => {
    expect(commandePourEpisode('abc', 'abc', 812)).toEqual({ action: 'seek', secondes: 812 });
  });

  it("charge la nouvelle vidéo quand la cible diffère de celle en cours", () => {
    expect(commandePourEpisode('abc', 'xyz', 812)).toEqual({
      action: 'charger',
      videoId: 'xyz',
      secondes: 812,
    });
  });

  it('charge aussi au tout premier appel, sans vidéo encore chargée', () => {
    expect(commandePourEpisode(null, 'xyz', 0)).toEqual({
      action: 'charger',
      videoId: 'xyz',
      secondes: 0,
    });
  });
});
