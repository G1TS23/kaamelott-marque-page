/**
 * Décide quoi faire du lecteur YouTube face à une navigation (issue #14,
 * docs/SPECS.md section 6).
 *
 * Séparé de `Lecteur.svelte` : c'est la seule vraie décision de ce
 * composant (rester sur la vidéo courante ou en charger une autre), et
 * SonarCloud n'analyse pas les `.svelte` — la logique qui mérite d'être
 * testée reste ici, le composant ne fait que l'exécuter contre l'API
 * YouTube.
 */

export type CommandeLecteur =
  | { action: 'seek'; secondes: number }
  | { action: 'charger'; videoId: string; secondes: number };

/**
 * Un seul lecteur pour tout le site : cliquer un épisode du livre déjà
 * affiché ne fait qu'avancer dans la même vidéo (`seekTo`) ; cliquer un
 * épisode d'un autre livre (résultat de recherche cross-livre, #18, ou
 * bascule d'onglet suivie d'un clic) charge la nouvelle vidéo directement
 * à la bonne position — jamais de rechargement de page.
 */
export function commandePourEpisode(
  videoIdCharge: string | null,
  videoIdCible: string,
  secondes: number,
): CommandeLecteur {
  if (videoIdCharge === videoIdCible) {
    return { action: 'seek', secondes };
  }
  return { action: 'charger', videoId: videoIdCible, secondes };
}
