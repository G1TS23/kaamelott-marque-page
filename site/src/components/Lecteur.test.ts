// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import Lecteur from './Lecteur.svelte';
import { verifierAccessibilite } from '../test-utils/axe';

/**
 * `Lecteur.svelte` (issue #89, audit de stabilisation) porte 8 commentaires
 * "retour d'usage" documentant des bugs déjà corrigés (autoplay bloqué,
 * overlay de chargement resté affiché, arrondi de `start_seconds`…), sans
 * aucun test. L'API IFrame réelle (réseau, postMessage) est hors de portée
 * d'un test de composant : ce faux `YT.Player` capture les méthodes
 * appelées (et depuis l'issue 119, les arguments du constructeur aussi —
 * `videoId`/`start`, nécessaires pour vérifier que la facade construit
 * directement sur la bonne vidéo) et permet de déclencher
 * `onStateChange`/`onReady` à la main.
 *
 * Facade (issue 119) : par défaut (pas de lien profond), le lecteur
 * n'existe pas tant que la facade n'a pas été quittée — les tests qui
 * portent sur le lecteur déjà engagé passent `lireAuDemarrage: true` pour
 * la sauter, comme le ferait un vrai lien profond (issue #21).
 */

const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

class FausseYTPlayer {
  static derniere: FausseYTPlayer;
  static appelsConstructeur = 0;
  events: { onReady: () => void; onStateChange: (e: { data: number }) => void };
  videoId: string;
  start: number;
  seekToAppels: [number, boolean][] = [];
  loadVideoByIdAppels: { videoId: string; startSeconds: number }[] = [];
  playVideoAppels = 0;
  pauseVideoAppels = 0;
  etatCourant = PlayerState.UNSTARTED;

