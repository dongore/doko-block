import type { ReactNode } from 'react';
import type { GameResult, ResultLine } from '../logic/scoring';

/**
 * Score lines in the order they are applied: game points, then Re/Kontra doubling (if any),
 * then Sonderpunkte, which are never doubled.
 */
export function Breakdown({ result, reLabel, total }: { result: GameResult; reLabel: string; total?: ReactNode }) {
  const base = result.lines.filter((l) => l.kind !== 'extra');
  const extras = result.lines.filter((l) => l.kind === 'extra');
  const line = (l: ResultLine, i: number) => (
    <li key={i} className={`breakdown__line party-${l.party}`}>
      <span className="breakdown__label">{l.label}</span>
      <span className="breakdown__party">{l.party === 're' ? reLabel : 'Kontra'}</span>
      <span className="breakdown__pts num">+{l.points}</span>
    </li>
  );
  return (
    <ul className="breakdown">
      {base.map(line)}
      {result.factors.map((f) => (
        <li key={f.label} className="breakdown__line breakdown__factor">
          <span className="breakdown__label">{f.label}</span>
          <span className="breakdown__party">verdoppelt</span>
          <span className="breakdown__pts num">×{f.factor}</span>
        </li>
      ))}
      {result.factors.length > 0 && extras.length > 0 && <li className="breakdown__sub">Sonderpunkte, nicht verdoppelt</li>}
      {extras.map(line)}
      {total}
    </ul>
  );
}
