/**
 * Décide quoi faire du lecteur YouTube face à une navigation (issue #14,
 * docs/SPECS.md section 6).
 *
 * Séparé de `Lecteur.svelte` : c'est la seule vraie décision de ce
 * composant (rester sur la vidéo courante ou en charger une autre), et
 * SonarCloud n'analyse pas les `.svelte` — la logique qui mérite d'être
 * testée reste ici, le composant ne fait que l'exécuter contre l'API
 * YouTube.
 */

export type CommandeLecteur =
  | { action: 'seek'; secondes: number }
  | { action: 'charger'; videoId: string; secondes: number };

/**
 * État de la vidéo actuellement affichée par le lecteur.
 *
 * `charge: false` = seulement mise en attente (`cueVideoById`, ou l'appel
 * initial du constructeur `YT.Player` — les deux ne font que préparer la
 * vignette, sans rien bufferiser). `charge: true` = réellement chargée via
 * `loadVideoById` ou `seekTo` sur une vidéo déjà en lecture.
 *
 * La distinction existe pour une seule raison, trouvée en testant le vrai
 * site (issue #14) : un `seekTo` sur une vidéo seulement mise en attente
 * laisse l'image figée plusieurs secondes le temps que YouTube bufferise
 * autour de la position demandée (les sous-titres, sur un flux séparé,
 * s'affichent avant l'image et donnent l'impression d'un blocage). Un
 * `loadVideoById` avec position de départ n'a pas ce problème : il charge
 * réellement depuis cette position, il ne saute pas dans du vide.
 */
export interface EtatLecteur {
  videoId: string;
  charge: boolean;
}

/**
 * Un seul lecteur pour tout le site : cliquer un épisode déjà réellement
 * chargé ne fait qu'avancer dedans (`seekTo`, rapide et fiable puisque le
 * buffer existe déjà) ; cliquer un épisode qui n'est que mis en attente
 * (bascule d'onglet sans lecture, ou tout premier épisode de la session)
 * charge la vidéo pour de vrai, directement à la bonne position.
 */
export function commandePourEpisode(
  etat: EtatLecteur | null,
  videoIdCible: string,
  secondes: number,
): CommandeLecteur {
  if (etat?.videoId === videoIdCible && etat.charge) {
    return { action: 'seek', secondes };
  }
  return { action: 'charger', videoId: videoIdCible, secondes };
}
