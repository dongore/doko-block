import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../state/defaults';
import type { Ann, CalcInput, Game } from '../state/types';
import { baseDeltas, detectBockTriggers, determineWinner, emptyExtras, scoreCalc, scoreGame } from './scoring';

const calc = (reAugen: number, reAnn: Ann = 0, kontraAnn: Ann = 0, extra?: Partial<CalcInput>): CalcInput => ({
  reAugen,
  reAnn,
  kontraAnn,
  reExtras: emptyExtras(),
  kontraExtras: emptyExtras(),
  ...extra,
});
const R = DEFAULT_RULES;
const score = (c: CalcInput, solo = false) => scoreCalc(c, solo, R).reValue;

describe('winner', () => {
  it('needs 121 for Re without announcements', () => {
    expect(determineWinner(calc(121)).winner).toBe('re');
    expect(determineWinner(calc(120)).winner).toBe('kontra');
  });
  it('lets Re win with 120 if only Kontra announced', () => {
    expect(determineWinner(calc(120, 0, 1)).winner).toBe('re');
    expect(determineWinner(calc(120, 1, 1)).winner).toBe('kontra');
    expect(determineWinner(calc(120, 1, 0)).winner).toBe('kontra');
  });
  it('requires an Absage to be fulfilled', () => {
    expect(determineWinner(calc(151, 2)).winner).toBe('re');
    expect(determineWinner(calc(150, 2)).winner).toBe('kontra');
    expect(determineWinner(calc(89, 0, 2)).winner).toBe('kontra');
    expect(determineWinner(calc(90, 0, 2)).winner).toBe('re');
    expect(determineWinner(calc(240, 5)).winner).toBe('re');
    expect(determineWinner(calc(239, 5)).winner).toBe('kontra');
  });
  it('has no winner when both miss their Absage', () => {
    expect(determineWinner(calc(130, 2, 2)).winner).toBe(null);
  });
});

describe('game value', () => {
  it('scores a plain win as 1', () => {
    expect(score(calc(121))).toBe(1);
    expect(score(calc(119))).toBe(-2); // Kontra: gewonnen + gegen die Alten
  });
  it('counts unter 90 / 60 / 30 / schwarz', () => {
    expect(score(calc(151))).toBe(2);
    expect(score(calc(181))).toBe(3);
    expect(score(calc(211))).toBe(4);
    expect(score(calc(240))).toBe(5);
  });
  it('adds 2 per Re/Kontra announcement', () => {
    expect(score(calc(130, 1))).toBe(3);
    expect(score(calc(130, 1, 1))).toBe(5);
    expect(score(calc(110, 1, 1))).toBe(-6); // Kontra wins 1 + 2 + 2 + gegen die Alten
  });
  it('adds 1 per Absage and points against Absagen', () => {
    // Re: keine 90, fulfilled with 160: gewonnen, unter 90, Re, keine 90 = 5
    expect(score(calc(160, 2))).toBe(5);
    // Re: keine 90, Kontra gets 125: Kontra wins: gewonnen, Re 2, keine 90 1, 120 gegen keine 90 1, gegen die Alten 1 = 6
    expect(score(calc(115, 2))).toBe(-6);
    // Re: keine 60, Kontra gets 70: gewonnen, Re 2, k90 1, k60 1, gegen die Alten 1 = 6
    expect(score(calc(170, 3))).toBe(-6);
  });
  it('nets Sonderpunkte regardless of winner', () => {
    const c = calc(125, 0, 0, {
      reExtras: { fuchs: 0, doppelkopf: 0, karlchen: 0 },
      kontraExtras: { fuchs: 1, doppelkopf: 1, karlchen: 0 },
    });
    expect(score(c)).toBe(-1); // Re +1, Kontra +2
  });
  it('ignores Sonderpunkte and gegen die Alten in a solo', () => {
    const c = calc(100, 0, 0, { kontraExtras: { fuchs: 2, doppelkopf: 1, karlchen: 1 } });
    expect(score(c, true)).toBe(-1);
  });
  it('respects disabled extras', () => {
    const rules = { ...R, extras: { fuchs: false, doppelkopf: true, karlchen: true, gegenDieAlten: false } };
    const c = calc(110, 0, 0, { kontraExtras: { fuchs: 1, doppelkopf: 0, karlchen: 0 } });
    expect(scoreCalc(c, false, rules).reValue).toBe(-1);
  });
});

const game = (over: Partial<Game>): Game => ({
  id: 'g',
  createdAt: 0,
  dealerId: 'a',
  playerIds: ['a', 'b', 'c', 'd'],
  kind: 'normal',
  reIds: ['a', 'b'],
  mode: 'calc',
  calc: calc(121),
  bockTriggers: [],
  ...over,
});

describe('deltas', () => {
  it('splits a normal game ± value', () => {
    expect(baseDeltas(game({}), 3)).toEqual({ a: 3, b: 3, c: -3, d: -3 });
  });
  it('triples a solo for the soloist', () => {
    expect(baseDeltas(game({ kind: 'solo', reIds: ['c'] }), -2)).toEqual({ c: -6, a: 2, b: 2, d: 2 });
  });
  it('scores quick entries', () => {
    const g = game({ mode: 'quick', calc: undefined, quick: { winner: 'kontra', value: 4 } });
    expect(scoreGame(g, R).reValue).toBe(-4);
  });
});

describe('bock triggers', () => {
  it('detects 120:120, lost announcement and Nullspiel', () => {
    const g = game({ calc: calc(120, 1) });
    expect(detectBockTriggers(g, scoreGame(g, R), R)).toEqual(['tie120', 'lostAnnounced']);
    const z = game({
      calc: calc(121, 0, 0, { kontraExtras: { fuchs: 1, doppelkopf: 0, karlchen: 0 } }),
    });
    expect(detectBockTriggers(z, scoreGame(z, R), R)).toEqual(['zeroGame']);
  });
  it('detects a lost solo only when enabled', () => {
    const g = game({ kind: 'solo', reIds: ['a'], calc: calc(100) });
    expect(detectBockTriggers(g, scoreGame(g, R), R)).toEqual([]);
    const rules = { ...R, bock: { ...R.bock, triggers: { ...R.bock.triggers, lostSolo: true } } };
    expect(detectBockTriggers(g, scoreGame(g, rules), rules)).toEqual(['lostSolo']);
  });
});
