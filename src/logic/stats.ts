import type { PlayerId, Session } from '../state/types';
import type { SessionView } from './session';

export interface PlayerStats {
  id: PlayerId;
  total: number;
  played: number;
  won: number;
  lost: number;
  sittingOut: number;
  reGames: number;
  reWon: number;
  kontraGames: number;
  kontraWon: number;
  solos: number;
  solosWon: number;
  announcements: number;
  best: number;
  worst: number;
  bockGames: number;
}

export function playerStats(session: Session, view: SessionView): PlayerStats[] {
  return session.players.map((p) => {
    const s: PlayerStats = {
      id: p.id,
      total: view.totals[p.id] ?? 0,
      played: 0,
      won: 0,
      lost: 0,
      sittingOut: 0,
      reGames: 0,
      reWon: 0,
      kontraGames: 0,
      kontraWon: 0,
      solos: 0,
      solosWon: 0,
      announcements: 0,
      best: 0,
      worst: 0,
      bockGames: 0,
    };
    for (const g of view.games) {
      const { game, result } = g;
      if (!game.playerIds.includes(p.id)) {
        s.sittingOut++;
        continue;
      }
      s.played++;
      const d = g.deltas[p.id] ?? 0;
      if (d > 0) s.won++;
      if (d < 0) s.lost++;
      s.best = Math.max(s.best, d);
      s.worst = Math.min(s.worst, d);
      if (g.multiplier > 1) s.bockGames++;
      const isRe = game.reIds.includes(p.id);
      const solo = game.kind === 'solo';
      if (solo && isRe) {
        s.solos++;
        if (result.winner === 're') s.solosWon++;
      } else if (!solo) {
        if (isRe) {
          s.reGames++;
          if (result.winner === 're') s.reWon++;
        } else {
          s.kontraGames++;
          if (result.winner === 'kontra') s.kontraWon++;
        }
      }
      if (game.mode === 'calc' && game.calc) {
        const ann = isRe ? game.calc.reAnn : game.calc.kontraAnn;
        if (ann >= 1) s.announcements++;
      }
    }
    return s;
  });
}

export interface Highlights {
  biggestGame?: { number: number; value: number };
  bockGames: number;
  solos: number;
  reWins: number;
  kontraWins: number;
}

export function highlights(view: SessionView): Highlights {
  let biggest: Highlights['biggestGame'];
  let bockGames = 0;
  let solos = 0;
  let reWins = 0;
  let kontraWins = 0;
  for (const g of view.games) {
    const value = Math.max(0, ...Object.values(g.deltas).map((d) => Math.abs(d)));
    if (!biggest || value > biggest.value) biggest = { number: g.number, value };
    if (g.multiplier > 1) bockGames++;
    if (g.game.kind === 'solo') solos++;
    else if (g.result.winner === 're') reWins++;
    else if (g.result.winner === 'kontra') kontraWins++;
  }
  return { biggestGame: biggest, bockGames, solos, reWins, kontraWins };
}
