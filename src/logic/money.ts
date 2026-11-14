import type { Player, PlayerId, Rules } from '../state/types';

export interface Transfer {
  from: PlayerId;
  to: PlayerId;
  cents: number;
}

export interface Settlement {
  /** Per player: positive = receives, negative = pays. */
  balances: { id: PlayerId; cents: number }[];
  transfers: Transfer[];
  /** Pot mode: total paid into the Kasse. */
  pot: number;
}

/** Fewest-ish transfers: always match the biggest debtor with the biggest creditor. */
export function minimalTransfers(balances: { id: PlayerId; cents: number }[]): Transfer[] {
  const debt = balances.filter((b) => b.cents < 0).map((b) => ({ ...b, cents: -b.cents }));
  const cred = balances.filter((b) => b.cents > 0).map((b) => ({ ...b }));
  const out: Transfer[] = [];
  debt.sort((a, b) => b.cents - a.cents);
  cred.sort((a, b) => b.cents - a.cents);
  while (debt.length && cred.length) {
    const d = debt[0];
    const c = cred[0];
    const amt = Math.min(d.cents, c.cents);
    if (amt > 0) out.push({ from: d.id, to: c.id, cents: amt });
    d.cents -= amt;
    c.cents -= amt;
    if (d.cents === 0) debt.shift();
    if (c.cents === 0) cred.shift();
    debt.sort((a, b) => b.cents - a.cents);
    cred.sort((a, b) => b.cents - a.cents);
  }
  return out;
}

export function settle(players: Player[], totals: Record<PlayerId, number>, money: Rules['money']): Settlement {
  const rate = money.centsPerPoint;
  if (money.mode === 'pot') {
    const best = Math.max(...players.map((p) => totals[p.id] ?? 0));
    const balances = players.map((p) => ({ id: p.id, cents: -Math.round((best - (totals[p.id] ?? 0)) * rate) }));
    return { balances, transfers: [], pot: balances.reduce((s, b) => s - b.cents, 0) };
  }
  const balances = players.map((p) => ({ id: p.id, cents: Math.round((totals[p.id] ?? 0) * rate) }));
  return { balances, transfers: minimalTransfers(balances), pot: 0 };
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const formatEuro = (cents: number) => euro.format(cents / 100);
