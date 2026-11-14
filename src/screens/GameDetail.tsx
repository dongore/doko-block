import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/ui';
import { signed } from '../logic/format';
import { gameTitle } from '../logic/labels';
import { ABSAGE_LABEL, partyName, TRIGGER_LABEL } from '../logic/scoring';
import { resultText } from '../logic/resultEntry';
import type { GameView } from '../logic/session';
import type { Ann, Session } from '../state/types';

const annText = (a: Ann, party: 're' | 'kontra') => (a === 0 ? '—' : a === 1 ? partyName(party) : ABSAGE_LABEL[a]);

export function GameDetailSheet({
  gv,
  session,
  onClose,
  onEdit,
  onDelete,
}: {
  gv: GameView | null;
  session: Session;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  if (!gv) return null;
  const { game, result } = gv;
  const name = (id: string) => session.players.find((p) => p.id === id)?.name ?? '?';
  const solo = game.kind === 'solo';
  const reLabel = solo ? 'Solist' : 'Re';
  const value = Math.abs(result.reValue);
  const kontraIds = game.playerIds.filter((id) => !game.reIds.includes(id));
  const sittingOut = session.players.filter((p) => !game.playerIds.includes(p.id) && gv.totals[p.id] !== undefined && session.seating.includes(p.id));

  return (
    <Sheet
      open
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title={`Spiel ${gv.number}`}
      subtitle={`Runde ${gv.round} · ${name(game.dealerId)} hat gegeben`}
      footer={
        confirm ? (
          <div className="btn-row">
            <span className="btn-row__text">Spiel {gv.number} wirklich löschen?</span>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>
              Nein
            </button>
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Löschen
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> Löschen
            </button>
            <button type="button" className="btn btn--primary" onClick={onEdit}>
              <Icon name="edit" size={18} /> Bearbeiten
            </button>
          </div>
        )
      }
    >
      <div className="detail">
        <div className="detail__headline">
          <span className="detail__kind">
            {gameTitle(game)}
            {solo && game.pflicht && <span className="tag">Pflicht</span>}
            {game.mode === 'quick' && <span className="tag">Schnell</span>}
          </span>
          <span className={`detail__winner party-${result.winner ?? 'none'}`}>
            {result.winner == null ? 'Kein Gewinner' : solo ? (result.winner === 're' ? 'Solo gewonnen' : 'Solo verloren') : `${partyName(result.winner)} gewinnt`}
          </span>
          <span className="detail__value num">
            {value} {value === 1 ? 'Punkt' : 'Punkte'}
            {gv.multiplier > 1 && <span className="bock-pill bock-pill--sm">Bock ×{gv.multiplier}</span>}
          </span>
        </div>

        <dl className="facts">
          <div>
            <dt className="party-re">{reLabel}</dt>
            <dd>{game.reIds.map(name).join(' & ')}</dd>
          </div>
          <div>
            <dt className="party-kontra">Kontra</dt>
            <dd>{kontraIds.map(name).join(', ')}</dd>
          </div>
          {sittingOut.length > 0 && (
            <div>
              <dt>Ausgesetzt</dt>
              <dd>{sittingOut.map((p) => p.name).join(', ')}</dd>
            </div>
          )}
          {game.calc && (
            <>
              {game.calc.result ? (
                <div>
                  <dt>Ergebnis</dt>
                  <dd>{resultText(game.calc.result, reLabel)}</dd>
                </div>
              ) : (
                <div>
                  <dt>Augen</dt>
                  <dd className="num">
                    {reLabel} {game.calc.reAugen} : {240 - game.calc.reAugen} Kontra
                  </dd>
                </div>
              )}
              <div>
                <dt>Ansagen</dt>
                <dd>
                  {reLabel}: {annText(game.calc.reAnn, 're')} · Kontra: {annText(game.calc.kontraAnn, 'kontra')}
                </dd>
              </div>
            </>
          )}
          {gv.dealerStays && (
            <div>
              <dt>Geber</dt>
              <dd>{name(game.dealerId)} hat danach noch einmal gegeben</dd>
            </div>
          )}
          {game.bockTriggers.length > 0 && (
            <div>
              <dt className="bock-text">Bock ausgelöst</dt>
              <dd>{game.bockTriggers.map((t) => TRIGGER_LABEL[t]).join(', ')}</dd>
            </div>
          )}
        </dl>

        {result.note && <p className="result__note">{result.note}</p>}

        {game.mode === 'calc' && result.lines.length > 0 && (
          <ul className="breakdown">
            {result.lines.map((l, i) => (
              <li key={i} className={`breakdown__line party-${l.party}`}>
                <span className="breakdown__label">{l.label}</span>
                <span className="breakdown__party">{l.party === 're' ? reLabel : 'Kontra'}</span>
                <span className="breakdown__pts num">+{l.points}</span>
              </li>
            ))}
            {result.factors.map((f) => (
              <li key={f.label} className="breakdown__line breakdown__factor">
                <span className="breakdown__label">{f.label}</span>
                <span className="breakdown__party">verdoppelt</span>
                <span className="breakdown__pts num">×{f.factor}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="deltas">
          {game.playerIds.map((id) => {
            const v = gv.deltas[id] ?? 0;
            return (
              <div key={id} className={`delta ${v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : ''}`}>
                <span className="delta__name">{name(id)}</span>
                <span className="delta__val num">{signed(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
