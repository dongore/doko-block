import type { Ann, Party, Rules } from '../state/types';
import { determineWinner, emptyExtras, scoreCalc } from './scoring';

/** How high the winners won: 0 gewonnen, 1 keine 90, 2 keine 60, 3 keine 30, 4 schwarz. */
export type ResultLevel = 0 | 1 | 2 | 3 | 4;

export const LEVEL_LABEL: Record<ResultLevel, string> = {
  0: 'gewonnen',
  1: 'keine 90',
  2: 'keine 60',
  3: 'keine 30',
  4: 'schwarz',
};

/**
 * Re's Augen split into the bands between all scoring thresholds (30, 60, 90, 120, 121, 151, …).
 * Any value inside one band scores exactly the same, so one representative per band is enough.
 */
const BANDS: { rep: number; lo: number; hi: number }[] = [
  { rep: 0, lo: 0, hi: 0 },
  { rep: 15, lo: 1, hi: 29 },
  { rep: 45, lo: 30, hi: 59 },
  { rep: 75, lo: 60, hi: 89 },
  { rep: 105, lo: 90, hi: 119 },
  { rep: 120, lo: 120, hi: 120 },
  { rep: 135, lo: 121, hi: 150 },
  { rep: 165, lo: 151, hi: 180 },
  { rep: 195, lo: 181, hi: 210 },
  { rep: 225, lo: 211, hi: 239 },
  { rep: 240, lo: 240, hi: 240 },
];

export const TIE_AUGEN = 120;

export function loserLevel(loserAugen: number): ResultLevel {
  if (loserAugen === 0) return 4;
  if (loserAugen < 30) return 3;
  if (loserAugen < 60) return 2;
  if (loserAugen < 90) return 1;
  return 0;
}

export interface ResultOption {
  /** Representative Re Augen to score with. */
  reAugen: number;
  /** The winners' Augen range, e.g. "121–150". */
  label: string;
}

/**
 * All Augen ranges that fit "`winner` won at `level`" under the given announcements, merged where they score the same.
 * Empty: the result contradicts the announcements. More than one: the score depends on the exact range
 * (only when the losers made an Absage, e.g. "120 gegen keine 90"), so the user has to pick.
 */
export function resultOptions(winner: Party, level: ResultLevel, reAnn: Ann, kontraAnn: Ann, solo: boolean, rules: Rules): ResultOption[] {
  const groups = new Map<string, typeof BANDS>();
  for (const b of BANDS) {
    if (b.rep === TIE_AUGEN) continue; // 120 : 120 has its own button
    const c = { reAugen: b.rep, reAnn, kontraAnn, reExtras: emptyExtras(), kontraExtras: emptyExtras() };
    if (determineWinner(c).winner !== winner) continue;
    if (loserLevel(winner === 're' ? 240 - b.rep : b.rep) !== level) continue;
    const r = scoreCalc(c, solo, rules);
    const key = `${r.reValue}|${r.lines.map((l) => l.label + l.party).join(',')}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.values()]
    .map((bands) => {
      const lo = Math.min(...bands.map((b) => b.lo));
      const hi = Math.max(...bands.map((b) => b.hi));
      const [wlo, whi] = winner === 're' ? [lo, hi] : [240 - hi, 240 - lo];
      return { reAugen: bands[0].rep, label: wlo === whi ? `${wlo}` : `${wlo}–${whi}`, wlo };
    })
    .sort((a, b) => a.wlo - b.wlo)
    .map(({ reAugen, label }) => ({ reAugen, label }));
}

/** Text for a game entered by result, e.g. "Re gewinnt keine 90". */
export function resultText(result: { winner: Party | null; level: number }, reLabel: string): string {
  if (!result.winner) return '120 : 120';
  const who = result.winner === 're' ? reLabel : 'Kontra';
  return result.level === 0 ? `${who} gewinnt` : `${who} gewinnt ${LEVEL_LABEL[result.level as ResultLevel]}`;
}
