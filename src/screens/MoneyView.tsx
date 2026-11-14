import { Icon } from '../components/Icon';
import { PlayerDot, Segmented, useToast } from '../components/ui';
import { plain } from '../logic/format';
import { formatEuro, settle } from '../logic/money';
import type { SessionView } from '../logic/session';
import { resultText } from '../logic/shareText';
import { actions } from '../state/store';
import type { Session } from '../state/types';
import { shareText } from '../components/share';

const RATES = [1, 2, 5, 10, 20, 50];

export function MoneyView({ session, view }: { session: Session; view: SessionView }) {
  const toast = useToast();
  const money = session.rules.money;
  const s = settle(session.players, view.totals, money);
  const name = (id: string) => session.players.find((p) => p.id === id)?.name ?? '';
  const idx = (id: string) => session.players.findIndex((p) => p.id === id);
  const setMoney = (patch: Partial<typeof money>) => actions.setRules(session.id, { ...session.rules, money: { ...money, ...patch } });
  const balances = [...s.balances].sort((a, b) => b.cents - a.cents);

  const share = async () => {
    const r = await shareText(session.name, resultText(session, view));
    if (r === 'copied') toast('Ergebnis kopiert');
    if (r === 'failed') toast('Teilen ist hier nicht möglich');
  };

  return (
    <div className="page money">
      <section className="card">
        <div className="field">
          <span className="field__label">Betrag pro Punkt</span>
          <div className="chips">
            {RATES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={money.centsPerPoint === c} onClick={() => setMoney({ centsPerPoint: c })}>
                {c} ct
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Abrechnen</span>
          <Segmented
            label="Abrechnungsart"
            value={money.mode}
            onChange={(mode) => setMoney({ mode })}
            options={[
              { value: 'pairwise', label: 'Untereinander' },
              { value: 'pot', label: 'In die Kasse' },
            ]}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">{money.mode === 'pot' ? 'Einzahlungen' : 'Bilanz'}</h2>
        <ul className="balances">
          {balances.map((b) => (
            <li key={b.id} className="balance">
              <PlayerDot index={idx(b.id)} />
              <span className="balance__name">{name(b.id)}</span>
              <span className="balance__pts num">{plain(view.totals[b.id] ?? 0)} P.</span>
              <span className={`balance__amt num ${b.cents > 0 ? 'is-pos' : b.cents < 0 ? 'is-neg' : ''}`}>
                {b.cents === 0 ? '–' : money.mode === 'pot' ? formatEuro(-b.cents) : `${b.cents > 0 ? '+' : '−'}${formatEuro(Math.abs(b.cents))}`}
              </span>
            </li>
          ))}
        </ul>
        {money.mode === 'pot' && (
          <p className="pot">
            In die Kasse: <strong className="num">{formatEuro(s.pot)}</strong>
          </p>
        )}
      </section>

      {money.mode === 'pairwise' && (
        <section className="card">
          <h2 className="card__title">Wer zahlt wem?</h2>
          {s.transfers.length === 0 ? (
            <p className="muted">Niemand muss etwas zahlen.</p>
          ) : (
            <ul className="transfers">
              {s.transfers.map((t, i) => (
                <li key={i} className="transfer">
                  <span className="transfer__from">{name(t.from)}</span>
                  <span className="transfer__arrow" aria-label="zahlt an">
                    →
                  </span>
                  <span className="transfer__to">{name(t.to)}</span>
                  <strong className="transfer__amt num">{formatEuro(t.cents)}</strong>
                </li>
              ))}
            </ul>
          )}
          <p className="section__hint">So wenige Überweisungen wie möglich.</p>
        </section>
      )}

      <button type="button" className="btn btn--ghost btn--block" onClick={share} disabled={view.games.length === 0}>
        <Icon name="share" size={18} /> Ergebnis teilen
      </button>
    </div>
  );
}
