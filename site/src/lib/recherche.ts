/**
 * Recherche floue par titre, globale aux 4 livres (issue #15,
 * docs/SPECS.md section 5).
 *
 * Tolère fautes de frappe et ordre des mots via Fuse.js — aucune infra
 * serveur, l'index des ~400 titres se construit une fois au montage de
 * l'îlot. La logique vit ici, pas dans le `.svelte` : SonarCloud n'analyse
 * pas les composants, et c'est ce wrapper (pas le classement interne de
 * Fuse) qu'on veut tester.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { EpisodeAvecLivre } from './episodes';

const OPTIONS: IFuseOptions<EpisodeAvecLivre> = {
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
};

export function creerIndexTitres(episodes: EpisodeAvecLivre[]): Fuse<EpisodeAvecLivre> {
  return new Fuse(episodes, OPTIONS);
}

/**
 * Résultats triés par pertinence. Requête vide, blanche ou d'un seul
 * caractère → tableau vide (à qui appelle de décider quoi afficher :
 * `Site.svelte` montre le sommaire pour une requête vide, le message
 * « aucun résultat » sinon).
 */
export function chercherParTitre(
  index: Fuse<EpisodeAvecLivre>,
  requete: string,
): EpisodeAvecLivre[] {
  const q = requete.trim();
  if (q.length < 2) return [];
  return index.search(q).map((r) => r.item);
}
