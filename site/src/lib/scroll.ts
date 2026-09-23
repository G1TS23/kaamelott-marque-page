/**
 * Retour en haut animé nous-mêmes plutôt que via
 * `scrollTo({behavior: 'smooth'})` (retour d'usage, mobile — issue #83) :
 * un diagnostic embarqué a montré l'animation native démarrer et progresser
 * normalement (813px → 127px en ~340ms) puis s'arrêter net sans jamais
 * atteindre 0, sans erreur ni second appel à `scrollTo` — cohérent avec un
 * reliquat de scroll par inertie du geste qui a fait défiler la liste juste
 * avant le tap sur l'épisode, qui continue de piloter la position en
 * concurrence avec l'animation native jusqu'à l'emporter. En reposant
 * `scrollY` nous-mêmes à chaque frame (`behavior` implicite `auto`, pas
 * d'animation native à interrompre), rien d'externe ne peut geler la
 * position en cours de route : la valeur est réaffirmée à la frame
 * suivante, jusqu'au sommet.
 *
 * Extrait de `Site.svelte` (issue #87, audit de stabilisation) : logique
 * pure injectable/testable sans monter tout le composant, même pattern que
 * `lecteur.ts`. Les dépendances (scroll réel, horloge, `requestAnimationFrame`)
 * sont passées en paramètre plutôt que lues directement sur `window` :
 * `dependancesParDefaut` couvre l'usage réel, un test fournit ses propres
 * fausses dépendances pour piloter le temps et l'animation de façon
 * déterministe (pas de vrai `requestAnimationFrame` à attendre).
 */
export interface DependancesScroll {
  scrollY: () => number;
  scrollTo: (x: number, y: number) => void;
  reducedMotion: () => boolean;
  maintenant: () => number;
  requestAnimationFrame: (callback: (temps: number) => void) => void;
}

const dependancesParDefaut: DependancesScroll = {
  scrollY: () => window.scrollY,
  scrollTo: (x, y) => window.scrollTo(x, y),
  reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  maintenant: () => performance.now(),
  requestAnimationFrame: (callback) => requestAnimationFrame(callback),
};

export function scrollerVersLeHaut(duree = 400, deps: DependancesScroll = dependancesParDefaut) {
  const depart = deps.scrollY();
  if (depart === 0) return;
  if (deps.reducedMotion()) {
    deps.scrollTo(0, 0);
    return;
  }
  const t0 = deps.maintenant();
  function etape(maintenant: number) {
    const t = Math.min(1, (maintenant - t0) / duree);
    const applique = 1 - Math.pow(1 - t, 3); // ease-out cubique
    deps.scrollTo(0, Math.round(depart * (1 - applique)));
    if (t < 1) deps.requestAnimationFrame(etape);
  }
  deps.requestAnimationFrame(etape);
}
