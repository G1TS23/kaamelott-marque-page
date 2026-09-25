import type { Page } from '@playwright/test';

/**
 * Remplace l'API IFrame YouTube par une fausse implémentation entièrement
 * scriptable — même principe que `FausseYTPlayer` dans `Lecteur.test.ts`,
 * transposé aux tests e2e. Évite de dépendre d'une vraie lecture YouTube,
 * bloquée par les politiques d'autoplay des navigateurs automatisés (limite
 * déjà rencontrée et consignée dans `docs/qc-lecteur-collant.md`).
 *
 * Injectée avant tout script de la page (`addInitScript`, à appeler avant
 * `page.goto`) : `Lecteur.svelte` vérifie `window.YT?.Player` avant de
 * charger le script externe `iframe_api` — déjà vrai à ce moment-là, le
 * vrai script n'est donc jamais sollicité.
 *
 * Les instances créées sont exposées sur `window.__lecteursFactices` (un
 * tableau, une seule entrée en pratique — le composant ne construit jamais
 * plus d'un player) pour être pilotées depuis les tests via `page.evaluate`.
 */
export async function installerFausseAPIYoutube(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Popin de première visite (PopinBienvenue.svelte) : hors sujet pour ces
    // tests, et son piège de focus intercepterait tous les clics sinon.
    try {
      localStorage.setItem('marque-page:bienvenue-vue', '1');
    } catch {
      /* pas grave, voir PopinBienvenue.svelte */
    }

    const ETATS = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

    class LecteurFactice {
      videoId: string;
      appelsChargement: Array<{ videoId: string; startSeconds?: number }> = [];
      appelsSeek: number[] = [];
      appelsPlay = 0;
      appelsPause = 0;
      private temps: number;
      private duree = 3600;
      private etat: number = ETATS.UNSTARTED;
      private events: {
        onReady?: (e: { target: LecteurFactice }) => void;
        onStateChange?: (e: { data: number; target: LecteurFactice }) => void;
      };

      constructor(
        _element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: { start?: number };
          events?: LecteurFactice['events'];
        },
      ) {
        this.videoId = options.videoId;
        this.temps = options.playerVars?.start ?? 0;
        this.events = options.events ?? {};
        const w = window as unknown as { __lecteursFactices?: LecteurFactice[] };
        w.__lecteursFactices ??= [];
        w.__lecteursFactices.push(this);
        // Asynchrone comme la vraie API (onReady n'arrive jamais dans le
        // même tick que le constructeur).
        setTimeout(() => this.events.onReady?.({ target: this }), 0);
      }

      seekTo(secondes: number): void {
        this.appelsSeek.push(secondes);
        this.temps = secondes;
      }

      playVideo(): void {
        this.appelsPlay++;
        this.passerA(ETATS.PLAYING);
      }

      pauseVideo(): void {
        this.appelsPause++;
        this.passerA(ETATS.PAUSED);
      }

      loadVideoById(options: { videoId: string; startSeconds?: number }): void {
        this.appelsChargement.push(options);
        this.videoId = options.videoId;
        this.temps = options.startSeconds ?? 0;
        // Documenté dans l'API IFrame : charge *et* lance la lecture.
        this.passerA(ETATS.PLAYING);
      }

      getCurrentTime(): number {
        return this.temps;
      }

      getDuration(): number {
        return this.duree;
      }

      getPlayerState(): number {
        return this.etat;
      }

      destroy(): void {}

      private passerA(etat: number): void {
        this.etat = etat;
        this.events.onStateChange?.({ data: etat, target: this });
      }
    }

    (window as unknown as { YT: unknown }).YT = { Player: LecteurFactice, PlayerState: ETATS };
  });
}
