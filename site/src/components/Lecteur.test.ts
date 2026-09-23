// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { cleanup, render } from '@testing-library/svelte';
import Lecteur from './Lecteur.svelte';

/**
 * `Lecteur.svelte` (issue #89, audit de stabilisation) porte 8 commentaires
 * "retour d'usage" documentant des bugs déjà corrigés (autoplay bloqué,
 * overlay de chargement resté affiché, arrondi de `start_seconds`…), sans
 * aucun test. L'API IFrame réelle (réseau, postMessage) est hors de portée
 * d'un test de composant : ce faux `YT.Player` capture les méthodes
 * appelées et permet de déclencher `onStateChange`/`onReady` à la main,
 * exactement ce que fait `Site.test.ts` (#87) pour son propre scénario —
 * dupliqué ici en plus détaillé (suivi individuel des appels) plutôt que
 * partagé, les deux tests n'ayant pas besoin du même niveau de détail.
 */

const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

class FausseYTPlayer {
  static derniere: FausseYTPlayer;
  events: { onReady: () => void; onStateChange: (e: { data: number }) => void };
  seekToAppels: [number, boolean][] = [];
  loadVideoByIdAppels: { videoId: string; startSeconds: number }[] = [];
  playVideoAppels = 0;
  pauseVideoAppels = 0;
  etatCourant = PlayerState.UNSTARTED;

  constructor(_conteneur: unknown, options: { events: FausseYTPlayer['events'] }) {
    this.events = options.events;
    FausseYTPlayer.derniere = this;
  }
  getCurrentTime() {
    return 42;
  }
  getDuration() {
    return 1000;
  }
  getPlayerState() {
    return this.etatCourant;
  }
  seekTo(secondes: number, allerAussitot: boolean) {
    this.seekToAppels.push([secondes, allerAussitot]);
  }
  playVideo() {
    this.playVideoAppels++;
  }
  pauseVideo() {
    this.pauseVideoAppels++;
  }
  loadVideoById(options: { videoId: string; startSeconds: number }) {
    this.loadVideoByIdAppels.push(options);
  }
  destroy() {}

  /** Simule l'API IFrame notifiant un changement d'état. */
  emettreEtat(data: number) {
    this.etatCourant = data;
    this.events.onStateChange({ data });
  }
}

