/**
 * Recherche globale aux 4 livres (issues #15, #16, docs/SPECS.md section 5) :
 * titre et personnage par Fuse.js (chaînes courtes sur un vocabulaire
 * fermé — le titre comme le nom d'un personnage), résumé par BM25
 * (`./bm25.ts` — un paragraphe se classe par fréquence de terme, pas par
 * distance d'édition). Chaque recherche se construit une fois au montage
 * de l'îlot ; seule la requête est réévaluée à la frappe. La logique vit
 * ici, pas dans le `.svelte` : SonarCloud n'analyse pas les composants.
 */

import Fuse, { type FuseResult, type IFuseOptions } from 'fuse.js';
import type { DonneesRecherche, EpisodeAvecLivre } from './episodes';
import { chercherBM25, creerIndexBM25, type IndexBM25 } from './bm25';

const OPTIONS_TITRE: IFuseOptions<EpisodeAvecLivre> = {
  keys: ['title'],
  // Les titres sont courts (2-4 mots) : une correspondance n'importe où dans
  // le titre compte autant qu'au début.
  ignoreLocation: true,
  // 0 = identique, 1 = n'importe quoi. Réglé empiriquement contre les 399
  // vrais titres (retour d'usage : « hea » ramenait 49 résultats à 0.4,
  // dont des titres sans rapport comme « Feu l'âne de Guethenoc »). Le
  // plateau [0.13, 0.3] donne des résultats identiques et propres sur tout
  // un jeu de requêtes courtes et de fautes réelles ; en dessous, une vraie
  // faute de frappe ("tarte au myrtille") cesse de matcher dès 0.11. 0.3
  // prend la marge haute du plateau : le plus de tolérance sans retomber
  // dans le bruit.
  threshold: 0.3,
  minMatchCharLength: 2,
  // Nécessaire à `chercherEpisodes` (score de fusion) ; n'affecte pas
  // `chercherParTitre`, qui ne lit que `.item`.
  includeScore: true,
};

export function creerIndexTitres(episodes: EpisodeAvecLivre[]): Fuse<EpisodeAvecLivre> {
  return new Fuse(episodes, OPTIONS_TITRE);
}

/**
 * Résultats Fuse bruts (score inclus), triés par pertinence. Requête vide,
 * blanche ou d'un seul caractère → tableau vide. Une seule garde de
 * requête pour tous les appelants : `chercherFuse` ci-dessous (qui n'en
 * garde que `.item`, pour `chercherParTitre`/`chercherParPersonnage`) et
 * `chercherEpisodes` (qui a besoin du score pour fusionner) — sans ça,
 * `chercherEpisodes` dupliquait la même garde de son côté en appelant
 * `index.search()` directement.
 */
function rechercherFuseAvecScore<T>(index: Fuse<T>, requete: string): FuseResult<T>[] {
  const q = requete.trim();
  if (q.length < 2) return [];
  return index.search(q);
}

/**
 * Résultats triés par pertinence, sans le score. Partagée par
 * `chercherParTitre` et `chercherParPersonnage` — même mécanique Fuse,
 * seul le champ indexé change (à qui appelle — `Site.svelte` — de décider
 * quoi afficher : le sommaire pour une requête vide, le message « aucun
 * résultat » sinon).
 */
function chercherFuse<T>(index: Fuse<T>, requete: string): T[] {
  return rechercherFuseAvecScore(index, requete).map((r) => r.item);
}

export function chercherParTitre(
  index: Fuse<EpisodeAvecLivre>,
  requete: string,
): EpisodeAvecLivre[] {
  return chercherFuse(index, requete);
}

/**
 * Un épisode enrichi des données de recherche chargées à part
 * (`DonneesRecherche`, `/recherche.json`) — résumé et personnages, absents
 * de `EpisodeAvecLivre` tant que la recherche n'en a pas besoin.
 */
export type EpisodeRecherche = EpisodeAvecLivre & DonneesRecherche;

/** Recolle les deux sources par `id`. Un épisode sans donnée de recherche est ignoré. */
export function joindreDonneesRecherche(
  episodes: EpisodeAvecLivre[],
  donnees: DonneesRecherche[],
): EpisodeRecherche[] {
  const parId = new Map(donnees.map((d) => [d.id, d] as const));
  return episodes.flatMap((ep) => {
    const d = parId.get(ep.id);
    return d ? [{ ...ep, ...d }] : [];
  });
}

