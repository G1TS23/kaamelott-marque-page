// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import MiniTimeline from './MiniTimeline.svelte';
import type { BornesEpisode } from '../lib/timeline.ts';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

const bornes: BornesEpisode = { basse: 100, haute: 200 };

function props(overrides: Partial<{ bornes: BornesEpisode; position: number; onSeek: (s: number) => void }> = {}) {
  return {
    bornes,
    position: 150,
    onSeek: vi.fn(),
    ...overrides,
  };
}

describe('MiniTimeline', () => {
  it('expose la position courante via role=slider et ses aria-value*', () => {
    render(MiniTimeline, props({ position: 150 }));

    const curseur = screen.getByRole('slider');
    expect(curseur.getAttribute('aria-valuemin')).toBe('0');
    expect(curseur.getAttribute('aria-valuemax')).toBe('100'); // haute - basse
    expect(curseur.getAttribute('aria-valuenow')).toBe('50'); // position - basse
  });

  it('les flèches avancent/reculent de 5s, bornées à l’épisode', () => {
    const onSeek = vi.fn();
    render(MiniTimeline, props({ position: 150, onSeek }));
    const curseur = screen.getByRole('slider');

    curseur.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(155);

    curseur.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(145);
  });

  it('ne dépasse pas la borne haute avec la flèche droite', () => {
    const onSeek = vi.fn();
    render(MiniTimeline, props({ position: 199, onSeek }));
    screen
      .getByRole('slider')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(200); // pas 204
  });

  it('ne dépasse pas la borne basse avec la flèche gauche', () => {
    const onSeek = vi.fn();
    render(MiniTimeline, props({ position: 101, onSeek }));
    screen
      .getByRole('slider')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(100); // pas 96
  });

  it('Home/End sautent directement aux bornes', () => {
    const onSeek = vi.fn();
    render(MiniTimeline, props({ position: 150, onSeek }));
    const curseur = screen.getByRole('slider');

    curseur.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(100);

    curseur.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(onSeek).toHaveBeenLastCalledWith(200);
  });

  it('un clic sur la barre cherche la position proportionnelle au point cliqué', () => {
    const onSeek = vi.fn();
    render(MiniTimeline, props({ position: 150, onSeek }));
    const curseur = screen.getByRole('slider');

    // happy-dom ne fait pas de vraie mise en page : getBoundingClientRect
    // simulé pour donner un sens géométrique au clic (retour d'usage, même
    // raisonnement que pour IntersectionObserver dans Site.test.ts).
    curseur.getBoundingClientRect = () =>
      ({ left: 0, width: 200 }) as DOMRect;

    curseur.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 50, bubbles: true }),
    );

    expect(onSeek).toHaveBeenCalledWith(100 + 0.25 * 100); // 25% de la barre
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(MiniTimeline, props());
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
