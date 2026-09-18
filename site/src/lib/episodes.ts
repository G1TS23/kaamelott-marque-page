/**
 * Chargement et typage des données d'épisodes au build (issue #13).
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

/** Comment le timestamp de début a été obtenu (docs/SPECS.md section 4). */
export type SourceTimestamp = 'jingle' | 'jingle_verifie' | 'manuel';

/** Confiance dans le timestamp. Aucun épisode n'est en `à repointer` à ce jour. */
export type Confiance = 'confirmé' | 'à repointer';

/** Origine de la liste `characters` (docs/SPECS.md section 4, issue #24). */
export type SourcePersonnages = 'fandom' | 'heuristic';

/** Une fiche épisode, telle que produite par le pipeline. */
export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  summary: string;
  channel: string;
  director: string;
  writer: string;
  guests: string[];
  characters: string[];
  characters_source: SourcePersonnages;
  video_id: string;
  /** Position du début de l'épisode dans la vidéo du livre, en secondes. */
  start_seconds: number;
  timestamp_source: SourceTimestamp;
  confidence: Confiance;
}

export type NumeroLivre = 1 | 2 | 3 | 4;

export const LIVRES: NumeroLivre[] = [1, 2, 3, 4];

/**
 * Ce qu'il faut d'un épisode pour l'afficher en liste.
 *
 * Les fiches complètes pèsent ~300 Ko avec les résumés : elles ne sont
 * sérialisées dans le HTML que quand un îlot en a réellement besoin
 * (la recherche, #15/#16). Ce type rend ce choix explicite plutôt
 * qu'implicite dans le code de la page. `id` est inclus (coût négligeable,
 * une courte chaîne) : c'est la clé qui permet de recoller les données de
 * recherche chargées à part (`DonneesRecherche`, `/recherche.json`) sans
 * dépendre d'une coïncidence numérique entre `season` et le numéro de livre.
 */
export type EpisodeListe = Pick<
  Episode,
  'id' | 'episode' | 'title' | 'start_seconds' | 'video_id'
>;

/**
 * Résumé, personnages et générique, chargés à part de `EpisodeListe`
 * (issue #16) : nécessaires à la recherche par résumé/personnage, mais trop
 * lourds (~300 Ko de résumés) pour entrer dans le HTML initial. Servi par
 * `site/src/pages/recherche.json.ts`, récupéré une fois côté client au
 * montage de l'îlot.
 *
 * `channel`/`director`/`writer`/`guests` (issue #55) n'entrent dans aucun
 * calcul de pertinence (seuls `summary`/`characters` alimentent la
 * recherche, docs/SPECS.md section 5) — regroupés ici quand même plutôt que
 * via une source à part : ce sont les mêmes champs Wikipédia « gratuits »
 * que résumé/personnages (capturés à l'import, jamais recherchés), et une
 * deuxième requête juste pour ce générique dupliquerait le mécanisme de
 * fetch-une-fois-au-montage déjà en place ici pour un gain minime.
 */
export interface DonneesRecherche {
  id: string;
  summary: string;
  characters: string[];
  channel: string;
  director: string;
  writer: string;
  guests: string[];
}

/** Un livre et ses épisodes, tels que reçus par l'îlot de navigation. */
export interface LivreEnListe {
  livre: NumeroLivre;
  episodes: EpisodeListe[];
}

/**
 * Un épisode sorti de son livre : la recherche est globale aux 4 livres
 * (specs section 5), chaque résultat doit donc porter son numéro de livre
 * pour l'étiqueter et savoir quelle vidéo charger.
 */
export type EpisodeAvecLivre = EpisodeListe & { livre: NumeroLivre };

/** Aplati les 4 livres en une seule liste, chaque épisode gardant son livre. */
export function aplatir(livres: LivreEnListe[]): EpisodeAvecLivre[] {
  return livres.flatMap((l) => l.episodes.map((e) => ({ ...e, livre: l.livre })));
}

/**
 * `true` pour l'intro synthétique ajoutée par `avecIntro` ci-dessous — pas
 * un vrai épisode numéroté (issue #71). `episode === 0` plutôt que de tester
 * l'`id` : c'est la même valeur que celle posée par `introDuLivre`, et le
 * marqueur naturel vu que les vrais épisodes commencent à 1 sans trou
 * (garanti par `chargerLivre`).
 */
export function estIntro(episode: Pick<EpisodeListe, 'episode'>): boolean {
  return episode.episode === 0;
}

/**
 * Épisode synthétique représentant l'intro d'un livre — la portion de la
 * vidéo avant le premier épisode réel (issue #71). Comble un trou identifié
 * à l'usage : avant qu'une vidéo soit réellement engagée, `tempsCourant`
 * (`Site.svelte`) n'a par défaut aucun épisode courant à résoudre (position
 * 0, avant le `start_seconds` du premier épisode) — la ligne d'info sous le
 * lecteur et la mise en évidence du sommaire n'apparaissaient qu'après coup,
 * une fois une lecture engagée pour de vrai.
 *
 * Générée ici plutôt que stockée dans `data/episodes/livre-N.json` : entièrement
 * dérivable du premier épisode réel, la dupliquer en JSON risquerait de s'en
 * désynchroniser silencieusement à une future ré-génération des données.
 */
export function introDuLivre(livre: NumeroLivre, premierEpisode: EpisodeListe): EpisodeListe {
  return {
    id: `s${livre}e00`,
    episode: 0,
    title: 'Intro',
    start_seconds: 0,
    video_id: premierEpisode.video_id,
  };
}

/**
 * Préfixe la liste (déjà triée) des épisodes d'un livre par son intro —
 * `episodes` ne doit jamais être vide, garanti par `chargerLivre`.
 */
export function avecIntro(livre: NumeroLivre, episodes: EpisodeListe[]): EpisodeListe[] {
  return [introDuLivre(livre, episodes[0]), ...episodes];
}

// Une seule assertion, à la frontière des données : TypeScript infère des
// `string` larges pour les champs à valeurs contraintes (`timestamp_source`,
// `confidence`…) en lisant le JSON. Ces fichiers sont produits et validés par
// notre propre pipeline, qui garantit ces valeurs (docs/qc-fusion-timestamps.md) ;
// les invariants qui casseraient réellement le site sont revérifiés au build
// par `chargerLivre` ci-dessous.
const PAR_LIVRE: Record<NumeroLivre, Episode[]> = {
  1: livre1 as unknown as Episode[],
  2: livre2 as unknown as Episode[],
  3: livre3 as unknown as Episode[],
  4: livre4 as unknown as Episode[],
};

/** Nombre d'épisodes attendu par livre (Wikipédia) — sert de garde-fou. */
const EPISODES_ATTENDUS: Record<NumeroLivre, number> = { 1: 100, 2: 100, 3: 100, 4: 99 };

/**
 * Épisodes d'un livre, triés par numéro.
 *
 * Échoue au build plutôt que de servir des données incomplètes : un épisode
 * sans `start_seconds` casserait silencieusement la fonction centrale du site
 * (sauter au bon instant), et le pipeline garantit qu'il n'y en a aucun
 * (docs/qc-fusion-timestamps.md).
 */
export function chargerLivre(livre: NumeroLivre): Episode[] {
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
export function chargerTousLesEpisodes(): Episode[] {
  return LIVRES.flatMap(chargerLivre);
}
