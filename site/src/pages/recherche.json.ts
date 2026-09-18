import type { APIRoute } from 'astro';
import { chargerTousLesEpisodes, type DonneesRecherche } from '../lib/episodes.ts';

/**
 * Résumés, personnages et générique des 399 épisodes, servis à part de la
 * page (issue #16, complété issue #55) : ~300 Ko que le HTML initial n'a
 * pas à porter tant que personne ne cherche par résumé/personnage ni ne
 * déplie une ligne du sommaire. `Site.svelte` le récupère une fois au
 * montage de l'îlot.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const donnees: DonneesRecherche[] = chargerTousLesEpisodes().map((e) => ({
    id: e.id,
    summary: e.summary,
    characters: e.characters,
    channel: e.channel,
    director: e.director,
    writer: e.writer,
    guests: e.guests,
  }));

  // Même philosophie que `chargerLivre` (episodes.ts) : un résumé manquant
  // casserait silencieusement la recherche pour cet épisode, échouer au
  // build plutôt que de le découvrir en production.
  const sansResume = donnees.filter((d) => !d.summary.trim());
  if (sansResume.length > 0) {
    throw new Error(
      `${sansResume.length} épisode(s) sans résumé : ${sansResume.map((d) => d.id).join(', ')}.`,
    );
  }

  return new Response(JSON.stringify(donnees), {
    headers: { 'Content-Type': 'application/json' },
  });
};
