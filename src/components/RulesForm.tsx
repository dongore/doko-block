import type { Rules } from '../state/types';
import { formatEuro } from '../logic/money';
import { Section, Segmented, Stepper, Switch } from './ui';

const RATES = [1, 2, 5, 10, 20, 50];

export function RulesForm({ rules, onChange, playerCount }: { rules: Rules; onChange: (r: Rules) => void; playerCount: number }) {
  const set = (patch: Partial<Rules>) => onChange({ ...rules, ...patch });
  const ex = rules.extras;
  const bock = rules.bock;
  const trig = bock.triggers;

  return (
    <div className="rules">
      <Section title="Sonderpunkte" className="rules__group">
        <p className="section__hint">Gelten nur im Normalspiel, nicht im Solo.</p>
        <Switch label="Fuchs gefangen" hint="Karo-Ass der Gegenpartei im eigenen Stich" checked={ex.fuchs} onChange={(v) => set({ extras: { ...ex, fuchs: v } })} />
        <Switch label="Doppelkopf" hint="Stich mit mindestens 40 Augen" checked={ex.doppelkopf} onChange={(v) => set({ extras: { ...ex, doppelkopf: v } })} />
        <Switch label="Karlchen" hint="Kreuz-Bube gewinnt den letzten Stich" checked={ex.karlchen} onChange={(v) => set({ extras: { ...ex, karlchen: v } })} />
        <Switch label="Gegen die Alten" hint="+1, wenn Kontra ein Normalspiel gewinnt" checked={ex.gegenDieAlten} onChange={(v) => set({ extras: { ...ex, gegenDieAlten: v } })} />
      </Section>

      <Section title="Bockrunden" className="rules__group">
        <Switch label="Mit Bockrunden spielen" hint="Im Bock zählt jedes Spiel doppelt" checked={bock.enabled} onChange={(v) => set({ bock: { ...bock, enabled: v } })} />
        {bock.enabled && (
          <>
            <p className="section__hint">Automatisch auslösen nach …</p>
            <Switch label="120 : 120" hint="Gleichstand der Augen" checked={trig.tie120} onChange={(v) => set({ bock: { ...bock, triggers: { ...trig, tie120: v } } })} />
            <Switch label="Kontra verloren" hint="„Kontra“ angesagt und das Spiel nicht gewonnen" checked={trig.lostKontra} onChange={(v) => set({ bock: { ...bock, triggers: { ...trig, lostKontra: v } } })} />
            <Switch label="Re verloren" hint="„Re“ angesagt und das Spiel nicht gewonnen" checked={trig.lostRe} onChange={(v) => set({ bock: { ...bock, triggers: { ...trig, lostRe: v } } })} />
            <Switch label="Solo verloren" checked={trig.lostSolo} onChange={(v) => set({ bock: { ...bock, triggers: { ...trig, lostSolo: v } } })} />
            <Switch label="Nullspiel" hint="Spielwert 0, z. B. durch Sonderpunkte" checked={trig.zeroGame} onChange={(v) => set({ bock: { ...bock, triggers: { ...trig, zeroGame: v } } })} />
            <p className="section__hint">Bockrunden kannst du außerdem jederzeit von Hand auslösen. Eine Bockrunde dauert so viele Spiele, wie Spieler am Tisch sitzen.</p>
            <div className="field">
              <span className="field__label">Mehrere Bockrunden</span>
              <Segmented
                label="Mehrere Bockrunden"
                value={bock.mode}
                onChange={(mode) => set({ bock: { ...bock, mode } })}
                options={[
                  { value: 'sequential', label: 'Nacheinander (×2)' },
                  { value: 'overlap', label: 'Überlagern (×4 …)' },
                ]}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Pflichtsolo" className="rules__group">
        <Switch label="Pflichtsoli verfolgen" hint="Zeigt, wer sein Pflichtsolo noch spielen muss" checked={rules.pflichtsolo.enabled} onChange={(v) => set({ pflichtsolo: { ...rules.pflichtsolo, enabled: v } })} />
        {rules.pflichtsolo.enabled && (
          <Switch
            label="Geber gibt nach Pflichtsolo erneut"
            hint="Das Pflichtsolo zählt nicht als Spiel der Runde"
            checked={rules.pflichtsolo.dealerStays}
            onChange={(v) => set({ pflichtsolo: { ...rules.pflichtsolo, dealerStays: v } })}
          />
        )}
      </Section>

      <Section title={rules.pflichtsolo.enabled ? 'Lustsolo' : 'Solo'} className="rules__group">
        <Switch
          label={rules.pflichtsolo.enabled ? 'Geber gibt nach Lustsolo erneut' : 'Geber gibt nach Solo erneut'}
          hint="Der Solist kommt raus. Saß er ohnehin links vom Geber, wechselt der Geber normal."
          checked={rules.lustsolo.dealerStays}
          onChange={(v) => set({ lustsolo: { dealerStays: v } })}
        />
      </Section>

      {playerCount >= 6 && (
        <Section title={`Aussetzen bei ${playerCount} Spielern`} className="rules__group">
          <Segmented
            label="Wer setzt aus"
            value={rules.sitOut}
            onChange={(sitOut) => set({ sitOut })}
            options={[
              { value: 'opposite', label: 'Geber + Gegenüber' },
              { value: 'left4', label: 'Vier links vom Geber' },
            ]}
          />
        </Section>
      )}

      <Section title="Spieldauer" className="rules__group">
        <div className="field field--row">
          <Segmented
            label="Spieldauer"
            value={rules.rounds == null ? 'open' : 'fixed'}
            onChange={(v) => set({ rounds: v === 'open' ? null : (rules.rounds ?? 6) })}
            options={[
              { value: 'open', label: 'Offen' },
              { value: 'fixed', label: 'Feste Runden' },
            ]}
          />
          {rules.rounds != null && (
            <Stepper label="Runden" value={rules.rounds} min={1} max={30} onChange={(rounds) => set({ rounds })} format={(v) => `${v} Runden`} />
          )}
        </div>
        {rules.rounds != null && (
          <p className="section__hint">
            {rules.rounds} Runden = {rules.rounds * playerCount} Spiele bei {playerCount} Spielern, ohne Pflichtsoli.
          </p>
        )}
      </Section>

      <Section title="Abrechnung" className="rules__group">
        <div className="field">
          <span className="field__label">Betrag pro Punkt</span>
          <div className="chips">
            {RATES.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                aria-pressed={rules.money.centsPerPoint === c}
                onClick={() => set({ money: { ...rules.money, centsPerPoint: c } })}
              >
                {c} ct
              </button>
            ))}
            {!RATES.includes(rules.money.centsPerPoint) && (
              <span className="chip" aria-pressed="true">
                {formatEuro(rules.money.centsPerPoint)}
              </span>
            )}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Abrechnen</span>
          <Segmented
            label="Abrechnungsart"
            value={rules.money.mode}
            onChange={(mode) => set({ money: { ...rules.money, mode } })}
            options={[
              { value: 'pairwise', label: 'Untereinander' },
              { value: 'pot', label: 'In die Kasse' },
            ]}
          />
          <p className="section__hint">
            {rules.money.mode === 'pairwise'
              ? 'Wer im Minus ist, zahlt an die Spieler im Plus: Punkte × Betrag.'
              : 'Jeder zahlt seinen Abstand zum Ersten in die Kasse, z. B. für den nächsten Ausflug.'}
          </p>
        </div>
      </Section>
    </div>
  );
}

export function rulesSummary(r: Rules): string {
  const parts: string[] = [];
  const ex = [r.extras.fuchs && 'Fuchs', r.extras.doppelkopf && 'Doppelkopf', r.extras.karlchen && 'Karlchen'].filter(Boolean);
  parts.push(ex.length ? ex.join(', ') : 'ohne Sonderpunkte');
  parts.push(r.bock.enabled ? `Bock ${r.bock.mode === 'overlap' ? 'überlagernd' : 'nacheinander'}` : 'ohne Bock');
  if (r.pflichtsolo.enabled) parts.push('Pflichtsolo');
  parts.push(r.rounds ? `${r.rounds} Runden` : 'offenes Ende');
  parts.push(`${r.money.centsPerPoint} ct/Punkt`);
  return parts.join(' · ');
}
