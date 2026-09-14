import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fous du design system (issue #51).
 *
 * Le CSS échoue en silence : un `var(--acccent)` mal orthographié ne casse
 * rien, il rend juste l'élément transparent ou noir, et personne ne le voit
 * avant de regarder la page dans le bon thème. Ces tests transforment ces
 * fautes silencieuses en échec de CI.
 */

const DOSSIER_STYLES = fileURLToPath(new URL('.', import.meta.url));
const DOSSIER_SRC = fileURLToPath(new URL('..', import.meta.url));

const tokensCss = readFileSync(join(DOSSIER_STYLES, 'tokens.css'), 'utf8');

/** Tous les fichiers de `src/` qui portent du CSS. */
function fichiersDeStyle(): string[] {
  return readdirSync(DOSSIER_SRC, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(css|astro|svelte)$/.test(f))
    .map((f) => join(DOSSIER_SRC, f));
}

/** Noms des variables déclarées (`--x: …`) dans un morceau de CSS. */
function declarees(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/(--[\w-]+)\s*:/g), (m) => m[1]));
}

/** Noms des variables consommées (`var(--x)`) dans un morceau de CSS. */
function consommees(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/var\(\s*(--[\w-]+)/g), (m) => m[1]));
}

/**
 * Déclarations `--x: valeur` d'un bloc, normalisées et triées — de quoi
 * comparer deux blocs sans que leur indentation ou leur ordre n'interfère.
 */
function paires(css: string): string[] {
  return Array.from(css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (m) =>
    `${m[1]}: ${m[2].replace(/\s+/g, ' ').trim()}`,
  ).sort();
}

/**
 * Corps d'un bloc CSS désigné par son sélecteur exact.
 *
 * Suffisant ici : nos blocs n'imbriquent rien, la première accolade fermante
 * termine donc bien le bloc.
 */
function bloc(selecteur: string): string {
  const debut = tokensCss.indexOf(selecteur);
  expect(debut, `bloc \`${selecteur}\` introuvable dans tokens.css`).toBeGreaterThan(-1);
  const ouvrante = tokensCss.indexOf('{', debut);
  const fermante = tokensCss.indexOf('}', ouvrante);
  return tokensCss.slice(ouvrante + 1, fermante);
}

const BLOC_CLAIR = bloc(':root {');
const BLOC_PREFERENCE_SYSTEME = bloc(":root:not([data-theme='light'])");
const BLOC_ATTRIBUT = bloc(":root[data-theme='dark']");

describe('tokens.css', () => {
  it('déclare la palette claire et les alias sombres dans le même bloc racine', () => {
    const noms = declarees(BLOC_CLAIR);
    expect(noms.has('--fond')).toBe(true);
    expect(noms.has('--sombre-fond')).toBe(true);
    expect(noms.has('--police-titre')).toBe(true);
  });

  it("n'expose aucun alias sombre sans équivalent clair", () => {
    const noms = declarees(BLOC_CLAIR);
    const orphelins = [...noms]
      .filter((n) => n.startsWith('--sombre-'))
      .map((n) => n.replace('--sombre-', '--'))
      .filter((clair) => !noms.has(clair));

    expect(orphelins).toEqual([]);
  });

  it('applique exactement la même palette dans les deux bascules sombres', () => {
    // Les deux portes d'entrée du thème sombre — préférence système et
    // attribut explicite — doivent rester interchangeables : une couleur
    // remappée dans l'une seulement donnerait deux thèmes sombres différents.
    expect(paires(BLOC_ATTRIBUT)).toEqual(paires(BLOC_PREFERENCE_SYSTEME));
  });

  it('remappe tous les alias sombres, et rien d’autre', () => {
    const alias = [...declarees(BLOC_CLAIR)].filter((n) => n.startsWith('--sombre-'));
    const attendus = alias.map((n) => n.replace('--sombre-', '--')).sort();

    expect([...declarees(BLOC_ATTRIBUT)].sort()).toEqual(attendus);
    expect([...consommees(BLOC_ATTRIBUT)].sort()).toEqual([...alias].sort());
  });
});

describe('usage des tokens dans le site', () => {
  it('ne consomme aucune variable non déclarée', () => {
    const disponibles = declarees(tokensCss);
    const inconnues = new Map<string, string[]>();

    for (const fichier of fichiersDeStyle()) {
      const contenu = readFileSync(fichier, 'utf8');
      // Une variable posée par le composant lui-même (ex. une mesure JS
      // passée en style inline, `style="--x: {valeur}px"`) n'est pas un
      // token du design system à surveiller ici — seule une variable qui
      // n'existe ni dans tokens.css ni dans son propre fichier est
      // suspecte (typo d'un vrai token).
      const disponiblesIci = new Set([...disponibles, ...declarees(contenu)]);
      for (const nom of consommees(contenu)) {
        if (!disponiblesIci.has(nom)) {
          inconnues.set(nom, [...(inconnues.get(nom) ?? []), fichier]);
        }
      }
    }

    expect(Object.fromEntries(inconnues)).toEqual({});
  });

  it('ne code aucune couleur en dur hors de tokens.css', () => {
    // Une couleur écrite dans un composant échappe au thème sombre : elle
    // restera claire sur fond sombre. Les tokens sont le seul endroit où une
    // valeur de couleur a le droit d'apparaître.
    const fautifs = fichiersDeStyle()
      .filter((f) => !f.endsWith('tokens.css'))
      .flatMap((fichier) => {
        const couleurs = readFileSync(fichier, 'utf8').match(
          /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi,
        );
        return couleurs ? [`${fichier} → ${couleurs.join(', ')}`] : [];
      });

    expect(fautifs).toEqual([]);
  });
});
