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
  // 0 = identique, 1 = n'importe quoi. 0.4 laisse passer une faute ou deux
  // sans ramener la moitié du catalogue.
  threshold: 0.4,
  minMatchCharLength: 2,
};

export function creerIndexTitres(episodes: EpisodeAvecLivre[]): Fuse<EpisodeAvecLivre> {
  return new Fuse(episodes, OPTIONS);
}

/**
 * Résultats triés par pertinence. Requête vide ou d'un seul caractère →
 * aucun résultat (on montre le sommaire, pas 400 lignes).
 */
export function chercherParTitre(
  index: Fuse<EpisodeAvecLivre>,
  requete: string,
): EpisodeAvecLivre[] {
  const q = requete.trim();
  if (q.length < 2) return [];
  return index.search(q).map((r) => r.item);
}
