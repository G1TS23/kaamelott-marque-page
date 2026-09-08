# Kaamelott - Le Marque-Page de la Relecture

Spécifications de cadrage — aucune implémentation à ce stade. Toutes les décisions listées ci-dessous ont été validées ; ce document est la référence pour découper le travail en issues GitHub.

> Version illustrée (maquettes, mockups visuels) : voir l'artifact publié — https://claude.ai/code/artifact/a4625b48-015b-4354-ab85-5a047ff1b7fa

## Sommaire

1. [Besoin](#1-besoin)
2. [Constats](#2-constats)
3. [Le vrai problème : obtenir ~400 timestamps](#3-le-vrai-problème--obtenir-400-timestamps)
4. [Modèle de données](#4-modèle-de-données)
5. [Recherche](#5-recherche--titre-et-résumé)
6. [Lecture dynamique](#6-lecture-dynamique--pas-de-mur-de-vignettes)
7. [Stack technique](#7-stack-technique)
8. [Design / UX / UI](#8-design--ux--ui)
9. [Feuille de route](#9-feuille-de-route-suggérée)
10. [Décisions prises](#10-décisions-prises)

---

## 1. Besoin

Un streamer (Shisheyu) a lu et réinterprété à voix haute les quatre premiers livres de Kaamelott, chacun publié sur YouTube comme **une seule vidéo-fleuve** (le Livre 1 fait 6h31, le Livre 2 fait 6h18 — durées des Livres 3 et 4 non vérifiées mais probablement du même ordre). Chaque livre contient environ une centaine de scènes/épisodes originaux de 3 à 4 minutes, mais dans la vidéo réinterprétée rien ne les délimite : pas de chapitres, pas d'index, pas de vignettes.

Le site doit permettre à quelqu'un qui se souvient d'un épisode — par son titre, ou juste par ce qui s'y passe — de tomber directement sur le bon instant de la bonne vidéo. Deux points structurent la demande :

- **Pas de mur de vignettes.** Pas un catalogue de ~400 cartes identiques avec un paramètre `&t=` différent chacune. Une recherche qui pointe vers *un* lecteur, qui se positionne dynamiquement là où il faut.
- **Recherche par résumé.** Au-delà du titre exact, retrouver un épisode à partir de ce dont on se souvient (« celui où Perceval empile des piques », « la tarte aux myrtilles ») — une recherche qui comprend un texte descriptif, pas seulement une correspondance de mots-clés stricte.

Le vrai nœud technique du projet : localiser ~400 scènes dans ~26 heures de vidéo, sans timestamps existants nulle part (section 3).

## 2. Constats

**Vidéos** — Le Livre 1 (`REFu8UmXXE0`) dure 6h31min16s, le Livre 2 (`x1RgHE0rg1M`) 6h18min19s — deux VOD continus, sans découpage, sans liste de chapitres dans la description.

**Wikipédia** — Chaque page de saison liste les épisodes un par un : numéro de production, titre, diffusion d'origine, réalisateur, scénariste, et un résumé détaillé par épisode. Saison 1 : 100 épisodes. Saison 4 : 99 épisodes (98 de 3min30 + 1 de 7min). Aucune durée ni timestamp — logique, la page documente la série originale, pas la vidéo de Shisheyu.

**Deux indices audio/texte (repérés par le porteur du projet)** — Un **jingle de trompette** revient systématiquement au tout début de chaque épisode. Et juste avant de commencer, Shisheyu **annonce le numéro de l'épisode à voix haute** (« épisode 42 ») — et ce numéro apparaît dans la transcription automatique YouTube. Un nombre a très peu de façons de se faire mal transcrire, contrairement à un titre à rallonge ou un nom propre.

**Ce qui reste vrai malgré tout** — Ni chapitres YouTube, ni commentaire épinglé, ni fichier de métadonnées tout fait : le repérage temporel est un pipeline à concevoir, mais nettement plus mécanique qu'un simple pointage à l'œil.

## 3. Le vrai problème : obtenir ~400 timestamps

Quatre vidéos × ~100 épisodes ≈ 400 points de repère, dans un contenu où le rythme dépend entièrement des digressions du streamer.

| # | Piste | Verdict |
|---|-------|---------|
| A | Pointage manuel pendant le visionnage (touche à chaque début d'épisode, ~3h15/livre à 2×) | Fiabilité maximale, coût en temps réel. Devient une **passe de correction**, pas la méthode de départ. |
| B | Repérage crowdsourcé (commentaires viewers, puis formulaire visiteurs du site) | Complément, pas fondation. Mécanisme d'amélioration continue une fois le site public (v2). |
| C | Repérage du **numéro d'épisode annoncé** dans la transcription automatique (motif « épisode » + nombre) | **Confirmé** — un nombre a très peu de variantes à l'oral, l'ASR le transcrit presque toujours correctement. Wikipédia indexe déjà par numéro → correspondance numéro→numéro directe. |
| F | Détection du **jingle de trompette** (corrélation audio du signal contre un extrait de référence, Python/librosa) | Très fiable pour la *frontière*, muet sur l'*identité*. Garde-fou gratuit : nombre de jingles détectés vs épisodes attendus. |
| D | Correspondance sémantique résumé Wikipédia ↔ transcription (embeddings) | Filet de sécurité, pas méthode principale. Shisheyu lit les dialogues officiels (il n'improvise pas), mais le résumé Wikipédia reste un condensé encyclopédique, pas le dialogue — l'écart demeure. Utile seulement pour les rares cas non résolus par C+F. |
| E | Empreinte audio contre l'épisode original (type Shazam) | **Écarté.** Voix différente, montage différent — sans rapport avec le jingle (F), qui compare un extrait à lui-même dans la *même* vidéo, pas à une autre source. |

**Pipeline retenu (C + F) :**
1. Détecter tous les jingles d'un livre → liste de timestamps « un épisode commence ici ».
2. Pour chaque timestamp, lire le numéro annoncé juste avant/après dans la transcription → l'associer directement à l'épisode Wikipédia correspondant (numéro → numéro, sans comparaison de texte).
3. Garde-fous de cohérence : nombre de jingles détectés vs épisodes attendus (~100), et continuité de la séquence de numéros (1, 2, 3…) — un trou signale l'épisode à vérifier à la main.
4. Le pointage manuel (A) ne sert qu'à corriger les rares cas où le jingle est raté ou le numéro mal transcrit.

## 4. Modèle de données

Un épisode = une fiche JSON autonome. **Pas de `end_seconds`** : la fin d'un épisode est le `start_seconds` du suivant dans le même livre.

> **Correction post-implémentation (issue #1)** : pas de `aired_at`. Les pages Wikipédia ne donnent une date de diffusion qu'au niveau de la saison entière (ex. « diffusé du 3 janvier au 11 mars 2005 »), jamais par épisode — le champ « Première diffusion » de chaque épisode ne contient que le(s) pays/chaîne(s), sans date. Champ abandonné plutôt que rempli avec une donnée inexistante.

```jsonc
// un épisode — un fichier JSON par livre, ex. data/episodes/livre-1.json
{
  "id": "s1e02",
  "season": 1,
  "episode": 2,
  "title": "Les Tartes aux myrtilles",
  "summary": "Séli a cuisiné une tarte aux myrtilles qui s'avère immangeable, mais les convives doivent la goûter…",
  "channel": "M6",
  "director": "Alexandre Astier",
  "writer": "Alexandre Astier",
  "guests": [],
  "characters": ["Arthur", "Guenièvre", "Léodagan", "Séli"],
  "characters_source": "fandom", // fandom | heuristic
  "video_id": "REFu8UmXXE0",
  "start_seconds": 224.9,
  "timestamp_source": "jingle", // jingle | jingle_verifie | manuel
  "confidence": "confirmé"      // confirmé | à repointer
}
```

Seuls `title` et `summary` alimentent la recherche (floue et sémantique) — les autres champs Wikipédia (`channel`, `director`/`writer`, `guests`) sont capturés gratuitement à l'import et affichés comme contexte, sans entrer dans le calcul de pertinence.

**`start_seconds` / `timestamp_source` / `confidence`** ✅ (issue #12) — remplis pour les **399 épisodes**, sans exception, par `scripts/merge_timestamps.py`. Vocabulaire réellement implémenté, différent de celui envisagé initialement (`manual | community | auto-candidate` — la piste communautaire reste en v2, cf. section 3 piste B) :

| `timestamp_source` | Origine | Volume |
|---|---|---|
| `jingle` | Pipeline C+F : position du jingle détecté par corrélation audio, numéro validé par la transcription | 297 |
| `jingle_verifie` | Idem, mais numéro issu d'une conversion depuis la numérotation absolue (Livre 4, section 3) et vérifié un par un par visionnage | 30 |
| `manuel` | Pointage manuel direct (piste A), pour combler les trous du pipeline | 72 |

Le pointage manuel ne remplace jamais un timestamp du pipeline quand les deux existent : ces pointages redondants servent de validation croisée (ils tombent systématiquement 2 à 8s avant le jingle correspondant, l'humain réagissant au contexte avant que le jingle ne démarre). Garder le jingle comme référence évite de mélanger deux bases de mesure dans un même livre.

`confidence` vaut `confirmé` partout après vérification des 30 derniers cas incertains — aucun épisode ne reste `à repointer`. Détails et validations dans `docs/qc-fusion-timestamps.md`.

> **Conséquence pour la lecture (section 6)** : `start_seconds` est la position brute mesurée (début du jingle pour les sources `jingle*`). Un saut vers un épisode devrait appliquer une petite avance (~3-5s) au moment de la lecture plutôt que de la figer dans la donnée, pour ne pas rogner le début.

**`characters`** ✅ (issue #24) — deux sources combinées, priorité à la plus fiable :
1. **Wiki Kaamelott (Fandom)** — casting exact par épisode (tableau « Distribution »), scrapé manuellement (voir `docs/qc-characters-fandom.md`, contrainte Cloudflare). Couverture réelle : seulement **100/399 épisodes (25 %)**, très concentrée sur le Livre I — le wiki communautaire n'a pas de page complète pour tous les épisodes.
2. **Heuristique** (fallback, 299/399 épisodes) — fusion dédupliquée des personnages déjà cités dans `guests` et de tout nom de `data/characters.json` (liste canonique, ~100 entrées construites depuis [Liste des personnages de Kaamelott](https://fr.wikipedia.org/wiki/Liste_des_personnages_de_Kaamelott)) détecté par mot entier dans `summary`.

Le champ `characters_source` (`fandom` | `heuristic`) trace laquelle des deux a produit la base. Une 3ᵉ source s'y ajoute en **enrichissement** (jamais en remplacement) : les pages de casting **AlloCiné** donnent, pour les rôles secondaires/récurrents, la liste précise de leurs épisodes (l'inverse du Fandom) — 270 mentions de personnage ajoutées à `characters` sur les 399 épisodes (voir `docs/qc-characters-allocine.md`). Résultat : **0 épisode sur 399 sans personnage détecté** (contre 3 avec la seule heuristique). Alimente la facette personnages (section 8), pas la recherche floue/sémantique.

> **Limite connue de `characters_source`** : le champ dit comment la *base* de `characters` a été construite pour l'épisode (`fandom` ou `heuristic`), pas d'où vient chaque nom individuellement. Les ajouts AlloCiné se fondent dans la liste sans laisser de trace propre — un épisode marqué `heuristic` peut très bien contenir un nom apporté par AlloCiné. Pas d'audit trail par personnage à ce stade. Pour l'obtenir, il faudrait faire évoluer `characters` d'une liste de chaînes vers une liste d'objets `{name, source}` — changement de schéma plus lourd, pas fait pour l'instant faute de besoin identifié (aucun usage prévu section 8 ne nécessite de savoir la provenance nom par nom).

**Import initial depuis Wikipédia** ✅ — `scripts/import_wikipedia.py` (BeautifulSoup) extrait titre, résumé, chaîne, réalisateur/scénariste et invités pour les 399 épisodes (100+100+100+99) en une passe, vers `data/episodes/livre-{1..4}.json`. Un épisode par ailleurs cohérent (S3E1 « Le Chevalier errant ») a un numéro de production Wikipédia mal formé (`201` au lieu de `201 (3.1)`) — le script s'y adapte via l'ordre d'apparition dans la page et log un avertissement ; à vérifier manuellement en cas de futures ré-exécutions.

## 5. Recherche : titre et résumé

| Mode | Ce que tape l'utilisateur | Technique |
|------|---------------------------|-----------|
| Par titre | « tartes aux myrtilles », « heat » | Recherche floue classique (Fuse.js ou équivalent) |
| Par souvenir de scène | « celui où ils discutent de la table ronde avec l'artisan » | Recherche sémantique par embeddings |

Les deux modes partent ensemble dès le lancement, avec le modèle d'embeddings **embarqué dans le navigateur** (transformers.js, pas de serveur). Les embeddings des ~400 résumés sont précalculés une fois pour toutes ; seule la requête utilisateur est vectorisée à la volée.

**Portée : recherche globale aux quatre livres**, pas seulement le livre affiché. L'index (fuzzy comme sémantique) combine les fiches des 4 fichiers JSON ; chaque résultat garde son `video_id` propre pour savoir quel livre charger au clic.

**Filtre personnages (issue #24) : orthogonal, pas un 3ᵉ mode.** Le champ `characters` n'alimente ni la recherche floue ni la recherche sémantique — c'est une facette combinable (section 8) qui restreint ce qui est déjà affiché (sommaire ou résultats titre/résumé), pas une troisième façon de chercher qui rivaliserait avec les deux modes ci-dessus.

## 6. Lecture dynamique — pas de mur de vignettes

Un seul lecteur pour tout le site (une seule instance IFrame Player API), qui change simplement de source selon le livre actif — jamais 400 cartes vidéo.

- **Même livre → jamais de rechargement.** Cliquer un autre épisode du même livre appelle `player.seekTo(timestamp, true)` sur le lecteur déjà en place — pas de rechargement, au pire une fraction de seconde de rebufferisation.
- **Changement de livre → seule la source change.** Nouveau `video_id` chargé dans le même lecteur (paramètre `start=`), la page ne recharge pas.
- **Lien profond partageable** : `kaamelott-marque-page.fr/?livre=1&episode=s1e02` doit ouvrir directement le bon lecteur à la bonne seconde.
- **Clic sur un résultat de titre** → lecture immédiate en un clic. **Résultat du mode résumé** → carte de justification affichée avant lecture (correspondance probabiliste, mérite explication).

## 7. Stack technique

| Brique | Choix retenu |
|--------|--------------|
| Site (front-end) | Astro ou Vite |
| Hébergement | Netlify ou Vercel |
| Données | ~400 fiches JSON statiques (1 fichier par livre) + vecteurs d'embeddings précalculés |
| Recherche sémantique | transformers.js, modèle compact (~25-50 Mo), navigateur |
| Scripts hors-site (import, jingle, transcription) | Python — librosa/numpy (audio), BeautifulSoup (Wikipédia) |

- **v1** : site statique, données figées, recherche double (titre + résumé) dès le lancement. Aucun serveur, aucune base de données.
- **v2** (plus tard, pas au lancement) : contributions communautaires — base légère (SQLite/Supabase) + petite fonction serveur (Netlify/Vercel function) pour recevoir les propositions de correction.

## 8. Design / UX / UI

Direction retenue : **le sommaire du livre** comme structure principale (lecteur fixe, table des matières fidèle au nom « Livre », recherche par titre globale), avec une **passerelle vers la recherche par résumé** qui n'apparaît qu'en cas d'échec de la recherche par titre.

### User stories

- **Titre en tête** — taper un titre approximatif, cliquer, atterrir directement sur la scène.
- **Scène en tête, pas de titre** — décrire la scène quand la recherche par titre échoue, obtenir des résultats avec justification.
- **Partager une trouvaille** — copier un lien qui pointe directement sur l'épisode trouvé.
- **Changer de livre** — sans recharger la page ni perdre ses repères.
- **Ne pas savoir dans quel livre chercher** — la recherche couvre les 4 livres par défaut.
- **Redécouvrir sans chercher** — parcourir le sommaire d'un livre comme une table des matières.
- **Mobile** — interface utilisable à une main.
- **Comprendre la démarche** — comprendre dès l'arrivée qu'il s'agit d'un outil de navigation autour du travail de Shisheyu, pas un site officiel.

### Structure de navigation

Une seule page, organisée en zones fixes (le sélecteur de livre change la vidéo chargée, il ne restreint pas la recherche) :

- **En-tête** — nom du site + sélecteur de livre (onglets desktop, menu déroulant mobile).
- **Lecteur** — persistant, ne recharge que si le livre actif change.
- **Recherche** — barre par titre, globale aux 4 livres, avec passerelle vers la recherche par résumé si zéro résultat.
- **Sommaire** — liste des épisodes du livre actif, visible par défaut quand la recherche est vide.
- **Pied de page** — lien vers la vidéo YouTube source et la page Wikipédia du livre actif, et vers la chaîne YouTube de Shisheyu (crédit permanent).

### Popin de première visite : remerciement à Shisheyu

Affichée à la toute première visite (indicateur `localStorage`, pas de compte/serveur) :
- Explique le rôle du site (naviguer dans les vidéos de Shisheyu, pas les remplacer).
- Remercie explicitement Shisheyu, avec lien direct vers sa chaîne YouTube.
- Rappelle que Kaamelott et ses dialogues appartiennent à Alexandre Astier et aux ayants droit d'origine — le site n'est affilié ni à l'un ni aux autres.
- Bouton « J'ai compris » qui ferme la popin et pose l'indicateur ; le lien vers la chaîne de Shisheyu reste aussi accessible en permanence en pied de page.

### États de la zone recherche

1. **Sommaire** (par défaut, sans requête) — liste des épisodes du livre affiché.
2. **Zéro résultat par titre** — la passerelle apparaît (« Tu te souviens juste de la scène ? Décris-la plutôt → ») à la place d'une liste vide.
3. **Recherche par résumé** — résultats sémantiques avec justification (« correspond : ... »).
4. **Recherche globale** — un résultat titre issu d'un autre livre porte une étiquette (ex. « Livre 3 ») ; le clic bascule l'onglet actif puis lance la lecture.

*(Maquettes visuelles de ces 4 états : voir l'artifact lié en tête de document.)*

### Facette personnages (issue #24)

Chips au-dessus du sommaire/résultats, combinables avec n'importe quel autre état de la page — **pas un 3ᵉ mode de recherche** (section 5), un filtre orthogonal.

- **Sélection multiple en ET** : cocher plusieurs personnages (ex. Léodagan + Arthur + Guenièvre) restreint aux épisodes où ils apparaissent *tous ensemble* (intersection sur `characters`), pas l'union — contrairement à la convention habituelle des facettes e-commerce.
- **Pas de mur de chips** : la liste canonique fait ~100 entrées (`data/characters.json`) — les chips n'affichent que les personnages **déjà sélectionnés**. La découverte passe par un petit champ « + ajouter un personnage » qui filtre en tapant (tag-picker), pas une liste exhaustive toujours visible.
- Chaque chip actif est retirable individuellement (×).

*(Maquette des 3 états — repos / recherche / sélection multiple : voir l'artifact.)*

## 9. Feuille de route suggérée

1. **Import Wikipédia** — script qui extrait titres + résumés des 4 pages vers 4 fichiers JSON. Contenu prêt, sans timestamp.
2. **Échantillon test du pipeline C + F** — sur 10-15 épisodes d'un seul livre : détecter le jingle, lire le numéro annoncé. Confirmer la fiabilité avant d'investir dans l'outillage complet.
3. **Généralisation + correction des trous** — pipeline validé sur les 4 livres, garde-fous de cohérence, pointage manuel des seuls cas non résolus.
4. **Site v1** — une seule page, un seul lecteur (source changée selon le livre actif), sommaire filtrable par titre avec passerelle vers la recherche par résumé, les deux modes de recherche déjà en place, données statiques. Pas de contribution communautaire à ce stade.

## 10. Décisions prises

**Repérage des timestamps**
- Pipeline C+F validé d'abord sur un échantillon (10-15 épisodes) avant généralisation aux ~400.
- Ouverture communautaire fermée au lancement (v2 éventuelle).

**Modèle de données**
- Pas de `end_seconds`.
- Champs conservés : titre + résumé (recherche) ; chaîne, réalisateur/scénariste, invités (contexte/affichage). Pas de date de diffusion par épisode — indisponible sur Wikipédia (voir section 4).
- Traçabilité à 3 valeurs (manual / community / auto-candidate).
- Un fichier JSON par livre.
- `characters` calculé à l'import (guests + matching contre `data/characters.json`), pas en recherche à la volée. Facette combinable en ET, découverte par recherche à taper plutôt qu'un mur de ~100 chips.

**Recherche et interface**
- Passerelle B→C uniquement après échec de la recherche par titre.
- Les deux modes de recherche (titre + résumé) partent ensemble dès le v1.
- Recherche globale aux quatre livres par défaut.
- Clic sur un résultat de titre = lecture immédiate ; carte de justification réservée au mode résumé.

**Stack technique**
- Front-end : Astro ou Vite. Hébergement : Netlify ou Vercel.
- Recherche sémantique : modèle compact (~25-50 Mo), transformers.js, navigateur.
- Scripts hors-site : Python.

**Identité et crédit**
- Nom du site : **Kaamelott - Le Marque-Page de la Relecture**.
- Crédit à Shisheyu : popin de première visite + lien permanent en pied de page.
