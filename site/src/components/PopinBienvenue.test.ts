// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { cleanup, render, screen } from '@testing-library/svelte';
import PopinBienvenue from './PopinBienvenue.svelte';
import { verifierAccessibilite } from '../test-utils/axe';

const CLE_STOCKAGE = 'marque-page:bienvenue-vue';

beforeEach(() => {
  localStorage.clear();
  // `inert` sur <main> (revue a11y) : le composant cherche ce sélecteur
  // directement sur `document` (îlot client:only, pas d'accès aux props
  // du reste de la page) — un <main> minimal suffit à l'exercer ici.
  document.body.innerHTML = '<main></main>';
});

afterEach(cleanup);

describe('PopinBienvenue', () => {
  it('est visible à la première visite (localStorage vide)', () => {
    render(PopinBienvenue);

    expect(screen.getByRole('dialog', { name: 'Bienvenue' })).toBeTruthy();
  });

  it("n'est plus affichée une fois déjà vue (indicateur localStorage posé)", () => {
    localStorage.setItem(CLE_STOCKAGE, '1');
    render(PopinBienvenue);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("se ferme et pose l'indicateur au clic sur « J'ai compris », jamais sur Échap", async () => {
    render(PopinBienvenue);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(screen.getByRole('dialog')).toBeTruthy(); // Échap ne ferme pas (retour d'usage)

    screen.getByRole('button', { name: "J'ai compris" }).click();
    await tick();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(CLE_STOCKAGE)).toBe('1');
  });

  it('rend <main> inert tant que la popin est affichée, et le libère à la fermeture', async () => {
    render(PopinBienvenue);
    const principal = document.querySelector('main')!;

    expect(principal.inert).toBe(true);

    screen.getByRole('button', { name: "J'ai compris" }).click();
    await tick();

    expect(principal.inert).toBe(false);
  });

  it("ne présente aucune violation d'accessibilité (axe)", async () => {
    const { container } = render(PopinBienvenue);
    expect(await verifierAccessibilite(container)).toEqual([]);
  });
});
