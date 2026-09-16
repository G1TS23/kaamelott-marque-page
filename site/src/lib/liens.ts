/**
 * Liens externes fixes du pied de page (issue #20) — crédit permanent à
 * Shisheyu et sources Wikipédia, voir RESSOURCE.md et docs/SPECS.md
 * section 8. Pas de logique ici, juste des constantes ; pas de test dédié
 * pour la même raison que `data/characters.json` n'en a pas.
 */
import type { NumeroLivre } from './episodes';

export const URL_CHAINE_SHISHEYU = 'https://www.youtube.com/@Shisheyu';

export const URL_WIKIPEDIA_SAISON: Record<NumeroLivre, string> = {
  1: 'https://fr.wikipedia.org/wiki/Saison_1_de_Kaamelott',
  2: 'https://fr.wikipedia.org/wiki/Saison_2_de_Kaamelott',
  3: 'https://fr.wikipedia.org/wiki/Saison_3_de_Kaamelott',
  4: 'https://fr.wikipedia.org/wiki/Saison_4_de_Kaamelott',
};

export function urlVideoYouTube(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
