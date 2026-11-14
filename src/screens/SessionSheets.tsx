import { useState } from 'react';
import { Icon } from '../components/Icon';
import { RulesForm } from '../components/RulesForm';
import { PlayerDot, Section, Sheet, Stepper, Switch } from '../components/ui';
import { plural, uid } from '../logic/format';
import type { SessionView } from '../logic/session';
import { actions, useAppData } from '../state/store';
import type { Rules, Session } from '../state/types';

/* ---------- Players & seating ---------- */

export function PlayersSheet({ session, view, onClose }: { session: Session; view: SessionView; onClose: () => void }) {
  const data = useAppData();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const seated = session.seating.map((id) => session.players.find((p) => p.id === id)!).filter(Boolean);
  const away = session.players.filter((p) => !session.seating.includes(p.id));
  const idx = (id: string) => session.players.findIndex((p) => p.id === id);
  const update = (fn: (s: Session) => Session) => actions.updateSession(session.id, fn);

  const rename = (id: string, name: string) => update((s) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, name } : p)) }));
  const move = (i: number, dir: -1 | 1) =>
    update((s) => {
      const seating = [...s.seating];
      const j = i + dir;
      if (j < 0 || j >= seating.length) return s;
      [seating[i], seating[j]] = [seating[j], seating[i]];
      return { ...s, seating };
    });
  const leave = (id: string) =>
    update((s) => {
      const hasGames = s.games.some((g) => g.playerIds.includes(id));
      return {
        ...s,
        seating: s.seating.filter((x) => x !== id),
        players: hasGames ? s.players : s.players.filter((p) => p.id !== id),
        nextDealerId: s.nextDealerId === id ? undefined : s.nextDealerId,
      };
    });
  const comeBack = (id: string) => update((s) => ({ ...s, seating: [...s.seating, id] }));
  const add = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (session.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError(`${name} ist schon dabei.`);
      return;
    }
    const id = uid();
    update((s) => ({ ...s, players: [...s.players, { id, name }], seating: [...s.seating, id] }));
    setNewName('');
    setError(null);
  };
  const suggestions = data.knownPlayers.filter((n) => !session.players.some((p) => p.name.toLowerCase() === n.toLowerCase())).slice(0, 8);

  return (
    <Sheet open onClose={onClose} title="Spieler & Sitzordnung" subtitle="Änderungen gelten ab dem nächsten Spiel">
      <Section title="Am Tisch" aside={<span className="section__aside">im Uhrzeigersinn</span>}>
        <ol className="seat-list">
          {seated.map((p, i) => (
            <li key={p.id} className="seat">
              <span className="seat__no">
                <PlayerDot index={idx(p.id)} />
                {i + 1}
              </span>
              <input
                id={`seat-name-${p.id}`}
                className="input seat__input"
                value={p.name}
                maxLength={24}
                onChange={(e) => rename(p.id, e.target.value)}
                onBlur={(e) => !e.target.value.trim() && rename(p.id, `Spieler ${i + 1}`)}
                aria-label={`Name von Platz ${i + 1}`}
              />
              <div className="seat__tools">
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nach oben">
                  <Icon name="up" size={18} />
                </button>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === seated.length - 1} aria-label="Nach unten">
                  <Icon name="down" size={18} />
                </button>
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => leave(p.id)} disabled={seated.length <= 4} aria-label={`${p.name} verlässt den Tisch`} title="Verlässt den Tisch">
                  <Icon name="close" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ol>
        {seated.length <= 4 && <p className="section__hint">Mit 4 Spielern kann niemand den Tisch verlassen.</p>}
      </Section>

      {seated.length < 7 && (
        <Section title="Spieler dazu">
          <form
            className="add-player"
            onSubmit={(e) => {
              e.preventDefault();
              add(newName);
            }}
          >
            <input id="add-player-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" maxLength={24} enterKeyHint="done" />
            <button type="submit" className="btn btn--primary" disabled={!newName.trim()}>
              <Icon name="plus" size={18} /> Dazu
            </button>
          </form>
          {error && <p className="section__hint is-error">{error}</p>}
          {suggestions.length > 0 && (
            <div className="chips">
              {suggestions.map((n) => (
                <button key={n} type="button" className="chip chip--add" onClick={() => add(n)}>
                  <Icon name="plus" size={14} strokeWidth={2.5} /> {n}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {away.length > 0 && (
        <Section title="Nicht mehr am Tisch">
          <ul className="away-list">
            {away.map((p) => (
              <li key={p.id}>
                <PlayerDot index={idx(p.id)} />
                <span>{p.name}</span>
                <button type="button" className="btn btn--text btn--sm" onClick={() => comeBack(p.id)} disabled={seated.length >= 7}>
                  Zurückholen
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Wer gibt als Nächstes?">
        <div className="chips">
          {seated.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={view.next.dealerId === p.id}
              onClick={() => update((s) => ({ ...s, nextDealerId: p.id }))}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="section__hint">Falls am Tisch jemand anderes gibt als der Block denkt.</p>
      </Section>
    </Sheet>
  );
}

/* ---------- Rules ---------- */

export function RulesSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const [rules, setRules] = useState<Rules>(session.rules);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Regeln"
      subtitle="Bereits eingetragene Spiele werden neu berechnet"
      footer={
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              actions.setRules(session.id, rules);
              onClose();
            }}
          >
            Übernehmen
          </button>
        </div>
      }
    >
      <RulesForm rules={rules} onChange={setRules} playerCount={session.seating.length} />
    </Sheet>
  );
}

/* ---------- Bock ---------- */

export function BockSheet({ session, view, onClose }: { session: Session; view: SessionView; onClose: () => void }) {
  const [count, setCount] = useState(1);
  const bock = view.next.bock;
  const pendingManual = session.manualBocks.some((m) => m.beforeGame >= session.games.length);
  const enabled = session.rules.bock.enabled;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Bockrunden"
      subtitle={`Eine Bockrunde = ${view.roundSize} Spiele`}
      footer={
        enabled ? (
          <div className="btn-row">
            <Stepper label="Anzahl Bockrunden" value={count} min={1} max={4} onChange={setCount} format={(v) => plural(v, 'Runde', 'Runden')} />
            <button
              type="button"
              className="btn btn--bock"
              onClick={() => {
                actions.addManualBock(session.id, count);
                onClose();
              }}
            >
              <Icon name="bolt" size={18} /> Auslösen
            </button>
          </div>
        ) : undefined
      }
    >
      {!enabled ? (
        <div className="bock-state">
          <p>Bockrunden sind für diesen Spielabend ausgeschaltet.</p>
          <Switch
            label="Bockrunden einschalten"
            checked={false}
            onChange={() => actions.setRules(session.id, { ...session.rules, bock: { ...session.rules.bock, enabled: true } })}
          />
        </div>
      ) : (
        <div className="bock-state">
          {bock.remainingGames > 0 ? (
            <>
              <p className="bock-state__big">
                <span className="bock-pill">Bock ×{bock.multiplier}</span>
              </p>
              <p>
                Das nächste Spiel zählt {bock.multiplier === 2 ? 'doppelt' : `${bock.multiplier}-fach`}. Noch {plural(bock.remainingGames, 'Bock-Spiel', 'Bock-Spiele')}
                {session.rules.bock.mode === 'overlap' && bock.layers.length > 1 && <> in {bock.layers.length} überlagerten Runden ({bock.layers.join(' + ')} Spiele)</>}.
              </p>
            </>
          ) : (
            <p>Gerade läuft keine Bockrunde.</p>
          )}
          <p className="section__hint">
            {session.rules.bock.mode === 'sequential'
              ? 'Neue Bockrunden werden hinten angehängt.'
              : 'Neue Bockrunden überlagern laufende: zwei gleichzeitig zählen vierfach.'}
          </p>
          {pendingManual && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                actions.removePendingManualBock(session.id);
              }}
            >
              <Icon name="undo" size={18} /> Von Hand ausgelöste Runde zurücknehmen
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Rename ---------- */

export function RenameSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const [name, setName] = useState(session.name);
  const save = () => {
    if (name.trim()) actions.updateSession(session.id, (s) => ({ ...s, name: name.trim() }));
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Umbenennen"
      footer={
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!name.trim()}>
            Speichern
          </button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input id="rename-input" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </form>
    </Sheet>
  );
}
