import { describe, expect, it } from 'vitest';

import { formaterTemps, formaterTempsEcoule } from './temps.ts';

describe('formaterTemps', () => {
  it("affiche l'heure même à zéro, les vidéos faisant toutes plus de six heures", () => {
    expect(formaterTemps(0)).toBe('0:00:00');
  });

  it('complète les minutes et les secondes sur deux chiffres', () => {
    expect(formaterTemps(65)).toBe('0:01:05');
  });

  it('passe correctement aux heures', () => {
    expect(formaterTemps(3600)).toBe('1:00:00');
    expect(formaterTemps(3661)).toBe('1:01:01');
  });

  it('tient sur toute la durée réelle des vidéos (plus de six heures)', () => {
    // 6h31min16s : durée du Livre 1
    expect(formaterTemps(23476)).toBe('6:31:16');
  });

  it('tronque les fractions de seconde plutôt que de les arrondir', () => {
    // Les timestamps du pipeline ont des décimales (ex. 224.9) : arrondir
    // ferait afficher une seconde qui n'est pas encore atteinte, et un saut
    // vers l'épisode arriverait après son début.
    expect(formaterTemps(224.9)).toBe('0:03:44');
  });
});

describe('formaterTempsEcoule', () => {
  it("n'affiche jamais l'heure, contrairement à formaterTemps", () => {
    expect(formaterTempsEcoule(0)).toBe('0:00');
    expect(formaterTempsEcoule(65)).toBe('1:05');
  });

  it('ne plafonne pas les minutes à 59 : un épisode peut dépasser une heure', () => {
    expect(formaterTempsEcoule(3661)).toBe('61:01');
  });

  it('tronque les fractions de seconde comme formaterTemps', () => {
    expect(formaterTempsEcoule(64.9)).toBe('1:04');
  });

  it('ne descend jamais sous 0:00 (position juste avant le début de l’épisode)', () => {
    expect(formaterTempsEcoule(-0.4)).toBe('0:00');
  });
});
