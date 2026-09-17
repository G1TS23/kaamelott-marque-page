import { describe, expect, it } from 'vitest';

import { bornesEpisode, ratioDepuisSecondes, secondesDepuisRatio } from './timeline.ts';

const episodes = [{ start_seconds: 0 }, { start_seconds: 600 }, { start_seconds: 1500 }];

describe('bornesEpisode', () => {
  it("borne haute = début de l'épisode suivant", () => {
    expect(bornesEpisode(episodes, 0, 99999)).toEqual({ basse: 0, haute: 600 });
    expect(bornesEpisode(episodes, 1, 99999)).toEqual({ basse: 600, haute: 1500 });
  });

  it('borne haute = durée de la vidéo pour le dernier épisode du livre', () => {
    expect(bornesEpisode(episodes, 2, 23476)).toEqual({ basse: 1500, haute: 23476 });
  });
});

describe('ratioDepuisSecondes', () => {
  const bornes = { basse: 600, haute: 1500 };

  it('0 au début, 1 à la fin', () => {
    expect(ratioDepuisSecondes(600, bornes)).toBe(0);
    expect(ratioDepuisSecondes(1500, bornes)).toBe(1);
  });

  it('proportionnel au milieu', () => {
    expect(ratioDepuisSecondes(1050, bornes)).toBe(0.5);
  });

  it("borne le résultat même en cas de dépassement (l'épisode suivant pas encore détecté)", () => {
    expect(ratioDepuisSecondes(1600, bornes)).toBe(1);
    expect(ratioDepuisSecondes(500, bornes)).toBe(0);
  });

  it('renvoie 0 sans diviser par zéro quand les bornes ne sont pas encore connues', () => {
    expect(ratioDepuisSecondes(600, { basse: 600, haute: 600 })).toBe(0);
    expect(ratioDepuisSecondes(600, { basse: 600, haute: 0 })).toBe(0);
  });
});

describe('secondesDepuisRatio', () => {
  const bornes = { basse: 600, haute: 1500 };

  it('bornes aux extrémités', () => {
    expect(secondesDepuisRatio(0, bornes)).toBe(600);
    expect(secondesDepuisRatio(1, bornes)).toBe(1500);
  });

  it('proportionnel au milieu', () => {
    expect(secondesDepuisRatio(0.5, bornes)).toBe(1050);
  });

  it("ne dépasse jamais les bornes de l'épisode, même pour un ratio hors [0, 1]", () => {
    expect(secondesDepuisRatio(1.5, bornes)).toBe(1500);
    expect(secondesDepuisRatio(-0.5, bornes)).toBe(600);
  });
});
