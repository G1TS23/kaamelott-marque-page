// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import PanneauMentionsLegales from './PanneauMentionsLegales.svelte';
import { verifierAccessibilite } from '../test-utils/axe';

afterEach(cleanup);

describe('PanneauMentionsLegales', () => {
  it('affiche le dialogue et y place le focus (sur le bouton fermer) à l’ouverture', () => {
    render(PanneauMentionsLegales, { onFermer: vi.fn() });

    expect(screen.getByRole('dialog', { name: 'Mentions légales' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }));
  });

  it('appelle onFermer sur Échap', () => {
    const onFermer = vi.fn();
    render(PanneauMentionsLegales, { onFermer });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onFermer).toHaveBeenCalledOnce();
  });

  it('appelle onFermer au clic sur le bouton fermer', () => {
    const onFermer = vi.fn();
    render(PanneauMentionsLegales, { onFermer });

    screen.getByRole('button', { name: 'Fermer' }).click();

    expect(onFermer).toHaveBeenCalledOnce();
  });

  it('appelle onFermer au clic sur le fond, mais pas au clic à l’intérieur du panneau', () => {
    const onFermer = vi.fn();
    const { container } = render(PanneauMentionsLegales, { onFermer });

    // Clic à l'intérieur : `stopPropagation` doit empêcher qu'il remonte
    // jusqu'au fond cliquable.
    screen.getByRole('dialog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFermer).not.toHaveBeenCalled();

    container.querySelector('.fond')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFermer).toHaveBeenCalledOnce();
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(PanneauMentionsLegales, { onFermer: vi.fn() });
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
