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
 *
 * Retourne la liste des violations plutôt que de lancer directement
 * (retour d'usage, Sonar S2699 : un test qui ne contient aucun `expect`
 * explicite — même s'il peut échouer via une exception — est signalé
 * comme dépourvu d'assertion). Chaque appelant fait
 * `expect(await verifierAccessibilite(container)).toEqual([])`, ce qui
 * donne au passage un diff lisible (une ligne par violation) en cas
 * d'échec plutôt qu'un simple message d'erreur.
 */
export async function verifierAccessibilite(element: Element): Promise<string[]> {
  const resultats = await axe.run(element, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  return resultats.violations.map(
    (v) =>
      `${v.id} (${v.impact}) : ${v.description} — ${v.nodes
        .map((n) => n.target.join(' '))
        .join(', ')}`,
  );
}
