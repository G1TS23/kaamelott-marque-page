// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import Site from './Site.svelte';
import type { LivreEnListe } from '../lib/episodes.ts';

/**
 * Reproduit le scénario exact de l'issue #83 (retour d'usage, mobile) :
 * cliquer un épisode pendant que le lecteur est réduit doit ramener
 * `scrollY` à 0 — corrigé trois fois de suite avant `scrollerVersLeHaut()`
 * (voir `../lib/scroll.ts`, testée séparément pour la mécanique
 * d'animation elle-même), sans qu'aucun test ne garde ce comportement.
 *
 * L'API IFrame YouTube réelle (réseau, postMessage) est hors de portée
 * d'un test de composant : une fausse implémentation minimale suffit,
 * `Lecteur.svelte` ne fait qu'exécuter les événements qu'elle reçoit.
 * `IntersectionObserver` est remplacé de même — happy-dom ne fait pas de
 * vraie mise en page, une détection d'intersection réelle n'aurait aucun
 * sens ; on déclenche la callback à la main pour simuler le passage sous
 * le seuil de collage.
 */

const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

class FausseIntersectionObserver {
  static instances: FausseIntersectionObserver[] = [];
  callback: (entrees: { isIntersecting: boolean }[]) => void;
  constructor(callback: (entrees: { isIntersecting: boolean }[]) => void) {
    this.callback = callback;
    FausseIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {}
  declencher(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

class FausseYTPlayer {
  events: { onReady: () => void; onStateChange: (e: { data: number }) => void };
  constructor(_conteneur: unknown, options: { events: FausseYTPlayer['events'] }) {
    this.events = options.events;
    this.events.onReady();
  }
  getCurrentTime() {
    return 0;
  }
  getDuration() {
    return 100;
  }
  getPlayerState() {
    return PlayerState.PLAYING;
  }
  seekTo() {}
  playVideo() {
    this.events.onStateChange({ data: PlayerState.PLAYING });
  }
  pauseVideo() {
    this.events.onStateChange({ data: PlayerState.PAUSED });
  }
  // `allerA` (Site.svelte) appelle `loadVideoById` tant qu'aucune vidéo
  // n'est déjà chargée (`commandePourEpisode`, lib/lecteur.ts) : c'est ce
  // chemin, pas `playVideo`, qui démarre la lecture dans ce scénario.
  loadVideoById() {
    this.events.onStateChange({ data: PlayerState.PLAYING });
  }
  destroy() {}
}

const livres: LivreEnListe[] = [
  {
    livre: 1,
    episodes: [
      { id: 'e1', episode: 1, title: 'Un', start_seconds: 0, video_id: 'vid1' },
      { id: 'e2', episode: 2, title: 'Deux', start_seconds: 100, video_id: 'vid2' },
      { id: 'e3', episode: 3, title: 'Trois', start_seconds: 200, video_id: 'vid3' },
    ],
  },
];

let scrollYActuel = 0;

beforeEach(() => {
  scrollYActuel = 0;
  FausseIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FausseIntersectionObserver);
  vi.stubGlobal('YT', { Player: FausseYTPlayer, PlayerState });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  );
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollYActuel,
  });
  window.scrollTo = vi.fn((_x: number, y: number) => {
    scrollYActuel = y;
  }) as unknown as typeof window.scrollTo;
  // `/recherche.json` (résumés/personnages, hors périmètre de ce test) —
  // sans ce stub, happy-dom tente un vrai appel réseau vers localhost, qui
  // échoue silencieusement (déjà rattrapé par le `.catch()` de Site.svelte)
  // mais pollue la sortie de test avec une trace ECONNREFUSED.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('non simulé dans ce test')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Site — retour en haut au clic d’un épisode (issue #83)', () => {
  it('ramène scrollY à 0 quand on clique un épisode pendant que le lecteur est réduit', async () => {
    const { container } = render(Site, { livres });
    const boutons = () => [...container.querySelectorAll('button.jouer')] as HTMLButtonElement[];

    // Engage une vraie lecture (premier épisode) — sans ça, `reduit` ne
    // passe jamais à vrai (retour d'usage #54 : une simple vignette
    // affichée sans lecture ne doit pas coller le lecteur).
    boutons()[0].click();

    // Simule le passage sous le seuil de collage (scroll réel remplacé par
    // la fausse IntersectionObserver, voir plus haut).
    expect(FausseIntersectionObserver.instances).toHaveLength(1);
    FausseIntersectionObserver.instances[0].declencher(false);

    // Simule une position de scroll existante, comme un vrai usager qui a
    // défilé la liste jusqu'à l'épisode réduit avant de cliquer ailleurs.
    scrollYActuel = 900;

    // Clique un second épisode pendant que le lecteur est réduit — c'est
    // exactement le geste qui déclenchait le bug #83.
    boutons()[2].click();

    // `scrollerVersLeHaut()` anime sur de vraies frames (`requestAnimationFrame`
    // par défaut, pas les fausses dépendances injectables de scroll.test.ts) :
    // laisser tourner l'animation réelle jusqu'à son terme (durée 400ms)
    // plutôt que de la simuler ici, pour rester un test de bout en bout.
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(scrollYActuel).toBe(0);
  });
});
