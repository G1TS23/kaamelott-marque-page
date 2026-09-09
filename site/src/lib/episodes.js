/**
 * Chargement des données d'épisodes au build (issue #13).
 *
 * La source de vérité reste `data/episodes/livre-N.json` à la racine du dépôt,
 * produite par le pipeline Python (milestones 1 à 3) : le site ne duplique pas
 * ces fichiers, il les importe.
 *
 * Imports statiques plutôt que lecture `fs` : Vite les résout au build,
 * relativement à ce fichier source. Une lecture `fs` avec `import.meta.url`
 * casserait, ce module étant bundlé dans `dist/` où le chemin relatif ne
 * pointe plus vers `data/`.
 */

import livre1 from '../../../data/episodes/livre-1.json';
import livre2 from '../../../data/episodes/livre-2.json';
import livre3 from '../../../data/episodes/livre-3.json';
import livre4 from '../../../data/episodes/livre-4.json';

export const LIVRES = [1, 2, 3, 4];

const PAR_LIVRE = { 1: livre1, 2: livre2, 3: livre3, 4: livre4 };

/** Nombre d'épisodes attendu par livre (Wikipédia) — sert de garde-fou. */
const EPISODES_ATTENDUS = { 1: 100, 2: 100, 3: 100, 4: 99 };

/**
 * Épisodes d'un livre, triés par numéro.
 *
 * Échoue au build plutôt que de servir des données incomplètes : un épisode
 * sans `start_seconds` casserait silencieusement la fonction centrale du site
 * (sauter au bon instant), et le pipeline garantit qu'il n'y en a aucun
 * (docs/qc-fusion-timestamps.md).
 */
export function chargerLivre(livre) {
  const episodes = [...PAR_LIVRE[livre]].sort((a, b) => a.episode - b.episode);

  const attendu = EPISODES_ATTENDUS[livre];
  if (episodes.length !== attendu) {
    throw new Error(
      `Livre ${livre} : ${episodes.length} épisodes chargés, ${attendu} attendus.`,
    );
  }

  const sansTimestamp = episodes.filter((e) => typeof e.start_seconds !== 'number');
  if (sansTimestamp.length > 0) {
    throw new Error(
      `Livre ${livre} : ${sansTimestamp.length} épisode(s) sans start_seconds ` +
        `(${sansTimestamp.map((e) => e.episode).join(', ')}). ` +
        `Relancer scripts/merge_timestamps.py.`,
    );
  }

  return episodes;
}

/** Tous les épisodes des 4 livres, à plat. La recherche est globale (specs section 5). */
export function chargerTousLesEpisodes() {
  return LIVRES.flatMap(chargerLivre);
}
