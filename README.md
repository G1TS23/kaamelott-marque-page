# Kaamelott — Le Marque-Page de la Relecture

[![CI](https://github.com/G1TS23/kaamelott-marque-page/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/G1TS23/kaamelott-marque-page/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/site-kaamelott.falahi.org-BC52EE?style=flat-square&logo=netlify&logoColor=white)](https://kaamelott.falahi.org)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-57f08a?style=flat-square)](./LICENSE)

Un outil non officiel pour naviguer directement à l'épisode voulu dans les lectures-interprétations de Kaamelott par [Shisheyu](https://www.youtube.com/@Shisheyu) sur YouTube — par titre, résumé de scène ou personnage, sans jamais recharger la page.

En prod : **[kaamelott.falahi.org](https://kaamelott.falahi.org)**

Kaamelott et ses dialogues appartiennent à Alexandre Astier et aux ayants droit d'origine. Ce projet n'est affilié ni à Shisheyu ni aux ayants droit de Kaamelott — un immense merci à Shisheyu d'avoir lu l'intégralité des quatre premiers livres, ce projet n'existerait pas sans son travail.

## Comment ça marche

- **Recherche unifiée** (titre, résumé, personnage) sur les ~400 épisodes des 4 livres, résultats dédupliqués et classés par pertinence.
- **Lecteur collant** : reste accessible en réduit pendant qu'on parcourt le sommaire, sans jamais interrompre la lecture en cours.
- **Lien profond partageable** : un bouton copie une URL qui rouvre directement au bon épisode et à la bonne seconde.
- **100 % statique** (Astro + Svelte 5), aucun compte, aucun cookie posé par le site lui-même — voir les [mentions légales](https://kaamelott.falahi.org/mentions-legales).

## Qualité

- 162 tests (Vitest + `@testing-library/svelte`) : logique pure et composants, y compris des vérifications d'accessibilité automatisées (axe-core).
- CI (GitHub Actions) : types, tests, build — statut requis avant tout merge sur `main`.
- Dependabot pour les dépendances npm et les actions du workflow.
- Audit d'accessibilité complet (dialogues, focus, contraste WCAG AA) et headers de sécurité (CSP, etc.).

Le détail de cet audit est dans les issues du dépôt (voir le [Project GitHub](../../projects)).

## Documentation

Les spécifications complètes (besoin, modèle de données, recherche, stack technique, design, feuille de route, décisions prises) sont dans [`docs/SPECS.md`](docs/SPECS.md).

Une version illustrée avec maquettes est publiée ici : https://claude.ai/code/artifact/a4625b48-015b-4354-ab85-5a047ff1b7fa

## Développer

```bash
cd site
npm install
npm run dev       # http://localhost:4321
npm run verify    # tests + vérification des types + build (ce que la CI exécute)
npm run build     # build statique seul -> site/dist/
```

## Créé par

**[Olivier Falahi](https://github.com/G1TS23)** ([olivier@falahi.org](mailto:olivier@falahi.org)) — [portfolio](https://olivier.falahi.org).

Réalisé avec l'assistance de Claude (Anthropic) ; dépendances tenues à jour par Dependabot.

## Licence

[MIT](./LICENSE) sur le code de ce dépôt — **à l'exception du contenu de `data/`** (transcriptions et timestamps dérivés des lectures de Shisheyu et des dialogues de Kaamelott), qui reste soumis aux droits de leurs auteurs respectifs et n'est couvert par aucune licence de ce projet.
