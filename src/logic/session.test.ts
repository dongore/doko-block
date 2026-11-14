import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, normalizeRules } from '../state/defaults';
import { sanitize } from '../state/store';
import type { Game, Rules, Session } from '../state/types';
import { emptyExtras } from './scoring';
import { computeSession, ranking, tableFor } from './session';
import { minimalTransfers, settle } from './money';
import { resultText } from './shareText';

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
  it('always lets the dealer sit out with 5 or more players, in both variants', () => {
    for (const n of [5, 6, 7]) {
      const seats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].slice(0, n);
      for (const mode of ['opposite', 'left4'] as const) {
        for (const dealer of seats) {
          const t = tableFor(seats, dealer, mode);
          expect(t.out).toContain(dealer);
          expect(t.playing).toHaveLength(4);
          expect(t.playing).not.toContain(dealer);
        }
      }
    }
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

  it('has Pflichtsolo tracking and Abrechnung off by default', () => {
    expect(DEFAULT_RULES.pflichtsolo.enabled).toBe(false);
    expect(DEFAULT_RULES.money.enabled).toBe(false);
  });

  it('names who leads the next game: the first player at the table left of the dealer', () => {
    const four = mkSession(['a', 'b', 'c', 'd']);
    expect(computeSession(four).next).toMatchObject({ dealerId: 'a', leaderId: 'b' });
    const five = mkSession(['a', 'b', 'c', 'd', 'e']);
    five.firstDealerId = 'e';
    expect(computeSession(five).next).toMatchObject({ dealerId: 'e', leaderId: 'a' });
    const six = mkSession(['a', 'b', 'c', 'd', 'e', 'f'], { sitOut: 'left4' });
    six.nextDealerId = 'c';
    expect(computeSession(six).next).toMatchObject({ dealerId: 'c', leaderId: 'd' });
  });

  it('keeps the dealer after a Pflichtsolo and tracks it', () => {
    const s = mkSession(['a', 'b', 'c', 'd'], { pflichtsolo: { enabled: true, dealerStays: true } });
    s.games.push(quick('a', ['a', 'b', 'c', 'd'], ['c'], 1, { kind: 'solo', pflicht: true }));
    const v = computeSession(s);
    expect(v.next.dealerId).toBe('a');
    expect(v.pflichtDone.c).toBe(true);
    expect(v.totals.c).toBe(3);
  });

  describe('Lustsolo: dealer deals again unless the soloist would have led anyway', () => {
    const t = ['a', 'b', 'c', 'd'];
    const lust = (dealer: string, table: string[], soloist: string, extra: Partial<Game> = {}) =>
      quick(dealer, table, [soloist], 1, { kind: 'solo', pflicht: false, ...extra });
    it('keeps the dealer when someone else than the left neighbour plays solo', () => {
      const s = mkSession(t);
      s.games.push(lust('a', t, 'c'));
      expect(computeSession(s).next.dealerId).toBe('a');
      expect(computeSession(s).games[0].dealerStays).toBe(true);
    });
    it('moves on when the left neighbour of the dealer plays solo', () => {
      const s = mkSession(t);
      s.games.push(lust('a', t, 'b'));
      expect(computeSession(s).next.dealerId).toBe('b');
    });
    it('skips sitting-out players when finding who leads', () => {
      const five = ['a', 'b', 'c', 'd', 'e'];
      const s = mkSession(five);
      s.games.push(lust('a', ['b', 'c', 'd', 'e'], 'b'));
      expect(computeSession(s).next.dealerId).toBe('b');
      const s2 = mkSession(five);
      s2.games.push(lust('a', ['b', 'c', 'd', 'e'], 'd'));
      expect(computeSession(s2).next.dealerId).toBe('a');
    });
    it('can be switched off and ignores a Stille Hochzeit', () => {
      const off = mkSession(t, { lustsolo: { dealerStays: false } });
      off.games.push(lust('a', t, 'c'));
      expect(computeSession(off).next.dealerId).toBe('b');
      const still = mkSession(t);
      still.games.push(lust('a', t, 'c', { soloType: 'stille-hochzeit' }));
      expect(computeSession(still).next.dealerId).toBe('b');
    });
    it('repeats only for the first solo of each player per round', () => {
      const s = mkSession(t);
      s.games.push(lust('a', t, 'c')); // Carla's first solo: a deals again
      s.games.push(lust('a', t, 'd')); // David's first solo: a deals again
      s.games.push(lust('a', t, 'c')); // Carla's second solo this round: dealer moves on
      const v = computeSession(s);
      expect(v.games.map((g) => g.dealerStays)).toEqual([true, true, false]);
      expect(v.next.dealerId).toBe('b');
    });
    it('counts a solo by the player who leads anyway as the first one', () => {
      const s = mkSession(t);
      s.games.push(lust('a', t, 'b')); // Ben leads anyway: dealer moves on to b
      s.games.push(lust('b', t, 'b', {})); // Ben again, now not leading: still his second solo this round
      expect(computeSession(s).games.map((g) => g.dealerStays)).toEqual([false, false]);
    });
    it('allows a repeat again in the next round', () => {
      const s = mkSession(t);
      s.games.push(lust('a', t, 'c'));
      for (const d of t) s.games.push(quick(d, t, ['a', 'b'], 1));
      s.games.push(lust('a', t, 'c'));
      const v = computeSession(s);
      expect(v.games.map((g) => g.dealerStays)).toEqual([true, false, false, false, false, true]);
      expect(v.games[5].round).toBe(2);
    });
    it('always repeats after a Pflichtsolo, even by the left neighbour (DDV 4.2.5)', () => {
      const s = mkSession(t, { pflichtsolo: { enabled: true, dealerStays: true } });
      s.games.push(quick('a', t, ['b'], 1, { kind: 'solo', pflicht: true }));
      expect(computeSession(s).next.dealerId).toBe('a');
    });
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
  it('switches Pflichtsolo off once in the rules carried over to the next evening', () => {
    const on = { ...DEFAULT_RULES, pflichtsolo: { enabled: true, dealerStays: true } };
    expect(sanitize({ sessions: [], lastRules: on }).lastRules?.pflichtsolo.enabled).toBe(false);
    // Once migrated, a later choice to switch it back on is kept.
    expect(sanitize({ sessions: [], lastRules: on, defaultsRev: 1 }).lastRules?.pflichtsolo.enabled).toBe(true);
  });
  it('switches Abrechnung off once in the carried-over rules, keeping running evenings as they are', () => {
    const on = { ...DEFAULT_RULES, money: { ...DEFAULT_RULES.money, enabled: true } };
    const running = { ...mkSession(['a', 'b', 'c', 'd']), rules: on };
    const data = sanitize({ sessions: [running], lastRules: on, defaultsRev: 1 });
    expect(data.lastRules?.money.enabled).toBe(false);
    expect(data.sessions[0].rules.money.enabled).toBe(true);
    expect(sanitize({ sessions: [], lastRules: on, defaultsRev: 2 }).lastRules?.money.enabled).toBe(true);
  });
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
  it('leaves the payout out of the shared result when Abrechnung is off', () => {
    const s = mkSession(['a', 'b', 'c', 'd'], { money: { ...DEFAULT_RULES.money, enabled: true } });
    s.games.push(quick('a', ['a', 'b', 'c', 'd'], ['a', 'b'], 2));
    expect(resultText(s, computeSession(s))).toContain('Abrechnung (5 ct pro Punkt)');
    const off = { ...s, rules: { ...s.rules, money: { ...s.rules.money, enabled: false } } };
    const text = resultText(off, computeSession(off));
    expect(text).not.toContain('Abrechnung');
    expect(text).toContain('1. A');
  });
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
    const s = settle(players, { a: 10, b: 4, c: -14 }, { enabled: true, centsPerPoint: 5, mode: 'pot' });
    expect(s.pot).toBe(30 + 120);
  });
});
