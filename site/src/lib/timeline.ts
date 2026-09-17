/**
 * Calculs purs pour la mini-timeline bornée à l'épisode en cours (issue
 * #56) : bornes de l'épisode dans la vidéo complète, conversion position
 * ↔ ratio pour dessiner la barre et interpréter un clic/glisser dessus.
 * Isolé de MiniTimeline.svelte : SonarCloud n'analyse pas les `.svelte`
 * (convention déjà suivie pour recherche.ts/lecteur.ts).
 */

export interface BornesEpisode {
  basse: number;
  haute: number;
}

/**
 * Bornes de l'épisode `indexCourant` dans une liste triée par
 * `start_seconds` croissant (convention de `chargerLivre`, déjà garantie
 * pour `episodeEnCoursDetails` dans Site.svelte) : la borne haute est le
 * début de l'épisode suivant, ou la durée de la vidéo pour le dernier
 * épisode du livre — `dureeVideo` vaut 0 tant que `getDuration()` n'a pas
 * encore résolu de valeur utile (juste après le montage du lecteur), la
 * timeline reste alors simplement plate le temps que la vraie durée
 * arrive au sondage suivant.
 */
export function bornesEpisode(
  episodes: { start_seconds: number }[],
  indexCourant: number,
  dureeVideo: number,
): BornesEpisode {
  const basse = episodes[indexCourant]?.start_seconds ?? 0;
  const suivant = episodes[indexCourant + 1];
  const haute = suivant ? suivant.start_seconds : dureeVideo;
  return { basse, haute };
}

/**
 * Position dans la vidéo → ratio [0, 1] à l'intérieur des bornes de
 * l'épisode. Borné même en cas de léger dépassement (l'épisode suivant pas
 * encore détecté par le sondage de position) ou de bornes pas encore
 * connues (`haute <= basse`, ex. durée pas encore résolue).
 */
export function ratioDepuisSecondes(secondes: number, { basse, haute }: BornesEpisode): number {
  if (haute <= basse) return 0;
  return Math.min(1, Math.max(0, (secondes - basse) / (haute - basse)));
}

/**
 * Sens inverse : ratio [0, 1] (clic/glisser sur la barre) → position dans
 * la vidéo, toujours à l'intérieur des bornes de l'épisode — impossible de
 * glisser jusque dans l'épisode suivant par ce geste (comportement voulu,
 * voir l'issue).
 */
export function secondesDepuisRatio(ratio: number, { basse, haute }: BornesEpisode): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return basse + clamped * (haute - basse);
}
