import type { Ann, AutoTrigger, BockTrigger, CalcInput, Extras, Game, Party, PlayerId, Rules } from '../state/types';

/** One line of the score breakdown. Points always count for `party`. */
export interface ResultLine {
  label: string;
  party: Party;
  points: number;
  kind: 'base' | 'ansage' | 'absage' | 'extra';
}

export interface GameResult {
  winner: Party | null;
  /** Net game value from the Re party's point of view (negative when Kontra comes out ahead). */
  reValue: number;
  lines: ResultLine[];
  /** Why the winner won, in words (e.g. thresholds that applied). */
  note?: string;
}

export const ANN_SHORT: Record<Ann, string> = {
  0: '–',
  1: '',
  2: 'k. 90',
  3: 'k. 60',
  4: 'k. 30',
  5: 'schwarz',
};

export const ABSAGE_LABEL: Record<number, string> = {
  2: 'keine 90',
  3: 'keine 60',
  4: 'keine 30',
  5: 'schwarz',
};

export const partyName = (p: Party) => (p === 're' ? 'Re' : 'Kontra');
export const other = (p: Party): Party => (p === 're' ? 'kontra' : 're');

export const emptyExtras = (): Extras => ({ fuchs: 0, doppelkopf: 0, karlchen: 0 });

export const isSoloKind = (kind: Game['kind']) => kind === 'solo';

/** Did the party with Absage level `a` keep the opponents below the promised mark? */
function absageFulfilled(a: Ann, oppAugen: number): boolean {
  switch (a) {
    case 2:
      return oppAugen < 90;
    case 3:
      return oppAugen < 60;
    case 4:
      return oppAugen < 30;
    case 5:
      return oppAugen === 0;
    default:
      return true;
  }
}

/** The "Augen gegen Absage" thresholds: reaching them against the opponents' Absage earns a point each. */
const AGAINST: { level: Ann; augen: number; label: string }[] = [
  { level: 2, augen: 120, label: '120 gegen keine 90' },
  { level: 3, augen: 90, label: '90 gegen keine 60' },
  { level: 4, augen: 60, label: '60 gegen keine 30' },
  { level: 5, augen: 30, label: '30 gegen schwarz' },
];

export function determineWinner(c: CalcInput): { winner: Party | null; note?: string } {
  const re = c.reAugen;
  const ko = 240 - re;
  let reWins: boolean;
  let koWins: boolean;
  let note: string | undefined;

  if (c.reAnn >= 2) {
    reWins = absageFulfilled(c.reAnn, ko);
  } else if (c.kontraAnn >= 2) {
    reWins = !absageFulfilled(c.kontraAnn, re);
  } else {
    const need = c.kontraAnn === 1 && c.reAnn === 0 ? 120 : 121;
    reWins = re >= need;
    if (need === 120 && re === 120) note = 'Nur Kontra angesagt: Re gewinnt mit 120 Augen.';
  }

  if (c.kontraAnn >= 2) {
    koWins = absageFulfilled(c.kontraAnn, re);
  } else if (c.reAnn >= 2) {
    koWins = !absageFulfilled(c.reAnn, ko);
  } else {
    koWins = !reWins;
  }

  if (reWins && koWins) {
    // Cannot happen with consistent input; prefer the party that fulfilled its own Absage.
    koWins = false;
  }
  if (!reWins && !koWins) {
    return { winner: null, note: 'Beide Parteien haben ihre Absage verfehlt: kein Gewinner.' };
  }
  return { winner: reWins ? 're' : 'kontra', note };
}

/**
 * Scores one game according to the DDV Turnierspielregeln:
 * gewonnen, unter 90/60/30/schwarz, Re/Kontra (+2 each), each Absage (+1),
 * Augen gegen Absagen, plus Sonderpunkte (normal games only).
 */
