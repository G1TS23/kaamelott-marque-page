import { describe, expect, it } from 'vitest';
import { commandePourEpisode } from './lecteur';

describe('commandePourEpisode', () => {
  it('seek quand la cible est déjà réellement chargée (charge: true)', () => {
    expect(commandePourEpisode({ videoId: 'abc', charge: true }, 'abc', 812)).toEqual({
      action: 'seek',
      secondes: 812,
    });
  });

  it("charge quand la cible n'est que mise en attente (charge: false), même vidéo", () => {
    // Le cas trouvé en testant le vrai site : bascule d'onglet (cue) puis clic
    // sur un épisode de ce livre. `seekTo` sur une vidéo jamais réellement
    // chargée fige l'image le temps de bufferiser — il faut charger pour de
    // vrai, pas juste avancer dans du vide.
    expect(commandePourEpisode({ videoId: 'abc', charge: false }, 'abc', 812)).toEqual({
      action: 'charger',
      videoId: 'abc',
      secondes: 812,
    });
  });

  it("charge quand la cible diffère de celle en cours", () => {
    expect(commandePourEpisode({ videoId: 'abc', charge: true }, 'xyz', 812)).toEqual({
      action: 'charger',
      videoId: 'xyz',
      secondes: 812,
    });
  });

  it('charge aussi au tout premier appel, sans état initial', () => {
    expect(commandePourEpisode(null, 'xyz', 0)).toEqual({
      action: 'charger',
      videoId: 'xyz',
      secondes: 0,
    });
  });
});
