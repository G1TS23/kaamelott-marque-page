import axe from 'axe-core';

/**
 * Verrouille l'accessibilité déjà en place (issue #108, audit de
 * stabilisation) : beaucoup de travail a11y documenté (issues #19, #54,
 * #55, #77 — rôles de dialogue, `inert`, piège de focus, contraste déjà
 * corrigé une fois...) mais rien ne le garantissait automatiquement contre
 * une régression future.
 *
 * `color-contrast` désactivée : happy-dom ne fait pas de vraie mise en
 * page (tailles de police, empilement des calques), un calcul de contraste
 * y est dénué de sens — le contraste réel des tokens est vérifié à part,
 * sur les valeurs de `tokens.css` elles-mêmes (voir le ticket dédié).
 */
export async function verifierAccessibilite(element: Element): Promise<void> {
  const resultats = await axe.run(element, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  if (resultats.violations.length > 0) {
    const detail = resultats.violations
      .map(
        (v) =>
          `- ${v.id} (${v.impact}) : ${v.description}\n` +
          v.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n'),
      )
      .join('\n');
    throw new Error(`Violations d'accessibilité détectées :\n${detail}`);
  }
}