  constructor(
    _conteneur: unknown,
    options: {
      videoId: string;
      playerVars: { start: number };
      events: FausseYTPlayer['events'];
    },
  ) {
    this.events = options.events;
    this.videoId = options.videoId;
    this.start = options.playerVars.start;
    FausseYTPlayer.derniere = this;
    FausseYTPlayer.appelsConstructeur++;
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
  FausseYTPlayer.appelsConstructeur = 0;
  vi.stubGlobal('YT', { Player: FausseYTPlayer, PlayerState });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface PropsLecteur {
  videoIdInitial: string;
  reduit: boolean;
  titre?: string;
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

describe('Lecteur — facade (issue 119)', () => {
  it("affiche une facade (miniature + bouton lecture) tant qu'aucune lecture n'a été demandée, sans construire de lecteur", () => {
    const { container } = render(Lecteur, props({ videoIdInitial: 'vidABC', titre: 'Un épisode' }));

    expect(FausseYTPlayer.appelsConstructeur).toBe(0);
    expect(screen.getByRole('button', { name: 'Lire Un épisode' })).toBeTruthy();
    // `maxresdefault` d'abord (retour d'usage : `hqdefault` pixelisait une
    // fois étiré) — voir le test suivant pour le repli.
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://i.ytimg.com/vi/vidABC/maxresdefault.jpg',
    );
  });

  it("retombe sur hqdefault.jpg si maxresdefault.jpg n'existe pas pour cette vidéo", async () => {
    const { container } = render(Lecteur, props({ videoIdInitial: 'vidSansHD' }));
    const img = container.querySelector('img')!;

    img.dispatchEvent(new Event('error'));
    await tick();

    expect(img.getAttribute('src')).toBe('https://i.ytimg.com/vi/vidSansHD/hqdefault.jpg');
  });

  it('lien profond (lireAuDemarrage) : construit le lecteur immédiatement, sans jamais afficher la facade', () => {
    render(Lecteur, props({ videoIdInitial: 'vid1', secondesInitiales: 42, lireAuDemarrage: true }));

    expect(FausseYTPlayer.appelsConstructeur).toBe(1);
    expect(FausseYTPlayer.derniere.videoId).toBe('vid1');
    expect(FausseYTPlayer.derniere.start).toBe(42);
    expect(screen.queryByRole('button', { name: /^Lire/ })).toBeNull();
  });

  it('clic sur la facade construit le lecteur sur la vidéo affichée et lance la lecture', async () => {
    render(Lecteur, props({ videoIdInitial: 'vid1' }));

    screen.getByRole('button', { name: /^Lire/ }).click();
    // La création du lecteur passe par l'effet réactif sur `demarre`, pas
    // synchrone avec le clic — un `tick()` laisse Svelte le flusher.
    await tick();

    expect(FausseYTPlayer.appelsConstructeur).toBe(1);
    expect(FausseYTPlayer.derniere.videoId).toBe('vid1');
    FausseYTPlayer.derniere.events.onReady();
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(1);
  });

  it("cliquer un épisode différent avant d'avoir jamais quitté la facade construit directement sur cette vidéo (pas de loadVideoById superflu)", async () => {
    const { component } = render(Lecteur, props({ videoIdInitial: 'vid1' }));

    (component as any).allerA('vid2', 77);
    await tick();

    expect(FausseYTPlayer.appelsConstructeur).toBe(1);
    expect(FausseYTPlayer.derniere.videoId).toBe('vid2');
    expect(FausseYTPlayer.derniere.start).toBe(77);
    FausseYTPlayer.derniere.events.onReady();
    expect(FausseYTPlayer.derniere.loadVideoByIdAppels).toEqual([]); // construit directement, pas rechargé
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(1);
  });

  it("cliquer lecture sur les contrôles de transport avant d'avoir jamais quitté la facade démarre la vidéo déjà affichée", async () => {
    const { component } = render(Lecteur, props({ videoIdInitial: 'vid1', secondesInitiales: 5 }));

    (component as any).basculerLecture();
    await tick();

    expect(FausseYTPlayer.appelsConstructeur).toBe(1);
    expect(FausseYTPlayer.derniere.videoId).toBe('vid1');
    FausseYTPlayer.derniere.events.onReady();
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(1);
  });
});

describe('Lecteur', () => {
  it("affiche l'overlay de chargement seulement pendant BUFFERING", async () => {
    const { container } = render(Lecteur, props({ lireAuDemarrage: true }));
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
    const { container, rerender } = render(Lecteur, props({ reduit: false, lireAuDemarrage: true }));
    expect(container.querySelector('.cadre.reduit')).toBeNull();

    await rerender(props({ reduit: true, lireAuDemarrage: true }));
    expect(container.querySelector('.cadre.reduit')).not.toBeNull();
  });

  it('signale l’engagement sur PLAYING/PAUSED/BUFFERING, jamais sur UNSTARTED/CUED intercalés, et le retire sur ENDED', () => {
    const onChangementEngagement = vi.fn();
    const onLectureChange = vi.fn();
    render(Lecteur, props({ onChangementEngagement, onLectureChange, lireAuDemarrage: true }));
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
    expect(onChangementEngagement.mock.calls).toHaveLength(appelsAvant);

    FausseYTPlayer.derniere.emettreEtat(PlayerState.ENDED);
    expect(onChangementEngagement).toHaveBeenLastCalledWith(false);
    expect(onLectureChange).toHaveBeenLastCalledWith(false);
  });

  it('allerA cherche (seek) dans la même vidéo déjà chargée plutôt que de la recharger', () => {
    // `bind:this` n'existe pas hors d'un composant Svelte parent : l'instance
    // exportée s'obtient via `component`, retourné par `render`
    // (@testing-library/svelte).
    const { component } = render(Lecteur, props({ lireAuDemarrage: true }));
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
    // 2, pas 1 : `lireAuDemarrage: true` (facade sautée) déclenche déjà un
    // premier `playVideo()` dans `onReady`, avant même ces deux `allerA` —
    // le second (`seek`) en relance un deuxième.
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(2);
  });

  it('allerA charge (load) une vidéo différente', () => {
    const { component } = render(Lecteur, props({ lireAuDemarrage: true }));
    FausseYTPlayer.derniere.events.onReady();
    FausseYTPlayer.derniere.emettreEtat(PlayerState.PLAYING);

    (component as any).allerA('vid2', 30);

    expect(FausseYTPlayer.derniere.loadVideoByIdAppels).toEqual([{ videoId: 'vid2', startSeconds: 30 }]);
    expect(FausseYTPlayer.derniere.seekToAppels).toEqual([]);
  });

  it('basculerLecture met en pause pendant la lecture, relance sinon', () => {
    const { component } = render(Lecteur, props({ lireAuDemarrage: true }));
    FausseYTPlayer.derniere.events.onReady();

    FausseYTPlayer.derniere.etatCourant = PlayerState.PLAYING;
    (component as any).basculerLecture();
    expect(FausseYTPlayer.derniere.pauseVideoAppels).toBe(1);

    FausseYTPlayer.derniere.etatCourant = PlayerState.PAUSED;
    (component as any).basculerLecture();
    // 2, pas 1 : `lireAuDemarrage: true` (facade sautée) a déjà déclenché
    // un premier `playVideo()` dans `onReady`.
    expect(FausseYTPlayer.derniere.playVideoAppels).toBe(2);
  });

  it("ne présente aucune violation d'accessibilité (axe) — facade", async () => {
    const { container } = render(Lecteur, props());
    expect(await verifierAccessibilite(container)).toEqual([]);
  });

  it("ne présente aucune violation d'accessibilité (axe) — lecteur engagé", async () => {
    const { container } = render(Lecteur, props({ lireAuDemarrage: true }));
    FausseYTPlayer.derniere.events.onReady();
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
