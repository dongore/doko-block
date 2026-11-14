import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, normalizeRules } from '../state/defaults';
import { sanitize } from '../state/store';
import type { Game, Rules, Session } from '../state/types';
import { emptyExtras } from './scoring';
import { computeSession, ranking, tableFor } from './session';
import { minimalTransfers, settle } from './money';

const mkSession = (ids: string[], rules: Partial<Rules> = {}): Session => ({
  id: 's',
  name: 'Test',
  createdAt: 0,
  updatedAt: 0,
  players: ids.map((id) => ({ id, name: id.toUpperCase() })),
  seating: [...ids],
  firstDealerId: ids[0],
  rules: { ...DEFAULT_RULES, ...rules },
  games: [],
  manualBocks: [],
});

const quick = (dealerId: string, playerIds: string[], reIds: string[], value: number, extra: Partial<Game> = {}): Game => ({
  id: Math.random().toString(),
  createdAt: 0,
  dealerId,
  playerIds,
  kind: 'normal',
  reIds,
  mode: 'quick',
  quick: { winner: value >= 0 ? 're' : 'kontra', value: Math.abs(value) },
  bockTriggers: [],
  ...extra,
});

describe('table rotation', () => {
  it('lets the dealer sit out with five players', () => {
    expect(tableFor(['a', 'b', 'c', 'd', 'e'], 'c', 'opposite')).toEqual({ playing: ['d', 'e', 'a', 'b'], out: ['c'] });
  });
  it('sits out dealer and opposite with six players', () => {
    expect(tableFor(['a', 'b', 'c', 'd', 'e', 'f'], 'a', 'opposite').out).toEqual(['a', 'd']);
    expect(tableFor(['a', 'b', 'c', 'd', 'e', 'f'], 'a', 'left4').out).toEqual(['a', 'f']);
  });
  it('sits out three with seven players and everyone sits out equally over a round', () => {
    const seats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const count: Record<string, number> = {};
    for (const d of seats) for (const id of tableFor(seats, d, 'opposite').out) count[id] = (count[id] ?? 0) + 1;
    expect(Object.values(count)).toEqual([3, 3, 3, 3, 3, 3, 3]);
  });
});

describe('session replay', () => {
  it('rotates the dealer and sums totals', () => {
    const s = mkSession(['a', 'b', 'c', 'd']);
    s.games.push(quick('a', ['a', 'b', 'c', 'd'], ['a', 'b'], 2));
    s.games.push(quick('b', ['a', 'b', 'c', 'd'], ['a', 'c'], -3));
    const v = computeSession(s);
    expect(v.totals).toEqual({ a: -1, b: 5, c: -5, d: 1 });
    expect(v.next.dealerId).toBe('c');
    expect(v.next.number).toBe(3);
  });

  it('keeps the dealer after a Pflichtsolo and tracks it', () => {
    const s = mkSession(['a', 'b', 'c', 'd']);
    s.games.push(quick('a', ['a', 'b', 'c', 'd'], ['c'], 1, { kind: 'solo', pflicht: true }));
    const v = computeSession(s);
    expect(v.next.dealerId).toBe('a');
    expect(v.pflichtDone.c).toBe(true);
    expect(v.totals.c).toBe(3);
  });

  it('plays a Bockrunde after a trigger (sequential)', () => {
    const s = mkSession(['a', 'b', 'c', 'd']);
    const t = ['a', 'b', 'c', 'd'];
    s.games.push(quick('a', t, ['a', 'b'], 1, { bockTriggers: ['tie120'] }));
    for (let i = 0; i < 5; i++) s.games.push(quick('a', t, ['a', 'b'], 1));
    const v = computeSession(s);
    expect(v.games.map((g) => g.multiplier)).toEqual([1, 2, 2, 2, 2, 1]);
  });

  it('stacks Bock in overlap mode', () => {
    const s = mkSession(['a', 'b', 'c', 'd'], { bock: { ...DEFAULT_RULES.bock, mode: 'overlap' } });
    const t = ['a', 'b', 'c', 'd'];
    s.games.push(quick('a', t, ['a', 'b'], 1, { bockTriggers: ['tie120'] }));
    s.games.push(quick('a', t, ['a', 'b'], 1, { bockTriggers: ['zeroGame'] }));
    for (let i = 0; i < 5; i++) s.games.push(quick('a', t, ['a', 'b'], 1));
    const v = computeSession(s);
    expect(v.games.map((g) => g.multiplier)).toEqual([1, 2, 4, 4, 4, 2, 1]);
  });

  it('applies manual Bock and queues it sequentially', () => {
    const s = mkSession(['a', 'b', 'c', 'd', 'e']);
    s.manualBocks.push({ beforeGame: 0, count: 2 });
    const v = computeSession(s);
    expect(v.next.bock).toEqual({ multiplier: 2, remainingGames: 10, layers: [10] });
  });

  it('ignores Bock when disabled', () => {
    const s = mkSession(['a', 'b', 'c', 'd'], { bock: { ...DEFAULT_RULES.bock, enabled: false } });
    s.games.push(quick('a', ['a', 'b', 'c', 'd'], ['a', 'b'], 1, { bockTriggers: ['tie120'] }));
    s.games.push(quick('b', ['a', 'b', 'c', 'd'], ['a', 'b'], 1));
    expect(computeSession(s).games[1].multiplier).toBe(1);
  });

  it('counts rounds and honours a dealer override', () => {
    const s = mkSession(['a', 'b', 'c', 'd'], { rounds: 1 });
    const t = ['a', 'b', 'c', 'd'];
    for (const d of t) s.games.push(quick(d, t, ['a', 'b'], 1));
    let v = computeSession(s);
    expect(v.roundsCompleted).toBe(1);
    expect(v.plannedDone).toBe(true);
    expect(v.games.filter((g) => g.roundStart).length).toBe(1);
    s.nextDealerId = 'c';
    v = computeSession(s);
    expect(v.next.dealerId).toBe('c');
  });

  it('keeps calc games zero-sum', () => {
    const s = mkSession(['a', 'b', 'c', 'd']);
    s.games.push({
      ...quick('a', ['a', 'b', 'c', 'd'], ['d'], 0, { kind: 'solo' }),
      mode: 'calc',
      calc: { reAugen: 200, reAnn: 1, kontraAnn: 0, reExtras: emptyExtras(), kontraExtras: emptyExtras() },
    });
    const v = computeSession(s);
    expect(Object.values(v.totals).reduce((x, y) => x + y, 0)).toBe(0);
    expect(v.totals.d).toBe(15); // gewonnen, u90, u60, Re = 5 × 3
  });
});

