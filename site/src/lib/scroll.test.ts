import { describe, expect, it } from 'vitest';
import { scrollerVersLeHaut, type DependancesScroll } from './scroll';

/**
 * Fausses dépendances pilotables à la main (pas de vrai
 * `requestAnimationFrame` à attendre) : `avancer(dt)` fait progresser
 * l'horloge simulée et déclenche la frame en attente, comme le ferait le
 * navigateur — mais de façon synchrone et déterministe.
 */
function creerDependancesSimulees() {
  let temps = 0;
  let enAttente: ((temps: number) => void) | null = null;
  let appelsRaf = 0;
  const positions: number[] = [];

  const deps: DependancesScroll = {
    scrollY: () => 800,
    scrollTo: (_x, y) => positions.push(y),
    reducedMotion: () => false,
    maintenant: () => temps,
    requestAnimationFrame: (callback) => {
      appelsRaf++;
      enAttente = callback;
    },
  };

  return {
    deps,
    positions,
    get appelsRaf() {
      return appelsRaf;
    },
    avancer(dt: number) {
      temps += dt;
      const callback = enAttente;
      enAttente = null;
      callback?.(temps);
    },
  };
}

describe('scrollerVersLeHaut', () => {
  it('ne fait rien si la page est déjà en haut', () => {
    let appelsScrollTo = 0;
    scrollerVersLeHaut(400, {
      scrollY: () => 0,
      scrollTo: () => appelsScrollTo++,
      reducedMotion: () => false,
      maintenant: () => 0,
      requestAnimationFrame: () => {
        throw new Error('ne doit pas être appelé : rien à animer');
      },
    });

    expect(appelsScrollTo).toBe(0);
  });

  it('scrolle directement à 0 sous prefers-reduced-motion, sans animation', () => {
    const appels: number[] = [];
    scrollerVersLeHaut(400, {
      scrollY: () => 800,
      scrollTo: (_x, y) => appels.push(y),
      reducedMotion: () => true,
      maintenant: () => 0,
      requestAnimationFrame: () => {
        throw new Error('ne doit pas être appelé : reduced motion court-circuite l’animation');
      },
    });

    expect(appels).toEqual([0]);
  });

  it('progresse vers 0 de façon monotone et atteint exactement 0 en fin de durée', () => {
    const { deps, positions, avancer } = creerDependancesSimulees();

    scrollerVersLeHaut(400, deps);
    avancer(100);
    avancer(100);
    avancer(100);
    avancer(100); // t = 400 = durée : dernière frame

    expect(positions).toHaveLength(4);
    expect(positions.at(-1)).toBe(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
    }
  });

  it("n'attend plus de nouvelle frame une fois la durée écoulée", () => {
    const simulation = creerDependancesSimulees();

    scrollerVersLeHaut(400, simulation.deps);
    simulation.avancer(100);
    simulation.avancer(100);
    simulation.avancer(100);
    simulation.avancer(400); // largement au-delà de la durée : dernière frame

    // Une frame en attente par appel jusqu'à celle-ci (bug #83 : c'est
    // justement l'absence de nouvelle frame après un gel externe qui
    // laissait le scroll bloqué à mi-chemin) — la dernière ne doit pas en
    // redemander une de plus.
    expect(simulation.appelsRaf).toBe(4);
    simulation.avancer(100); // aucune frame en attente : ne doit rien faire, ne doit pas jeter
    expect(simulation.appelsRaf).toBe(4);
  });
});
