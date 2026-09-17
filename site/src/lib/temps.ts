/**
 * Formatage des positions dans la vidéo.
 *
 * Placé dans `src/lib` plutôt que dans un composant : SonarCloud n'analyse ni
 * les `.svelte` ni les `.astro` (voir README), donc toute logique autre que de
 * l'affichage a intérêt à vivre ici, en TypeScript.
 */

/**
 * `h:mm:ss` — les vidéos font toutes plus de six heures, l'heure est donc
 * toujours pertinente.
 */
export function formaterTemps(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * `m:ss` — position à l'intérieur d'un seul épisode (mini-timeline, issue
 * #56), jamais assez longue pour justifier l'heure comme `formaterTemps`
 * (qui positionne dans toute la vidéo, plusieurs heures).
 */
export function formaterTempsEcoule(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