describe('saved data', () => {
  it('maps the old combined "Ansage verloren" switch to Kontra only', () => {
    const legacy = { bock: { enabled: true, mode: 'sequential', triggers: { tie120: true, lostAnnounced: true } } } as never;
    const r = normalizeRules(legacy);
    expect(r.bock.triggers.lostKontra).toBe(true);
    expect(r.bock.triggers.lostRe).toBe(false);
  });
  it('splits stored "lostAnnounced" game triggers by who lost', () => {
    const s = mkSession(['a', 'b', 'c', 'd']);
    const base = { ...quick('a', ['a', 'b', 'c', 'd'], ['a', 'b'], 0), mode: 'calc' as const };
    const ex = { reExtras: emptyExtras(), kontraExtras: emptyExtras() };
    s.games.push({ ...base, calc: { reAugen: 130, reAnn: 0, kontraAnn: 1, ...ex }, bockTriggers: ['lostAnnounced' as never] });
    s.games.push({ ...base, calc: { reAugen: 110, reAnn: 1, kontraAnn: 0, ...ex }, bockTriggers: ['lostAnnounced' as never] });
    const data = sanitize({ sessions: [s] });
    expect(data.sessions[0].games.map((g) => g.bockTriggers)).toEqual([['lostKontra'], ['lostRe']]);
  });
});

describe('ranking & money', () => {
  it('shares ranks on ties', () => {
    const players = ['a', 'b', 'c'].map((id) => ({ id, name: id }));
    expect(ranking(players, { a: 3, b: 5, c: 3 }).map((r) => r.rank)).toEqual([1, 2, 2]);
  });
  it('settles pairwise with few transfers', () => {
    const t = minimalTransfers([
      { id: 'a', cents: 300 },
      { id: 'b', cents: -100 },
      { id: 'c', cents: -200 },
    ]);
    expect(t).toEqual([
      { from: 'c', to: 'a', cents: 200 },
      { from: 'b', to: 'a', cents: 100 },
    ]);
  });
  it('fills the Kasse with the distance to the leader', () => {
    const players = ['a', 'b', 'c'].map((id) => ({ id, name: id }));
    const s = settle(players, { a: 10, b: 4, c: -14 }, { centsPerPoint: 5, mode: 'pot' });
    expect(s.pot).toBe(30 + 120);
  });
});