export function scoreCalc(c: CalcInput, solo: boolean, rules: Rules): GameResult {
  const { winner, note } = determineWinner(c);
  const lines: ResultLine[] = [];
  const augen: Record<Party, number> = { re: c.reAugen, kontra: 240 - c.reAugen };
  const ann: Record<Party, Ann> = { re: c.reAnn, kontra: c.kontraAnn };

  if (!winner) {
    // TSR 7.1.3: nobody won, but "unter 90/60/30 gespielt" still counts for the side whose opponents stayed below.
    for (const p of ['re', 'kontra'] as Party[]) {
      const oa = augen[other(p)];
      if (oa < 90) lines.push({ label: 'Unter 90 gespielt', party: p, points: 1, kind: 'base' });
      if (oa < 60) lines.push({ label: 'Unter 60 gespielt', party: p, points: 1, kind: 'base' });
      if (oa < 30) lines.push({ label: 'Unter 30 gespielt', party: p, points: 1, kind: 'base' });
    }
  }

  if (winner) {
    const loser = other(winner);
    const la = augen[loser];
    lines.push({ label: 'Gewonnen', party: winner, points: 1, kind: 'base' });
    if (la < 90) lines.push({ label: 'Unter 90 gespielt', party: winner, points: 1, kind: 'base' });
    if (la < 60) lines.push({ label: 'Unter 60 gespielt', party: winner, points: 1, kind: 'base' });
    if (la < 30) lines.push({ label: 'Unter 30 gespielt', party: winner, points: 1, kind: 'base' });
    if (la === 0) lines.push({ label: 'Schwarz gespielt', party: winner, points: 1, kind: 'base' });
    if (ann.re >= 1) lines.push({ label: 'Re angesagt', party: winner, points: 2, kind: 'ansage' });
    if (ann.kontra >= 1) lines.push({ label: 'Kontra angesagt', party: winner, points: 2, kind: 'ansage' });
    for (const p of ['re', 'kontra'] as Party[]) {
      for (let lvl = 2; lvl <= ann[p]; lvl++) {
        lines.push({ label: `${partyName(p)}: ${ABSAGE_LABEL[lvl]} abgesagt`, party: winner, points: 1, kind: 'absage' });
      }
    }
  }

  // Augen reached against the opponents' Absagen.
  for (const p of ['re', 'kontra'] as Party[]) {
    const opp = other(p);
    for (const a of AGAINST) {
      if (ann[opp] >= a.level && augen[p] >= a.augen) {
        lines.push({ label: a.label, party: p, points: 1, kind: 'absage' });
      }
    }
  }

  if (!solo) {
    if (winner === 'kontra' && rules.extras.gegenDieAlten) {
      lines.push({ label: 'Gegen die Alten', party: 'kontra', points: 1, kind: 'extra' });
    }
    const ex: Record<Party, Extras> = { re: c.reExtras, kontra: c.kontraExtras };
    for (const p of ['re', 'kontra'] as Party[]) {
      if (rules.extras.fuchs && ex[p].fuchs > 0)
        lines.push({ label: ex[p].fuchs > 1 ? `${ex[p].fuchs} Füchse gefangen` : 'Fuchs gefangen', party: p, points: ex[p].fuchs, kind: 'extra' });
      if (rules.extras.doppelkopf && ex[p].doppelkopf > 0)
        lines.push({ label: ex[p].doppelkopf > 1 ? `${ex[p].doppelkopf} Doppelköpfe` : 'Doppelkopf', party: p, points: ex[p].doppelkopf, kind: 'extra' });
      if (rules.extras.karlchen && ex[p].karlchen > 0)
        lines.push({ label: 'Karlchen', party: p, points: ex[p].karlchen, kind: 'extra' });
    }
  }

  const reValue = lines.reduce((s, l) => s + (l.party === 're' ? l.points : -l.points), 0);
  return { winner, reValue, lines, note };
}

export function scoreGame(game: Game, rules: Rules): GameResult {
  const solo = isSoloKind(game.kind);
  if (game.mode === 'calc' && game.calc) return scoreCalc(game.calc, solo, rules);
  const q = game.quick ?? { winner: null, value: 0 };
  const v = Math.max(0, Math.round(q.value));
  if (!q.winner || v === 0) return { winner: q.winner ?? null, reValue: 0, lines: [] };
  return {
    winner: q.winner,
    reValue: q.winner === 're' ? v : -v,
    lines: [{ label: 'Spielwert', party: q.winner, points: v, kind: 'base' }],
  };
}

/** Points per player before Bock. Every game sums to zero. */
export function baseDeltas(game: Game, reValue: number): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  const others = game.playerIds.filter((id) => !game.reIds.includes(id));
  // 2 vs 2: ±value each. 1 vs 3 (Solo): the single player wins or pays three times.
  const factor = game.reIds.length ? others.length / game.reIds.length : 0;
  for (const id of game.reIds) out[id] = reValue * factor;
  for (const id of others) out[id] = -reValue;
  return out;
}

/** Which Bock triggers this result would fire under the given rules. */
export function detectBockTriggers(game: Game, result: GameResult, rules: Rules): BockTrigger[] {
  if (!rules.bock.enabled) return [];
  const t = rules.bock.triggers;
  const out: BockTrigger[] = [];
  const solo = isSoloKind(game.kind);
  const c = game.mode === 'calc' ? game.calc : undefined;
  if (t.tie120 && c?.reAugen === 120) out.push('tie120');
  if (t.lostKontra && c && c.kontraAnn >= 1 && result.winner !== 'kontra') out.push('lostKontra');
  if (t.lostRe && c && c.reAnn >= 1 && result.winner !== 're') out.push('lostRe');
  if (t.lostSolo && solo && result.winner !== 're') out.push('lostSolo');
  if (t.zeroGame && result.reValue === 0) out.push('zeroGame');
  return out;
}

export const AUTO_TRIGGERS: AutoTrigger[] = ['tie120', 'lostKontra', 'lostRe', 'lostSolo', 'zeroGame'];

export const TRIGGER_LABEL: Record<BockTrigger | 'lostAnnounced', string> = {
  tie120: '120 : 120',
  lostKontra: 'Kontra verloren',
  lostRe: 'Re verloren',
  lostAnnounced: 'Ansage verloren',
  lostSolo: 'Solo verloren',
  zeroGame: 'Nullspiel',
  manual: 'Von Hand',
};