beforeEach(() => {
  vi.stubGlobal('YT', { Player: FausseYTPlayer, PlayerState });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface PropsLecteur {
  videoIdInitial: string;
  reduit: boolean;
  onChangementEngagement: (engagee: boolean) => void;
  onLectureChange: (enLecture: boolean) => void;
  onProgression: (secondes: number, duree: number) => void;
  secondesInitiales?: number;
  lireAuDemarrage?: boolean;
}

function props(overrides: Partial<PropsLecteur> = {}): PropsLecteur {
  return {
    videoIdInitial: 'vid1',
    reduit: false,
    onChangementEngagement: vi.fn(),
    onLectureChange: vi.fn(),
    onProgression: vi.fn(),
    ...overrides,
  };
}

describe('Lecteur', () => {
  it("affiche l'overlay de chargement seulement pendant BUFFERING", async () => {
    const { container } = render(Lecteur, props());
    FausseYTPlayer.derniere.events.onReady();

    expect(container.querySelector('.chargement')).toBeNull();

    FausseYTPlayer.derniere.emettreEtat(PlayerState.BUFFERING);
    await tick();
    expect(container.querySelector('.chargement')).not.toBeNull();

    FausseYTPlayer.derniere.emettreEtat(PlayerState.PLAYING);
    await tick();
    expect(container.querySelector('.chargement')).toBeNull();
  });

  it('bascule la classe CSS .reduit avec la prop reduit', async () => {
    const { container, rerender } = render(Lecteur, props({ reduit: false }));
    expect(container.querySelector('.cadre.reduit')).toBeNull();

    await rerender(props({ reduit: true }));
    expect(container.querySelector('.cadre.reduit')).not.toBeNull();
  });

  it('signale l’engagement sur PLAYING/PAUSED/BUFFERING, jamais sur UNSTARTED/CUED intercalés, et le retire sur ENDED', () => {
    const onChangementEngagement = vi.fn();
    const onLectureChange = vi.fn();
    render(Lecteur, props({ onChangementEngagement, onLectureChange }));
    FausseYTPlayer.derniere.events.onReady();

    FausseYTPlayer.derniere.emettreEtat(PlayerState.PLAYING);
    expect(onChangementEngagement).toHaveBeenLastCalledWith(true);
    expect(onLectureChange).toHaveBeenLastCalledWith(true);

    FausseYTPlayer.derniere.emettreEtat(PlayerState.PAUSED);
    expect(onChangementEngagement).toHaveBeenLastCalledWith(true); // toujours engagée
    expect(onLectureChange).toHaveBeenLastCalledWith(false); // mais plus en lecture

    const appelsAvant = onChangementEngagement.mock.calls.length;
    FausseYTPlayer.derniere.emettreEtat(PlayerState.UNSTARTED);
    FausseYTPlayer.derniere.emettreEtat(PlayerState.CUED);
    // Retour d'usage (voir la note `engage` du composant) : ignorés, ne
    // doivent déclencher aucun nouvel appel — sans quoi le repère et la
    // mini-timeline clignoteraient à chaque réapparition transitoire.
    expect(onChangementEngagement.mock.calls.length).toBe(appelsAvant);

    FausseYTPlayer.derniere.emettreEtat(PlayerState.ENDED);
    expect(onChangementEngagement).toHaveBeenLastCalledWith(false);
    expect(onLectureChange).toHaveBeenLastCalledWith(false);
  });

  it('allerA cherche (seek) dans la même vidéo déjà chargée plutôt que de la recharger', () => {
    // `bind:this` n'existe pas hors d'un composant Svelte parent : l'instance
    // exportée s'obtient via `component`, retourné par `render`
    // (@testing-library/svelte).
    const { component } = render(Lecteur, props());
    FausseYTPlayer.derniere.events.onReady();

    // Le constructeur ne fait que « cuer » la vidéo (retour d'usage, voir
    // le commentaire du script sur `charge: false`) — seul un premier
    // `allerA` marque la vidéo comme réellement chargée (`etat.charge`,
    // lib/lecteur.ts). Sans cet appel initial, `commandePourEpisode`
    // traiterait le second `allerA` comme « en attente, pas chargée » et
    // choisirait `load`, pas `seek`, même vidéo identique.
    (component as any).allerA('vid1', 10);
    (component as any).allerA('vid1', 120);

    expect(FausseYTPlayer.derniere.seekToAppels).toEqual([[120, true]]);
    expect(FausseYTPlayer.derniere.loadVideoByIdAppels).toEqual([{ videoId: 'vid1', startSeconds: 10 }]);
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(1); // relance après le seek
  });

  it('allerA charge (load) une vidéo différente', () => {
    const { component } = render(Lecteur, props());
    FausseYTPlayer.derniere.events.onReady();
    FausseYTPlayer.derniere.emettreEtat(PlayerState.PLAYING);

    (component as any).allerA('vid2', 30);

    expect(FausseYTPlayer.derniere.loadVideoByIdAppels).toEqual([{ videoId: 'vid2', startSeconds: 30 }]);
    expect(FausseYTPlayer.derniere.seekToAppels).toEqual([]);
  });

  it('basculerLecture met en pause pendant la lecture, relance sinon', () => {
    const { component } = render(Lecteur, props());
    FausseYTPlayer.derniere.events.onReady();

    FausseYTPlayer.derniere.etatCourant = PlayerState.PLAYING;
    (component as any).basculerLecture();
    expect(FausseYTPlayer.derniere.pauseVideoAppels).toBe(1);

    FausseYTPlayer.derniere.etatCourant = PlayerState.PAUSED;
    (component as any).basculerLecture();
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(1);
  });
});
