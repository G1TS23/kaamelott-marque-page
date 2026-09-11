# Kaamelott - Le Marque-Page de la Relecture

Spécifications de cadrage — aucune implémentation à ce stade. Toutes les décisions listées ci-dessous ont été validées ; ce document est la référence pour découper le travail en issues GitHub.

> Version illustrée (maquettes, mockups visuels) : voir l'artifact publié — https://claude.ai/code/artifact/a4625b48-015b-4354-ab85-5a047ff1b7fa

## Sommaire

1. [Besoin](#1-besoin)
2. [Constats](#2-constats)
3. [Le vrai problème : obtenir ~400 timestamps](#3-le-vrai-problème--obtenir-400-timestamps)
4. [Modèle de données](#4-modèle-de-données)
5. [Recherche](#5-recherche--titre-résumé-et-réplique)
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

## 5. Recherche : titre, résumé et réplique

| Mode | Ce que tape l'utilisateur | Technique |
|------|---------------------------|-----------|
| Par titre | « tartes aux myrtilles », « heat » | Recherche floue classique (Fuse.js ou équivalent) |
| Par souvenir de scène | « celui où ils discutent de la table ronde avec l'artisan » | Recherche sémantique par embeddings |
| Par réplique (issue #45) | « des petites paysannes », « c'est pas faux » | Recherche tolérante dans la transcription YouTube, croisée avec `start_seconds` |

Les deux premiers modes partent ensemble dès le lancement, avec le modèle d'embeddings **embarqué dans le navigateur** (transformers.js, pas de serveur). Les embeddings des ~400 résumés sont précalculés une fois pour toutes ; seule la requête utilisateur est vectorisée à la volée.

**Portée : recherche globale aux quatre livres**, pas seulement le livre affiché. L'index (fuzzy comme sémantique) combine les fiches des 4 fichiers JSON ; chaque résultat garde son `video_id` propre pour savoir quel livre charger au clic.

**Filtre personnages (issue #24) : orthogonal, pas un 4ᵉ mode.** Le champ `characters` n'alimente aucun des modes de recherche — c'est une facette combinable (section 8) qui restreint ce qui est déjà affiché (sommaire ou résultats), pas une façon de chercher qui rivaliserait avec les modes ci-dessus.

### Recherche par réplique (post-v1)

Idée apparue après la fusion des timestamps (issue #12) : les transcriptions YouTube auto-générées (`data/transcripts/*.vtt`, utilisées comme piste C du pipeline C+F, section 3) contiennent le texte effectivement prononcé, horodaté mot à mot. Une fois `start_seconds` connu pour les 399 épisodes, chaque timestamp de transcription se rattache trivialement à un épisode : c'est le dernier `start_seconds` (du même livre) inférieur ou égal à ce timestamp — exactement l'absence de `end_seconds` (section 4) qui rend ça immédiat.

C'est un axe de recherche différent des deux autres, pas redondant : les résumés Wikipédia sont un condensé encyclopédique qui ne contient presque jamais de dialogue, alors que Kaamelott se retient par répliques. Cet axe réhabilite la **piste D** de la section 3 (correspondance transcription ↔ contenu), mais l'usage s'inverse : en pipeline elle servait de filet de sécurité pour *identifier* un épisode, ici elle devient la source d'une recherche *pour l'utilisateur final*.

**Prototypé avant d'écrire l'issue**, sur les données réelles des 4 livres :
- jointure transcription → épisode confirmée exacte (ex. « c'est pas faux » → 5 épisodes distincts au Livre 1, chacun correctement identifié) ;
- volumétrie mesurée : 15,5 Mo de VTT bruts → 347 555 mots horodatés → 4,8 Mo de texte seul une fois débarrassé du balisage (1,2 Mo/livre) ;
- **fidélité ASR, le risque principal** : une recherche exacte échoue régulièrement sur une orthographe pourtant correcte de la réplique (ex. « paysannes » transcrit `paysanes`, un seul « n » — vérifié en cherchant le mot dans l'épisode 14 « Monogame », qui le contient bel et bien, à 63:24) ;
- **sous-titres roulants** : la même réplique ressort 2 à 3 fois d'affilée dans le VTT brut (répétition du format « roulant », section 3) — un dédoublonnage au mot ne suffit pas, il faut dédupliquer les *résultats* proches dans le temps, pas seulement les mots.

**Décisions à date** (à affiner en issue) :
- Index **pré-joint par épisode** au build (pas une recherche en timeline plate suivie d'un bisect à l'exécution) : un bloc de texte par épisode, timestamps mot à mot conservés à l'intérieur — permet de sauter directement à la réplique trouvée, pas seulement au début de l'épisode.
- Matching **tolérant à l'orthographe** obligatoire, pas une recherche par sous-chaîne exacte — le prototype le démontre, pas un raffinement optionnel.
- **Affichage limité à un court extrait autour du résultat**, jamais la transcription intégrale d'un épisode : ce sont des dialogues d'auteur (Astier), pas des résumés encyclopédiques comme pour les autres modes — la nuance de droit à trancher avant construction, pas après.
- Aucun nouveau champ dans `episodes/livre-N.json` : la jointure est calculée au build de l'index, pas stockée sur la fiche épisode.
- Nouvelle dépendance de build : `data/transcripts/*.vtt`, gitignorées et régénérables aujourd'hui (intrant de pipeline), devraient être committées ou re-fetchées au build pour ce mode (dépendance produit, plus seulement pipeline).

## 6. Lecture dynamique — pas de mur de vignettes

Un seul lecteur pour tout le site (une seule instance IFrame Player API), qui change simplement de source selon le livre actif — jamais 400 cartes vidéo.

- **Même livre → jamais de rechargement.** Cliquer un autre épisode du même livre appelle `player.seekTo(timestamp, true)` sur le lecteur déjà en place — pas de rechargement, au pire une fraction de seconde de rebufferisation.
- **Changement de livre → seule la source change.** Nouveau `video_id` chargé dans le même lecteur (paramètre `start=`), la page ne recharge pas.
- **Lien profond partageable** : `kaamelott-marque-page.fr/?livre=1&episode=s1e02` doit ouvrir directement le bon lecteur à la bonne seconde.
- **Clic sur un résultat de titre** → lecture immédiate en un clic. **Résultat du mode résumé** → carte de justification affichée avant lecture (correspondance probabiliste, mérite explication).

## 7. Stack technique

| Brique | Choix retenu |
|--------|--------------|
| Site (front-end) | **Astro + Svelte + TypeScript** ✅ (issue #13) — voir ci-dessous |
| Hébergement | **Netlify** ✅ (issue #13) — `netlify.toml` à la racine, base `site/`, publication `site/dist` |
| Données | ~400 fiches JSON statiques (1 fichier par livre) + vecteurs d'embeddings précalculés |
| Recherche sémantique | transformers.js, modèle compact (~25-50 Mo), navigateur |
| Scripts hors-site (import, jingle, transcription) | Python — librosa/numpy (audio), BeautifulSoup (Wikipédia) |

- **v1** : site statique, données figées, recherche double (titre + résumé) dès le lancement. Aucun serveur, aucune base de données.
- **v2** (plus tard, pas au lancement) : contributions communautaires — base légère (SQLite/Supabase) + petite fonction serveur (Netlify/Vercel function) pour recevoir les propositions de correction.

**Astro + Svelte** ✅ (issue #13) — le site vit dans `site/`, à côté du pipeline Python plutôt que mélangé à lui.

- **Astro** parce que le sommaire est du contenu : il est pré-rendu en HTML au build et reste lisible sans JavaScript, seuls les îlots interactifs (recherche, lecteur) sont hydratés.
- **Svelte plutôt que React** parce que la recherche sémantique embarquera déjà un modèle de 25-50 Mo : autant que le reste du bundle reste marginal (Svelte compile son runtime à quasi rien, React ajoute ~45 Ko gzip).
- **Les données ne sont pas dupliquées** : `site/src/lib/episodes.js` importe directement `data/episodes/livre-{1..4}.json` à la racine du dépôt, résolus par Vite au build. Régénérer les données suffit, pas d'étape de copie à maintenir.
- **Le build échoue** si un livre n'a pas son compte d'épisodes attendu ou si un épisode n'a pas de `start_seconds` : servir un épisode qui ne mène nulle part serait pire qu'un build rouge. Il lance aussi `astro check` en amont — Astro transpile TypeScript sans le vérifier, sans quoi les types ne serviraient à rien.
- **TypeScript**, la fiche épisode étant typée une fois dans `site/src/lib/episodes.ts` et héritée partout. D'autant que SonarCloud n'analyse ni les `.astro` ni les `.svelte` : dans les composants, les types sont le seul filet — d'où la règle de garder la logique non triviale dans `src/lib/`.

## 8. Design / UX / UI

Direction retenue : **le sommaire du livre** comme structure principale (lecteur fixe, table des matières fidèle au nom « Livre », recherche par titre globale), avec une **passerelle vers la recherche par résumé** qui n'apparaît qu'en cas d'échec de la recherche par titre.

### Direction artistique et design system (issue #51)

La DA vient des maquettes de la note de cadrage (artifact lié en tête de document). Elle y était restée seule : `site/src/styles/tokens.css` en est désormais la **source de vérité versionnée**, et aucune couleur ne doit être écrite en dur ailleurs — un test le vérifie (`tokens.test.ts`), le CSS échouant en silence quand une variable n'existe pas.

**Registre visuel** — un fond parcheminé légèrement vert, une encre chaude, un accent ocre : l'évocation du manuscrit sans le pastiche médiéval (ni gothique, ni parchemin texturé, ni heaume en illustration).

**Typographie** — trois familles, trois rôles qui ne s'intervertissent pas :

| Rôle | Famille | Usage |
| --- | --- | --- |
| Titres, marque | Fraunces (serif variable, axe `opsz`) | `h1`-`h3`, nom du site |
| Texte courant | Source Sans 3 | corps, résumés — 16,5 px / 1,6 |
| Données | IBM Plex Mono (400, 600) | numéros d'épisode, minutages, étiquettes, onglets — toujours en chiffres tabulaires |

Le serif signale un titre, la mono signale une donnée : c'est la mono qui porte tout ce qui s'aligne en colonne. Les polices sont **auto-hébergées** (paquets Fontsource, sous-ensemble latin, ~123 Ko au total) et non chargées depuis Google Fonts — pas de dépendance à un tiers ni d'IP de visiteur transmise au passage.

**Palette** — quatorze tokens en rôles plutôt qu'en couleurs, déclinés clair et sombre :

| Token | Rôle | Clair | Sombre |
| --- | --- | --- | --- |
| `--fond` | fond de page | `#eceee3` | `#171911` |
| `--surface` / `--surface-haute` | encarts et champs / cartes détachées | `#f9f9f2` / `#ffffff` | `#1e2117` / `#252819` |
| `--encre` / `--encre-douce` / `--encre-pale` | texte principal / secondaire / méta | `#20241d` / `#565c4c` / `#8b9080` | `#e9e7d8` / `#b3b39e` / `#7c8070` |
| `--trait` | bordures et séparateurs | `#d4d6c5` | `#343827` |
| `--accent` / `--accent-fort` / `--accent-voile` | état actif ou sélectionné | `#a5711f` / `#8a5c15` / `#f1e4cd` | `#dba748` / `#eec06a` / `#332a17` |
| `--profond` / `--profond-voile` | liens, justifications de résultat | `#3f6357` / `#e2ebe6` | `#8fbba9` / `#22322c` |
| `--alerte` / `--alerte-voile` | avertissement | `#8a3324` / `#f3e2dd` | `#e2917f` / `#3a2420` |

Les noms sont francisés comme le reste du code ; leur équivalent dans la note de cadrage (`--ink`, `--line`, `--deep`…) est rappelé en commentaire dans `tokens.css`.

**Conventions de composants** — un état actif se signale par le couple `--accent-voile` (fond) + `--accent-fort` (texte), jamais par une couleur inventée sur place. Pilules (`--rayon-pilule`) pour les onglets, chips et le champ de recherche ; `--rayon-carte` / `--rayon-encart` / `--rayon-etiquette` pour le reste. Contenu limité à `--largeur-contenu` (760 px). Espacements pris dans l'échelle `--esp-1` à `--esp-6`.

**Thème sombre** — piloté par `prefers-color-scheme`, avec un attribut `data-theme` qui le force dans les deux sens. La bascule manuelle n'est pas encore posée côté interface, mais la mécanique l'attend.

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
5. **Recherche par réplique** (post-v1, pas un prérequis du lancement) — 3ᵉ mode de recherche dans la transcription (section 5), une fois le v1 en place. Scope propre (matching tolérant, dédoublonnage, arbitrage droit d'auteur sur l'affichage) qui ne doit pas retarder le lancement.

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

**Lecteur (issue #14)**
- Un seul îlot Svelte (`Site.svelte`) plutôt que deux hydratés séparément : le lecteur et le sélecteur de livre doivent partager `livreActif`, ce qu'aucun des deux composants ne peut posséder seul. Le lecteur (`Lecteur.svelte`) et le sommaire (`SelecteurLivre.svelte`) restent chacun sans état de navigation propre — de purs exécutants, pilotés d'en haut.
- Décision de navigation (rester sur la vidéo courante vs en charger une autre) isolée dans `src/lib/lecteur.ts`, testée — SonarCloud n'analysant pas les `.svelte`, c'est là que la seule branche logique réelle du composant doit vivre.
- Bascule d'onglet seule (sans épisode choisi) : vidéo mise en attente (`cueVideoById`) sans lancer la lecture — un changement de livre ne doit pas se substituer à un geste de lecture que l'utilisateur n'a pas demandé.
- Types `@types/youtube` (officiel, ambient, aucun runtime) plutôt que des types maison, pour les mêmes raisons que les autres dépendances : entretenu, standard, sans risque de dériver de l'API réelle.

**Recherche par titre (issue #15)**
- **Fuse.js** (7.5.0, épinglé) pour le flou : `keys: ['title']`, `threshold: 0.3`, `ignoreLocation: true` (titres courts, une correspondance n'importe où vaut autant qu'au début), `minMatchCharLength: 2`. `0.4` (valeur initiale) était trop permissif — retour d'usage : « hea » ramenait 49 résultats sans rapport ; `0.3` est la marge haute d'un plateau `[0.13, 0.3]` mesuré empiriquement contre les 399 vrais titres (docs/qc-recherche-titre.md).
- Index des ~400 titres construit une fois au montage de l'îlot ; la logique (`creerIndexTitres`, `chercherParTitre`) vit dans `site/src/lib/recherche.ts`, testée — SonarCloud n'analyse pas les `.svelte`.
- Requête vide → sommaire du livre actif. Requête non vide → résultats globaux aux 4 livres, chacun étiqueté de son livre (badge). Zéro résultat → message simple (la passerelle #17 s'y branchera).
- Un clic sur un résultat joue le bon épisode ; la bascule d'onglet sur un résultat d'un autre livre est laissée à #18 (l'onglet peut rester sur son livre entre-temps).
- Épisode en cours de lecture (le dernier cliqué) mis en évidence dans le sommaire, repris du même vocabulaire visuel que l'onglet actif (`--accent-voile` / `--accent-fort` + filet `--accent`). Pas de scroll automatique vers lui.

**Recherche et interface**
- Passerelle B→C uniquement après échec de la recherche par titre.
- Les deux modes de recherche (titre + résumé) partent ensemble dès le v1.
- Recherche globale aux quatre livres par défaut.
- Clic sur un résultat de titre = lecture immédiate ; carte de justification réservée au mode résumé.
- Recherche par réplique (section 5) : post-v1, pas au lancement. Index pré-joint par épisode au build, matching tolérant à l'orthographe obligatoire (pas de sous-chaîne exacte), affichage d'un court extrait seulement (jamais la transcription intégrale d'un épisode).

**Stack technique**
- **Règle générale : viser la LTS active** à chaque choix ou épinglage de version — ni la dernière publiée, ni le plancher déclaré par une dépendance. Un `engines: >=X` est une contrainte minimale, pas une recommandation : s'y coller revient à tourner sur la plus vieille ligne encore supportée, donc la première à sortir du support. Épingler une majeure explicite plutôt qu'un alias auto-résolu (`lts/*`), sinon l'arrivée d'une nouvelle LTS décale la CI sans décaler la production. Node est ainsi en **24** (LTS active) en CI comme sur Netlify, et non en 22 (borne d'Astro).
- Front-end : **Astro + Svelte + TypeScript** (issue #13), dans `site/`. TypeScript épinglé en 6.0.3, la version imposée par la chaîne Astro ; la 7 est sortie mais pas encore supportée, à retenter plus tard. Hébergement : **Netlify**, déploiement continu depuis `main`, prévisualisation par PR.
- Recherche sémantique : modèle compact (~25-50 Mo), transformers.js, navigateur.
- Scripts hors-site : Python.

**Direction artistique**
- La DA des maquettes de cadrage est adoptée telle quelle et rapatriée dans le dépôt (`site/src/styles/tokens.css`) : elle vivait jusque-là dans un document externe que le code ignorait, et le squelette du site avait improvisé une palette contradictoire.
- Polices auto-hébergées, jamais chargées depuis un CDN tiers.
- Aucune couleur en dur hors des tokens — vérifié par un test, le CSS ne signalant pas ses fautes de frappe.
- Thème sombre par préférence système **et** par attribut `data-theme` (bascule manuelle possible plus tard sans retoucher les tokens).

**Identité et crédit**
- Nom du site : **Kaamelott - Le Marque-Page de la Relecture**.
- Crédit à Shisheyu : popin de première visite + lien permanent en pied de page.
