import type { Session } from '../state/types';
import { plain, plural } from './format';
import { formatEuro, settle } from './money';
import { ranking, type SessionView } from './session';

/** The evening's result as plain text for messengers; includes the payout only when Abrechnung is on. */
export function resultText(session: Session, view: SessionView): string {
  const ranks = ranking(session.players, view.totals);
  const name = (id: string) => session.players.find((p) => p.id === id)?.name ?? '';
  const width = Math.max(...session.players.map((p) => p.name.length));
  const lines = [
    `${session.name}`,
    `${plural(view.games.length, 'Spiel', 'Spiele')}${view.roundsCompleted ? `, ${plural(view.roundsCompleted, 'Runde', 'Runden')}` : ''}`,
    '',
    ...ranks.map((r) => `${r.rank}. ${r.player.name.padEnd(width)}  ${plain(r.score)}`),
  ];
  const money = session.rules.money;
  if (money.enabled) {
    const s = settle(session.players, view.totals, money);
    lines.push('', `Abrechnung (${money.centsPerPoint} ct pro Punkt):`);
    if (money.mode === 'pot') {
      for (const b of s.balances) if (b.cents < 0) lines.push(`${name(b.id)} zahlt ${formatEuro(-b.cents)} in die Kasse`);
      lines.push(`Kasse: ${formatEuro(s.pot)}`);
    } else if (s.transfers.length === 0) lines.push('Niemand muss etwas zahlen.');
    else for (const t of s.transfers) lines.push(`${name(t.from)} → ${name(t.to)}: ${formatEuro(t.cents)}`);
  }
  lines.push('', 'Gezählt mit Doko-Block');
  return lines.join('\n');
}
