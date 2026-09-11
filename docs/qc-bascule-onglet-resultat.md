# Bascule d'onglet sur un résultat cross-livre (issue #18)

## Méthode

Suite directe de #15 : `onEpisodeClick` (`Site.svelte`) fixe désormais
`livreActif = livre` avant de jouer l'épisode, quel que soit le livre du
résultat cliqué. Pas de `choisirLivre` supplémentaire — `allerA` charge déjà
la bonne vidéo à la bonne position, peu importe ce que le lecteur affichait.

Une seule ligne ajoutée : l'essentiel du travail était déjà fait par #15
(porter le livre de chaque résultat, propager le livre au clic).

## Vérifié sur la preview locale

- Recherche « table » depuis l'onglet Livre 1 → résultats « La Table de
  Breccan » (Livre 1) et « L'Art de la table » (Livre 4).
- Clic sur « L'Art de la table » → l'onglet bascule sur **Livre 4**, le
  sous-titre confirme « Allez, c'est parti. Épisode 33. », la ligne du
  résultat est mise en évidence.
- Recherche effacée → sommaire du **Livre 4**, épisode 33 toujours mis en
  évidence.

## Limites connues

Aucune nouvelle — celles de #15 s'appliquent toujours (lecture non
vérifiable en navigateur automatisé, seule la position de chargement l'est).