const OPTIONS_PERSONNAGE: IFuseOptions<EpisodeRecherche> = {
  // Fuse cherche nativement sur un champ array : chaque nom de `characters`
  // vaut comme sous-document. Mêmes réglages que le titre — même terrain
  // (chaînes courtes, vocabulaire fermé d'une centaine de noms).
  keys: ['characters'],
  ignoreLocation: true,
  threshold: 0.3,
  minMatchCharLength: 2,
  includeScore: true,
};

export function creerIndexPersonnages(episodes: EpisodeRecherche[]): Fuse<EpisodeRecherche> {
  return new Fuse(episodes, OPTIONS_PERSONNAGE);
}

export function chercherParPersonnage(
  index: Fuse<EpisodeRecherche>,
  requete: string,
): EpisodeRecherche[] {
  return chercherFuse(index, requete);
}

export function creerIndexResumes(episodes: EpisodeRecherche[]): IndexBM25<EpisodeRecherche> {
  return creerIndexBM25(episodes, (e) => e.summary);
}

export function chercherParResume(index: IndexBM25<EpisodeRecherche>, requete: string) {
  return chercherBM25(index, requete);
}

export type TypeCorrespondance = 'titre' | 'personnage' | 'résumé';

export interface ResultatRecherche {
  episode: EpisodeAvecLivre;
  /** Ce qui a matché, dans cet ordre : titre, personnage, résumé. */
  correspond: TypeCorrespondance[];
}

// Poids fixes pour titre/personnage (chaînes courtes, un match est un
// match — Fuse donne surtout du binaire une fois le seuil passé), score
// BM25 normalisé par requête (min-max sur le lot courant, BM25 n'étant pas
// borné) pour rester sur une échelle comparable. Même logique de poids que
// la maquette validée avant construction (voir issue #60).
const POIDS_TITRE = 3;
const POIDS_PERSONNAGE = 2;
const POIDS_RESUME = 3;

/**
 * Fusionne titre + personnage + résumé en une seule liste dédupliquée,
 * triée par pertinence — le pattern validé sur la maquette
 * (https://claude.ai/code/artifact/2f432b47-3b4e-4b45-8600-41cafe85a4e4) :
 * pas de panneau groupé par catégorie, juste une indication de ce qui a
 * matché à côté du titre.
 *
 * `indexPersonnages`/`indexResumes` sont `null` tant que `/recherche.json`
 * n'a pas résolu (`Site.svelte`) — la recherche par titre reste utilisable
 * seule en attendant, les deux autres axes s'ajoutent dès que prêts.
 *
 * Requête vide, blanche ou trop courte → tableau vide, comme
 * `chercherParTitre` (à qui appelle — `Site.svelte` — de distinguer
 * « pas de recherche » de « recherche sans résultat »).
 */
export function chercherEpisodes(
  indexTitres: Fuse<EpisodeAvecLivre>,
  indexPersonnages: Fuse<EpisodeRecherche> | null,
  indexResumes: IndexBM25<EpisodeRecherche> | null,
  requete: string,
): ResultatRecherche[] {
  const q = requete.trim();
  if (q.length < 2) return [];

  const parId = new Map<
    string,
    { episode: EpisodeAvecLivre; correspond: Set<TypeCorrespondance>; score: number }
  >();

  function ajouter(episode: EpisodeAvecLivre, type: TypeCorrespondance, poids: number) {
    const courant = parId.get(episode.id);
    if (courant) {
      courant.correspond.add(type);
      courant.score += poids;
    } else {
      parId.set(episode.id, { episode, correspond: new Set([type]), score: poids });
    }
  }

  for (const r of rechercherFuseAvecScore(indexTitres, q)) {
    ajouter(r.item, 'titre', (1 - (r.score ?? 0)) * POIDS_TITRE);
  }

  if (indexPersonnages) {
    for (const r of rechercherFuseAvecScore(indexPersonnages, q)) {
      ajouter(r.item, 'personnage', (1 - (r.score ?? 0)) * POIDS_PERSONNAGE);
    }
  }

  if (indexResumes) {
    const resultatsResume = chercherParResume(indexResumes, q);
    const scoreMax = resultatsResume[0]?.score ?? 0;
    for (const r of resultatsResume) {
      const normalise = scoreMax > 0 ? r.score / scoreMax : 0;
      ajouter(r.item, 'résumé', normalise * POIDS_RESUME);
    }
  }

  return [...parId.values()]
    .sort((a, b) => b.score - a.score || a.episode.episode - b.episode.episode)
    .map(({ episode, correspond }) => ({
      episode,
      correspond: [...correspond].sort(
        (a, b) =>
          (['titre', 'personnage', 'résumé'] as const).indexOf(a) -
          (['titre', 'personnage', 'résumé'] as const).indexOf(b),
      ),
    }));
}
