# Composant lecteur (issue #14)

## Méthode

`site/src/components/Lecteur.svelte` porte l'unique instance `YT.Player` du
site (specs section 6 : un seul lecteur, jamais de mur de vignettes).

- **`Site.svelte`** (nouvel îlot racine) possède `livreActif`, seul état que
  le lecteur et le sommaire doivent partager. `SelecteurLivre.svelte` devient
  purement présentationnel : un clic n'y fait que remonter l'événement.
- La seule vraie décision — rester sur la vidéo courante ou en charger une
  autre — est dans `site/src/lib/lecteur.ts` (`commandePourEpisode`), testée.
  SonarCloud n'analysant pas les `.svelte`, la logique testable vit ailleurs.
- Types `@types/youtube` (officiel, ambient, aucun runtime) ; seule
  `window.onYouTubeIframeAPIReady` est ajoutée à la main
  (`site/src/types/youtube.d.ts`).

## Comportement

| Geste | Appel API | Résultat |
|---|---|---|
| Chargement de la page | constructeur `YT.Player` (mise en attente) | Vignette du Livre 1, rien en lecture |
| Bascule d'onglet seule | `cueVideoById` | Vignette du nouveau livre, rien en lecture |
| Clic sur un épisode, vidéo pas encore réellement chargée | `loadVideoById` + `startSeconds` | Charge et joue à la bonne position |
| Clic sur un épisode, vidéo déjà en lecture | `seekTo` + `playVideo` | Saut instantané, pas de rechargement |

La bascule d'onglet ne lance jamais la lecture : changer de livre ne doit pas
se substituer à un geste de lecture que l'utilisateur n'a pas demandé (specs
section 8).

## Le gel après un changement de livre

Trouvé en testant le site : bascule d'onglet puis clic sur un épisode de ce
livre → image noire/figée plusieurs secondes, sous-titres visibles et à jour.

Cause : `choisirLivre` marquait la vidéo comme « chargée » dès
`cueVideoById`, qui ne fait que préparer la vignette sans rien bufferiser. Le
clic suivant prenait alors le chemin rapide `seekTo` sur une vidéo jamais
réellement chargée — d'où l'attente de bufferisation à vide.

Correctif : `EtatLecteur { videoId, charge }` distingue l'état affiché de
l'état réellement chargé. `charge: false` après une mise en attente
(constructeur ou `cueVideoById`) ; `charge: true` seulement après un vrai
`loadVideoById` / `seekTo` en lecture. Le chemin rapide `seek` n'est pris que
si la cible est déjà `charge: true`.

## Garde-fous vérifiés

**Instance unique** — `videoIdInitial` est fixée par `Site.svelte` à la
vidéo du premier livre (constante), pas liée à `livreActif`. Sinon le
`$effect` de `Lecteur`, qui traque cette prop via `creerPlayer`, recréerait
un player à chaque bascule d'onglet — sur un `<div>` déjà remplacé par
l'iframe. `creerPlayer` a en plus un garde `if (player) return`.

**Comportement réel sur la preview de déploiement** (barre de progression
YouTube native comme témoin, l'attribut `src` de l'iframe ne reflétant jamais
l'état interne piloté par `postMessage`) :

| Action | Attendu | Observé |
|---|---|---|
| Bascule Livre 1 → 2, sans épisode | Vignette change, pas de lecture | Vignette Livre 2, en pause |
| Clic sur un épisode d'un autre livre (0:10:47) | Charge + joue à la position | `10:50 / 6:18:19`, image nette après ~2s |
| Clic sur un épisode du même livre, déjà chargé (0:03:59) | Seek instantané | `4:02 / 6:18:19`, image nette immédiate |

## Limites connues

- Le composant ne démonte jamais (page unique, îlot `client:load`) : le
  teardown de l'effet (`player.destroy()` + détache le callback global) est
  là par correction, il ne s'exécute pas en pratique.
- `playerVars: { rel: 0 }` ne désactive plus les suggestions de fin depuis
  2018 (YouTube les limite seulement à la même chaîne). Réglage conservé par
  cohérence avec `tools/pointage-manuel.html`.
- `start_seconds` est la position brute mesurée (cf. `docs/qc-fusion-timestamps.md`) :
  un saut atterrit 2 à 8s avant le vrai début d'épisode selon la source. Une
  petite avance à la lecture reste à décider (hors périmètre #14).
- Pas de contrôle personnalisé ni de bascule clair/sombre : l'en-tête
  définitif (onglets collés au lecteur, note de cadrage) viendra avec #15+.
