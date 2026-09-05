# Contrôle qualité — facette personnages (issue #24)

Vérification manuelle du champ `characters` calculé par `scripts/build_characters.py` + `scripts/extract_characters.py`.

## Méthode

1. **Construction de la liste canonique** (`data/characters.json`) depuis [Liste des personnages de Kaamelott](https://fr.wikipedia.org/wiki/Liste_des_personnages_de_Kaamelott) — 6 catégories retenues (principal, récurrent, gratin, notable, mythologie, grouillot), 2 exclues (Rome - Livre VI, personnages du film — hors des livres I-IV).
2. **Nom court** dérivé du nom complet Wikipédia (ex. « Yvain, le chevalier au Lion » → « Yvain ») par découpage sur la virgule ou un premier mot-connecteur descriptif, avec une petite liste d'exceptions vérifiées contre les vrais invités déjà extraits (ex. « Le maître d'armes », « La Dame du Lac » sont les noms tels qu'utilisés, pas des titres à raccourcir).
3. **Calcul de `characters` par épisode** : fusion de `guests` (parsing du personnage après le dernier « : ») et de tout nom canonique détecté par mot entier (insensible à la casse) dans `summary`.
4. **Relecture manuelle** de tous les noms courts (≤ 4 caractères, risque de collision le plus élevé) avec leur contexte réel dans les résumés où ils matchent.

## Résultat

| Vérification | Résultat |
|---|---|
| Personnages canoniques extraits | 97 (2 entrées sans nom exploitable écartées : « Les cousins de Perceval », « Le neveu de Karadoc », « Le prisonnier des romains ») |
| Épisodes avec ≥ 1 personnage détecté | 396 / 399 (99/100, 99/100, 99/100, 99/99) |
| Épisodes sans personnage détecté | 3 — vérifiés manuellement : résumés génériques sans nom propre (« les chevaliers », « quiconque », « paysans »), comportement attendu (non-exhaustif par construction) |
| Faux positif trouvé | **1** — « Lan » (grouillot) matchait le prénom de l'acteur « Lan Truong » dans le résumé de s1e05 (« Attila, joué par Lan Truong »), sans rapport avec le personnage. Exclu du matching texte (reste valide comme source `guests`). |
| Noms courts revérifiés (Kay, Keu, Anna, Belt, Hoël, Sven, Loth) | Tous corrects après relecture du contexte — y compris un cas amusant où « Kay » est cité intentionnellement dans le résumé de s3e07 (jeu de mots sur le nom breton de Caius). |
| Exemple vérifié (section 8 de l'artifact) | Arthur + Léodagan + Guenièvre ensemble : 4 épisodes sur 100 au Livre 1 (s1e02, s1e11, s1e13, s1e45) — recalculé et confirmé identique via le champ `characters` final. |

## Limites connues

- Le découpage du nom court depuis le nom complet Wikipédia repose sur une liste de connecteurs + une petite table d'exceptions (7 entrées) — un futur ajout de personnage sur la page Wikipédia avec un nom composé inhabituel pourrait nécessiter une nouvelle exception.
- Un seul nom exclu du matching texte à ce jour (« Lan ») ; d'autres collisions possibles avec de futurs noms d'acteurs cités dans des résumés, à surveiller au fil de l'eau plutôt que garanti à 100 %.
- Les catégories Gratin/Notables/Mythologie/Grouillots ne sont pas spécifiques aux livres I-IV sur la page Wikipédia — certains noms de la liste canonique peuvent ne jamais apparaître dans les 399 résumés (harmless : ils existent dans `characters.json` mais ne sont simplement jamais sélectionnés).
