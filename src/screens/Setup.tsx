import { useMemo, useRef, useState } from 'react';
import { navigate } from '../App';
import { Icon } from '../components/Icon';
import { RulesForm, rulesSummary } from '../components/RulesForm';
import { PlayerDot, Section } from '../components/ui';
import { defaultSessionName, uid } from '../logic/format';
import { DEFAULT_RULES } from '../state/defaults';
import { actions, getState, useAppData } from '../state/store';
import type { Rules, Session } from '../state/types';

interface Row {
  key: string;
  name: string;
}

export function Setup({ fromId }: { fromId?: string }) {
  const data = useAppData();
  const from = fromId ? data.sessions.find((s) => s.id === fromId) : undefined;

  const [name, setName] = useState(() => defaultSessionName());
  const [rows, setRows] = useState<Row[]>(() => {
    const names = from ? from.seating.map((id) => from.players.find((p) => p.id === id)?.name ?? '') : [];
    while (names.length < 4) names.push('');
    return names.map((n) => ({ key: uid(), name: n }));
  });
  const [dealerKey, setDealerKey] = useState<string | null>(null);
  const [rules, setRules] = useState<Rules>(() => from?.rules ?? data.lastRules ?? DEFAULT_RULES);
  const [showRules, setShowRules] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const filled = rows.filter((r) => r.name.trim());
  const dupes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of filled) seen.set(r.name.trim().toLowerCase(), (seen.get(r.name.trim().toLowerCase()) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [filled]);
  const suggestions = data.knownPlayers.filter((n) => !rows.some((r) => r.name.trim().toLowerCase() === n.toLowerCase())).slice(0, 12);

  const problem =
    filled.length < 4
      ? `Noch ${4 - filled.length} ${4 - filled.length === 1 ? 'Name fehlt' : 'Namen fehlen'}`
      : dupes.size
        ? 'Jeder Name darf nur einmal vorkommen'
        : null;

  const dealer = filled.find((r) => r.key === dealerKey) ?? filled[0];

  const update = (key: string, nameValue: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, name: nameValue } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (key: string) => setRows((rs) => (rs.length > 4 ? rs.filter((r) => r.key !== key) : rs.map((r) => (r.key === key ? { ...r, name: '' } : r))));
  const addRow = (n = '') => {
    if (rows.length >= 7) return;
    const key = uid();
    setRows((rs) => [...rs, { key, name: n }]);
    if (!n) requestAnimationFrame(() => inputs.current[key]?.focus());
  };
  const addKnown = (n: string) => {
    const empty = rows.find((r) => !r.name.trim());
    if (empty) update(empty.key, n);
    else addRow(n);
  };

  const start = () => {
    setTouched(true);
    if (problem) return;
    const players = filled.map((r) => ({ id: uid(), name: r.name.trim() }));
    const dealerIndex = Math.max(0, filled.findIndex((r) => r.key === dealer?.key));
    const now = Date.now();
    const session: Session = {
      id: uid(),
      name: name.trim() || defaultSessionName(),
      createdAt: now,
      updatedAt: now,
      players,
      seating: players.map((p) => p.id),
      firstDealerId: players[dealerIndex].id,
      rules,
      games: [],
      manualBocks: [],
    };
    actions.createSession(session);
    navigate({ name: 'session', id: session.id, tab: 'block' }, true);
  };

  return (
    <div className="screen setup">
      <header className="appbar">
        <div className="appbar__inner">
          <button type="button" className="icon-btn icon-btn--on-chrome" onClick={() => (history.length > 1 ? history.back() : navigate({ name: 'home' }))} aria-label="Zurück">
            <Icon name="back" />
          </button>
          <h1 className="appbar__title">Neuer Spielabend</h1>
        </div>
      </header>

      <main className="page setup__main">
        <Section title="Name">
          <input id="session-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultSessionName()} enterKeyHint="next" />
        </Section>

        <Section title={`Spieler (${filled.length})`} aside={<span className="section__aside">4 bis 7, in Sitzreihenfolge</span>}>
          <ol className="seat-list">
            {rows.map((r, i) => {
              const dupe = r.name.trim() && dupes.has(r.name.trim().toLowerCase());
              return (
                <li key={r.key} className="seat">
                  <span className="seat__no">
                    <PlayerDot index={i} />
                    {i + 1}
                  </span>
                  <input
                    id={`player-${i}`}
                    ref={(el) => {
                      inputs.current[r.key] = el;
                    }}
                    className={`input seat__input${dupe ? ' is-invalid' : ''}`}
                    value={r.name}
                    placeholder={`Spieler ${i + 1}`}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint={i < rows.length - 1 ? 'next' : 'done'}
                    maxLength={24}
                    onChange={(e) => update(r.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const nextRow = rows[i + 1];
                        if (nextRow) inputs.current[nextRow.key]?.focus();
                        else (e.target as HTMLInputElement).blur();
                      }
                    }}
                    aria-label={`Spieler ${i + 1}`}
                  />
                  <div className="seat__tools">
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nach oben">
                      <Icon name="up" size={18} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Nach unten">
                      <Icon name="down" size={18} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => remove(r.key)} aria-label={rows.length > 4 ? 'Platz entfernen' : 'Name leeren'} disabled={rows.length <= 4 && !r.name}>
                      <Icon name="close" size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {rows.length < 7 && (
            <button type="button" className="btn btn--ghost btn--sm add-seat" onClick={() => addRow()}>
              <Icon name="plus" size={18} /> Spieler hinzufügen
            </button>
          )}
          {suggestions.length > 0 && (
            <div className="known">
              <span className="field__label">Zuletzt dabei</span>
              <div className="chips">
                {suggestions.map((n) => (
                  <button key={n} type="button" className="chip chip--add" onClick={() => addKnown(n)} disabled={filled.length >= 7 && !rows.some((r) => !r.name.trim())}>
                    <Icon name="plus" size={14} strokeWidth={2.5} /> {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {filled.length >= 2 && (
          <Section
            title="Wer gibt zuerst?"
            aside={
              <button
                type="button"
                className="btn btn--text btn--sm"
                onClick={() => setDealerKey(filled[Math.floor(Math.random() * filled.length)].key)}
              >
                <Icon name="dice" size={18} /> Auslosen
              </button>
            }
          >
            <div className="chips">
              {filled.map((r) => (
                <button key={r.key} type="button" className="chip" aria-pressed={dealer?.key === r.key} onClick={() => setDealerKey(r.key)}>
                  {r.name.trim()}
                </button>
              ))}
            </div>
            {filled.length > 4 && (
              <p className="section__hint">
                Bei {filled.length} Spielern {filled.length === 5 ? 'setzt der Geber aus' : 'setzen der Geber und weitere Spieler aus'}. Der Block wechselt automatisch durch.
              </p>
            )}
          </Section>
        )}

        <Section
          title="Regeln"
          aside={
            <button type="button" className="btn btn--text btn--sm" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
              {showRules ? 'Fertig' : 'Anpassen'}
            </button>
          }
        >
          {showRules ? (
            <RulesForm rules={rules} onChange={setRules} playerCount={Math.max(4, filled.length)} />
          ) : (
            <button type="button" className="rules-summary" onClick={() => setShowRules(true)}>
              <span>{rulesSummary(rules)}</span>
              <Icon name="chevron" size={18} />
            </button>
          )}
          {getState().lastRules && !from && !showRules && <p className="section__hint">Regeln vom letzten Spielabend übernommen.</p>}
        </Section>
      </main>

      <div className="bottombar">
        <div className="bottombar__inner">
          {touched && problem && <p className="bottombar__hint">{problem}</p>}
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={start} aria-disabled={!!problem}>
            Spielabend starten
          </button>
        </div>
      </div>
    </div>
  );
}
