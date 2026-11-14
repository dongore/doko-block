import type { Game, Player, PlayerId, Rules, Session } from '../state/types';
import { baseDeltas, scoreGame, type GameResult } from './scoring';

export interface GameView {
  game: Game;
  index: number;
  /** 1-based game number. */
  number: number;
  /** Round the game was dealt in (1-based). */
  round: number;
  /** First game of a new round (for separators). */
  roundStart: boolean;
  result: GameResult;
  multiplier: number;
  /** Bock layers active for this game (sequential mode: 0 or 1). */
  bockLayers: number;
  deltas: Record<PlayerId, number>;
  totals: Record<PlayerId, number>;
  dealerStays: boolean;
}

export interface BockStatus {
  /** Multiplier of the next game. */
  multiplier: number;
  /** Bock games still to play (counting the longest layer in overlap mode). */
  remainingGames: number;
  /** Overlap mode: remaining games per active layer. Sequential: one entry with the queue length. */
  layers: number[];
}

export interface NextGame {
  number: number;
  round: number;
  /** Position of this deal within its round, 1-based. */
  dealInRound: number;
  dealerId: PlayerId;
  playerIds: PlayerId[];
  sittingOut: PlayerId[];
  bock: BockStatus;
}

export interface SessionView {
  games: GameView[];
  totals: Record<PlayerId, number>;
  next: NextGame;
  pflichtDone: Record<PlayerId, boolean>;
  roundsCompleted: number;
  /** All planned rounds are played (only with a planned round count). */
  plannedDone: boolean;
  roundSize: number;
}

/* ---------- seating & dealer ---------- */

export function nextSeated(session: Pick<Session, 'players' | 'seating'>, afterId: PlayerId): PlayerId {
  const { seating, players } = session;
  const i = seating.indexOf(afterId);
  if (i >= 0) return seating[(i + 1) % seating.length];
  // The previous dealer has left the table: continue in original seating order.
  const order = players.map((p) => p.id);
  const j = order.indexOf(afterId);
  if (j >= 0) {
    for (let k = 1; k <= order.length; k++) {
      const id = order[(j + k) % order.length];
      if (seating.includes(id)) return id;
    }
  }
  return seating[0];
}

/** Who plays with the given dealer. Play order starts left of the dealer. */
export function tableFor(seating: PlayerId[], dealerId: PlayerId, mode: Rules['sitOut']) {
  const n = seating.length;
  const d = Math.max(0, seating.indexOf(dealerId));
  const at = (k: number) => seating[(d + k) % n];
  let out: PlayerId[] = [];
  if (n === 5) out = [at(0)];
  else if (n === 6) out = mode === 'opposite' ? [at(0), at(3)] : [at(0), at(5)];
  else if (n >= 7) out = mode === 'opposite' ? [at(0), at(3), at(4)] : [at(0), at(5), at(6)];
  const playing: PlayerId[] = [];
  for (let k = 1; k <= n; k++) {
    const id = at(k);
    if (!out.includes(id) && playing.length < 4) playing.push(id);
  }
  return { playing, out: seating.filter((id) => !playing.includes(id)) };
}

export function dealerStaysAfter(game: Game, rules: Rules): boolean {
  return game.kind === 'solo' && !!game.pflicht && rules.pflichtsolo.enabled && rules.pflichtsolo.dealerStays;
}

/* ---------- Bock ---------- */

class BockTracker {
  private queue = 0;
  private layers: number[] = [];
  constructor(
    private mode: Rules['bock']['mode'],
    private roundSize: number,
  ) {}
  add(rounds: number) {
    if (rounds <= 0) return;
    if (this.mode === 'sequential') this.queue += rounds * this.roundSize;
    else for (let i = 0; i < rounds; i++) this.layers.push(this.roundSize);
  }
  /** Returns the multiplier for the game being played and advances by one game. */
  consume(): { multiplier: number; layers: number } {
    if (this.mode === 'sequential') {
      if (this.queue > 0) {
        this.queue--;
        return { multiplier: 2, layers: 1 };
      }
      return { multiplier: 1, layers: 0 };
    }
    const k = this.layers.length;
    this.layers = this.layers.map((x) => x - 1).filter((x) => x > 0);
    return { multiplier: 2 ** k, layers: k };
  }
  status(): BockStatus {
    if (this.mode === 'sequential') {
      return { multiplier: this.queue > 0 ? 2 : 1, remainingGames: this.queue, layers: this.queue > 0 ? [this.queue] : [] };
    }
    return {
      multiplier: 2 ** this.layers.length,
      remainingGames: this.layers.length ? Math.max(...this.layers) : 0,
      layers: [...this.layers],
    };
  }
}

