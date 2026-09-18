/**
 * Lien profond partageable (issue #21, docs/SPECS.md section 6) :
 * `?livre=1&episode=s1e02` doit ouvrir directement le bon livre, à la
 * bonne seconde. Isolé de Site.svelte : SonarCloud n'analyse pas les
 * `.svelte`, convention déjà suivie pour recherche.ts/timeline.ts.
 *
 * `episode` porte l'`id` de la fiche (ex. `s1e02`), pas le numéro
 * d'épisode seul : un numéro d'épisode n'a de sens que croisé avec son
 * livre, l'`id` est déjà la clé unique du modèle de données (section 4).
 */

import type { EpisodeListe, LivreEnListe, NumeroLivre } from './episodes.ts';

export const PARAM_LIVRE = 'livre';
export const PARAM_EPISODE = 'episode';

export interface CibleLienProfond {
  livre: NumeroLivre;
  episode: EpisodeListe;
}

/**
 * `null` si les paramètres sont absents, ou s'ils ne correspondent à
 * aucun livre/épisode réel (lien mal formé, tronqué, copié-collé
 * incomplet) — jamais d'erreur, le site retombe simplement sur son
 * comportement par défaut (premier livre, rien d'engagé).
 */
export function analyserLienProfond(
  params: URLSearchParams,
  livres: LivreEnListe[],
): CibleLienProfond | null {
  const livreParam = params.get(PARAM_LIVRE);
  const episodeParam = params.get(PARAM_EPISODE);
  if (!livreParam || !episodeParam) return null;

  const numeroLivre = Number(livreParam);
  const livre = livres.find((l) => l.livre === numeroLivre);
  if (!livre) return null;

  const episode = livre.episodes.find((e) => e.id === episodeParam);
  if (!episode) return null;

  return { livre: livre.livre, episode };
}

/** Sens inverse : les paramètres à mettre dans l'URL pour un épisode donné. */
export function parametresLienProfond(livre: NumeroLivre, episode: EpisodeListe): URLSearchParams {
  return new URLSearchParams({ [PARAM_LIVRE]: String(livre), [PARAM_EPISODE]: episode.id });
}
