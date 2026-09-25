# Changelog

Toutes les évolutions notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et
le versionnage [SemVer](https://semver.org/lang/fr/) (dans l'esprit — ce
n'est pas une bibliothèque publiée, les versions marquent des jalons du
site, pas une compatibilité d'API).

## [Non publié]

## [1.0.0] — 2026-09-25

Première version stable : le site est fonctionnellement complet, testé
(unitaire, composant, end-to-end, accessibilité) et son pipeline de
déploiement fiabilisé.

### Ajouté

- Recherche unifiée par titre, résumé de scène ou personnage sur les ~400
  épisodes des 4 livres, résultats dédupliqués et classés par pertinence.
- Instance unique de lecteur vidéo (API IFrame YouTube) partagée entre le
  sommaire et la recherche, avec écran-titre léger (facade) avant toute
  lecture pour ne charger le script YouTube qu'à la demande.
- Lecteur collant : reste visible en réduit pendant le scroll une fois une
  lecture réellement engagée, sans jamais interrompre l'écoute en cours.
- Mini-timeline, contrôles de transport (précédent/suivant, lecture/pause)
  et lien profond partageable vers un épisode précis.
- Bascule d'onglet découplée de la lecture en cours : changer de livre ne
  coupe jamais une vidéo en train de jouer, quel que soit son livre
  d'origine.
- Sommaire avec lignes dépliables (résumé, personnages, lien Wikipédia) et
  recherche mobile plein écran avec historique des recherches récentes.
- Popin de première visite, panneau de mentions légales, pied de page avec
  crédit à Shisheyu et à l'auteur.
- SEO : sitemap, `robots.txt`, données structurées JSON-LD, meta
  OpenGraph/Twitter Card, favicon.
- Pipeline de données : extraction et alignement automatisés des timestamps
  d'épisodes depuis les lectures-interprétations de Shisheyu sur YouTube,
  garde-fous de cohérence et outil de pointage manuel pour corriger les
  trous restants.

### Qualité et stabilisation

- Suite de tests composants (Vitest + `@testing-library/svelte`) couvrant
  les 10 composants Svelte du site.
- Suite end-to-end Playwright ciblée sur le lecteur collant et la bascule
  d'onglet, remplaçant la QC manuelle documentée à la main.
- Audit d'accessibilité automatisé (axe-core) dans le pipeline de test,
  plus plusieurs correctifs : retour du focus au déclencheur à la fermeture
  des dialogues, contraste, `<label>` sur le champ de recherche mobile.
- Headers de sécurité (CSP, X-Frame-Options, etc.), Dependabot, script
  `npm run verify` unifié, CI/CD fiabilisée (version Node alignée entre CI
  et production, protection de branche avec statuts requis).

### Écosystème

- README réécrit, licence MIT sur le code (hors `data/`), ajout du projet
  au portfolio personnel et au README de profil GitHub de l'auteur.