/* ---------- replay ---------- */

export function computeSession(session: Session): SessionView {
  const { rules } = session;
  const roundSize = Math.max(4, session.seating.length);
  const totals: Record<PlayerId, number> = Object.fromEntries(session.players.map((p) => [p.id, 0]));
  const bock = new BockTracker(rules.bock.mode, roundSize);
  const manual = (i: number) => session.manualBocks.filter((m) => m.beforeGame === i).reduce((s, m) => s + m.count, 0);
  const pflichtDone: Record<PlayerId, boolean> = Object.fromEntries(session.players.map((p) => [p.id, false]));

  let deals = 0;
  let prevRound = 0;
  const games: GameView[] = session.games.map((game, index) => {
    if (rules.bock.enabled) bock.add(manual(index));
    const { multiplier, layers } = rules.bock.enabled ? bock.consume() : { multiplier: 1, layers: 0 };
    const result = scoreGame(game, rules);
    const base = baseDeltas(game, result.reValue);
    const deltas: Record<PlayerId, number> = {};
    for (const id of Object.keys(base)) {
      deltas[id] = base[id] * multiplier;
      totals[id] = (totals[id] ?? 0) + deltas[id];
    }
    const round = Math.floor(deals / roundSize) + 1;
    const roundStart = round !== prevRound;
    prevRound = round;
    const stays = dealerStaysAfter(game, rules);
    if (!stays) deals++;
    if (game.kind === 'solo' && game.pflicht && game.reIds[0]) pflichtDone[game.reIds[0]] = true;
    if (rules.bock.enabled) bock.add(game.bockTriggers.length);
    return {
      game,
      index,
      number: index + 1,
      round,
      roundStart,
      result,
      multiplier,
      bockLayers: layers,
      deltas,
      totals: { ...totals },
      dealerStays: stays,
    };
  });

  if (rules.bock.enabled) bock.add(manual(session.games.length));

  const last = session.games[session.games.length - 1];
  let dealerId: PlayerId;
  if (session.nextDealerId && session.seating.includes(session.nextDealerId)) dealerId = session.nextDealerId;
  else if (!last) dealerId = session.seating.includes(session.firstDealerId) ? session.firstDealerId : session.seating[0];
  else if (dealerStaysAfter(last, rules) && session.seating.includes(last.dealerId)) dealerId = last.dealerId;
  else dealerId = nextSeated(session, last.dealerId);

  const table = tableFor(session.seating, dealerId, rules.sitOut);
  const roundsCompleted = Math.floor(deals / roundSize);
  return {
    games,
    totals,
    pflichtDone,
    roundsCompleted,
    plannedDone: rules.rounds != null && roundsCompleted >= rules.rounds,
    roundSize,
    next: {
      number: session.games.length + 1,
      round: Math.floor(deals / roundSize) + 1,
      dealInRound: (deals % roundSize) + 1,
      dealerId,
      playerIds: table.playing,
      sittingOut: table.out,
      bock: rules.bock.enabled ? bock.status() : { multiplier: 1, remainingGames: 0, layers: [] },
    },
  };
}

/** Players ranked by total, ties share a rank. */
export function ranking(players: Player[], totals: Record<PlayerId, number>) {
  const sorted = [...players].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((p, i) => {
    const score = totals[p.id] ?? 0;
    const rank = score === lastScore ? lastRank : i + 1;
    lastScore = score;
    lastRank = rank;
    return { player: p, score, rank };
  });
}
