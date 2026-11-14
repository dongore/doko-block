import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Section, Segmented, Sheet, Stepper } from '../components/ui';
import { signed, uid } from '../logic/format';
import { KIND_LABEL, SOLO_TYPES } from '../logic/labels';
import { baseDeltas, detectBockTriggers, emptyExtras, partyName, scoreGame, TRIGGER_LABEL } from '../logic/scoring';
import type { SessionView } from '../logic/session';
import { loadPrefs, savePrefs } from '../state/store';
import type { Ann, BockTrigger, Extras, Game, GameKind, Party, PlayerId, Session, SoloType } from '../state/types';

interface Draft {
  mode: 'calc' | 'quick';
  playerIds: PlayerId[];
  kind: GameKind;
  soloType: SoloType | null;
  pflicht: boolean | null;
  reIds: PlayerId[];
  augen: string;
  augenParty: Party;
  reAnn: Ann;
  kontraAnn: Ann;
  reExtras: Extras;
  kontraExtras: Extras;
  winner: Party | null;
  value: number | null;
  overrides: Partial<Record<BockTrigger, boolean>>;
  manual: number;
}

function initialDraft(session: Session, view: SessionView, editing?: Game): Draft {
  const prefs = loadPrefs();
  if (editing) {
    const c = editing.calc;
    const detected = new Set(detectBockTriggers(editing, scoreGame(editing, session.rules), session.rules));
    const stored: BockTrigger[] = editing.bockTriggers.filter((t) => t !== 'manual');
    const overrides: Draft['overrides'] = {};
    for (const t of ['tie120', 'lostAnnounced', 'lostSolo', 'zeroGame'] as BockTrigger[]) {
      const has = stored.includes(t);
      if (has !== detected.has(t)) overrides[t] = has;
    }
    return {
      mode: editing.mode,
      playerIds: [...editing.playerIds],
      kind: editing.kind,
      soloType: editing.soloType ?? null,
      pflicht: editing.pflicht ?? null,
      reIds: [...editing.reIds],
      augen: c ? String(prefs.augenParty === 're' ? c.reAugen : 240 - c.reAugen) : '',
      augenParty: prefs.augenParty,
      reAnn: c?.reAnn ?? 0,
      kontraAnn: c?.kontraAnn ?? 0,
      reExtras: c?.reExtras ?? emptyExtras(),
      kontraExtras: c?.kontraExtras ?? emptyExtras(),
      winner: editing.quick?.winner ?? null,
      value: editing.quick?.value ?? null,
      overrides,
      manual: editing.bockTriggers.filter((t) => t === 'manual').length,
    };
  }
  return {
    mode: prefs.entryMode,
    playerIds: [...view.next.playerIds],
    kind: 'normal',
    soloType: null,
    pflicht: null,
    reIds: [],
    augen: '',
    augenParty: prefs.augenParty,
    reAnn: 0,
    kontraAnn: 0,
    reExtras: emptyExtras(),
    kontraExtras: emptyExtras(),
    winner: null,
    value: null,
    overrides: {},
    manual: 0,
  };
}

const ANN_OPTIONS = (party: Party) =>
  [
    { value: 0 as Ann, label: '—' },
    { value: 1 as Ann, label: party === 're' ? 'Re' : 'Kontra' },
    { value: 2 as Ann, label: 'k. 90' },
    { value: 3 as Ann, label: 'k. 60' },
    { value: 4 as Ann, label: 'k. 30' },
    { value: 5 as Ann, label: 'schw.' },
  ];

export function GameEntrySheet({
  open,
  onClose,
  session,
  view,
  editing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  view: SessionView;
  editing?: Game;
  onSave: (game: Game, isNew: boolean) => void;
}) {
  return (
    <>{open && <EntryInner key={editing?.id ?? 'new'} onClose={onClose} session={session} view={view} editing={editing} onSave={onSave} />}</>
  );
}

function EntryInner({
  onClose,
  session,
  view,
  editing,
  onSave,
}: {
  onClose: () => void;
  session: Session;
  view: SessionView;
  editing?: Game;
  onSave: (game: Game, isNew: boolean) => void;
}) {
  const [d, setD] = useState<Draft>(() => initialDraft(session, view, editing));
  const [showErrors, setShowErrors] = useState(false);
  const [tableHint, setTableHint] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const { rules } = session;
  const name = (id: PlayerId) => session.players.find((p) => p.id === id)?.name ?? '?';
  const solo = d.kind === 'solo';
  const editView = editing ? view.games.find((g) => g.game.id === editing.id) : undefined;
  const number = editView ? editView.number : view.next.number;
  const dealerId = editing ? editing.dealerId : view.next.dealerId;
  const multiplier = editView ? editView.multiplier : view.next.bock.multiplier;
  const seated = editing ? Array.from(new Set([...session.seating, ...editing.playerIds])) : session.seating;
  const anyExtras = rules.extras.fuchs || rules.extras.doppelkopf || rules.extras.karlchen;

  // Pflichtsolo default: the soloist's first solo counts as Pflicht.
  const soloist = solo ? d.reIds[0] : undefined;
  const pflichtAlready = useMemo(() => {
    if (!soloist) return false;
    return session.games.some((g) => g.id !== editing?.id && g.kind === 'solo' && g.pflicht && g.reIds[0] === soloist);
  }, [soloist, session.games, editing?.id]);
  const pflicht = rules.pflichtsolo.enabled && solo ? (d.pflicht ?? !pflichtAlready) : false;

  const augenNum = d.augen.trim() === '' ? null : Number(d.augen);
  const augenValid = augenNum != null && Number.isInteger(augenNum) && augenNum >= 0 && augenNum <= 240;
  const reAugen = augenValid ? (d.augenParty === 're' ? augenNum! : 240 - augenNum!) : null;

  const problem = (() => {
    if (d.playerIds.length !== 4) return 'Wähle genau 4 Spieler am Tisch';
    if (solo && d.reIds.length !== 1) return 'Tippe den Solisten an';
    if (!solo && d.reIds.length !== 2) return d.reIds.length === 1 ? 'Wähle den zweiten Re-Spieler' : 'Tippe die beiden Re-Spieler an';
    if (d.mode === 'calc' && !augenValid) return d.augen.trim() === '' ? 'Trage die Augen ein' : 'Augen müssen zwischen 0 und 240 liegen';
    if (d.mode === 'quick' && d.value == null) return 'Wähle den Spielwert';
    if (d.mode === 'quick' && d.value !== 0 && !d.winner) return solo ? 'Hat der Solist gewonnen?' : 'Wer hat gewonnen?';
    return null;
  })();

  const game: Game | null = problem
    ? null
    : {
        id: editing?.id ?? uid(),
        createdAt: editing?.createdAt ?? Date.now(),
        dealerId,
        playerIds: d.playerIds,
        kind: d.kind,
        soloType: solo ? (d.soloType ?? undefined) : undefined,
        pflicht: solo ? pflicht : undefined,
        reIds: d.reIds,
        mode: d.mode,
        calc:
          d.mode === 'calc'
            ? { reAugen: reAugen!, reAnn: d.reAnn, kontraAnn: d.kontraAnn, reExtras: solo ? emptyExtras() : d.reExtras, kontraExtras: solo ? emptyExtras() : d.kontraExtras }
            : undefined,
        quick: d.mode === 'quick' ? { winner: d.value === 0 ? null : d.winner, value: d.value ?? 0 } : undefined,
        bockTriggers: [],
      };
  const result = game ? scoreGame(game, rules) : null;
  const detected = game && result ? detectBockTriggers(game, result, rules) : [];
  const triggerOn = (t: BockTrigger) => d.overrides[t] ?? detected.includes(t);
  const enabledTriggers = (['tie120', 'lostAnnounced', 'lostSolo', 'zeroGame'] as const).filter((t) => rules.bock.triggers[t]);
  const triggers: BockTrigger[] = rules.bock.enabled ? [...enabledTriggers.filter(triggerOn), ...Array(d.manual).fill('manual')] : [];
  const deltas = game && result ? baseDeltas(game, result.reValue) : {};

  const save = () => {
    if (!game) {
      setShowErrors(true);
      return;
    }
    savePrefs({ ...loadPrefs(), entryMode: d.mode, augenParty: d.augenParty });
    onSave({ ...game, bockTriggers: triggers }, !editing);
  };

  /* ----- interactions ----- */

  const toggleTable = (id: PlayerId) => {
    if (d.playerIds.includes(id)) {
      set({ playerIds: d.playerIds.filter((x) => x !== id), reIds: d.reIds.filter((x) => x !== id) });
      setTableHint(false);
    } else if (d.playerIds.length < 4) {
      const order = seated.filter((x) => x === id || d.playerIds.includes(x));
      set({ playerIds: order });
      setTableHint(false);
    } else setTableHint(true);
  };

  const tapParty = (id: PlayerId) => {
    if (solo) {
      set({ reIds: d.reIds[0] === id ? [] : [id], pflicht: null });
      return;
    }
    if (d.reIds.includes(id)) set({ reIds: d.reIds.filter((x) => x !== id) });
    else set({ reIds: d.reIds.length >= 2 ? [d.reIds[1], id] : [...d.reIds, id] });
  };

  const setKind = (kind: GameKind) => {
    const toSolo = kind === 'solo';
    const wasSolo = d.kind === 'solo';
    set({ kind, reIds: toSolo !== wasSolo ? (toSolo ? d.reIds.slice(0, 1) : d.reIds) : d.reIds, pflicht: null });
  };

  const setAugenParty = (p: Party) => {
    if (p === d.augenParty) return;
    set({ augenParty: p, augen: augenValid ? String(240 - augenNum!) : d.augen });
  };

  const stepAugen = (delta: number) => {
    const base = augenValid ? augenNum! : 120;
    set({ augen: String(Math.min(240, Math.max(0, base + delta))) });
  };

  const setExtra = (party: Party, key: keyof Extras, v: number) => {
    const k = party === 're' ? 'reExtras' : 'kontraExtras';
    set({ [k]: { ...d[k], [key]: v } } as Partial<Draft>);
  };

  /* ----- render ----- */

  const reLabel = solo ? 'Solist' : 'Re';
  const winnerText = (() => {
    if (!result) return null;
    if (result.winner == null) return 'Kein Gewinner';
    if (solo) return result.winner === 're' ? 'Solo gewonnen' : 'Solo verloren';
    return `${partyName(result.winner)} gewinnt`;
  })();
  const value = result ? Math.abs(result.reValue) : 0;

  return (
    <Sheet
      open
      onClose={onClose}
      size="full"
      title={editing ? `Spiel ${number} bearbeiten` : `Spiel ${number}`}
      subtitle={
        <>
          {name(dealerId)} gibt
          {multiplier > 1 && <span className="bock-pill bock-pill--sm">Bock ×{multiplier}</span>}
        </>
      }
      footer={
        <div className="entry-foot">
          <div className="entry-foot__summary" aria-live="polite">
            {result ? (
              <>
                <span className={`entry-foot__winner party-${result.winner ?? 'none'}`}>{winnerText}</span>
                <span className="entry-foot__value num">
                  {value} {value === 1 ? 'Punkt' : 'Punkte'}
                  {multiplier > 1 && value > 0 && (
                    <span className="entry-foot__bock">
                      {' '}
                      ×{multiplier} = {value * multiplier}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className={`entry-foot__hint${showErrors ? ' is-error' : ''}`}>{problem}</span>
            )}
          </div>
          <button type="button" className="btn btn--primary btn--lg" onClick={save} aria-disabled={!game}>
            <Icon name="check" /> {editing ? 'Speichern' : 'Eintragen'}
          </button>
        </div>
      }
    >
      <div className="entry">
        <div className="entry__mode">
          <Segmented
            label="Eingabeart"
            value={d.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'calc', label: 'Rechner' },
              { value: 'quick', label: 'Schnelleingabe' },
            ]}
          />
        </div>
        {seated.length > 4 && (
          <Section title="Am Tisch" aside={<span className="section__aside">{d.playerIds.length} von 4</span>}>
            <div className="chips">
              {seated.map((id) => (
                <button key={id} type="button" className="chip" aria-pressed={d.playerIds.includes(id)} onClick={() => toggleTable(id)}>
                  {name(id)}
                  {id === dealerId && <span className="chip__note">gibt</span>}
                </button>
              ))}
            </div>
            {tableHint && <p className="section__hint is-error">Es sind schon 4 Spieler gewählt. Tippe erst jemanden ab.</p>}
          </Section>
        )}

        <Section title="Spiel">
          <Segmented
            label="Spielart"
            value={d.kind}
            onChange={setKind}
            options={(['normal', 'hochzeit', 'armut', 'solo'] as GameKind[]).map((k) => ({ value: k, label: KIND_LABEL[k].replace('Normalspiel', 'Normal') }))}
          />
          {d.kind === 'hochzeit' && <p className="section__hint">Findet sich kein Partner, trage das Spiel als Solo ein.</p>}
          {d.kind === 'armut' && <p className="section__hint">Re-Partei sind der Spieler mit der Armut und wer sie übernimmt.</p>}
          {solo && (
            <>
              <div className="solo-grid" role="radiogroup" aria-label="Soloart">
                {SOLO_TYPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={d.soloType === s.value}
                    className="solo-opt"
                    onClick={() => set({ soloType: d.soloType === s.value ? null : s.value })}
                  >
                    <span className={`solo-opt__glyph${s.red ? ' is-red' : ''}`}>{s.glyph}</span>
                    <span className="solo-opt__label">{s.label}</span>
                  </button>
                ))}
              </div>
              {rules.pflichtsolo.enabled && (
                <div className="field field--row">
                  <Segmented
                    label="Pflicht- oder Lustsolo"
                    value={pflicht ? 'p' : 'l'}
                    onChange={(v) => set({ pflicht: v === 'p' })}
                    options={[
                      { value: 'p', label: 'Pflichtsolo' },
                      { value: 'l', label: 'Lustsolo' },
                    ]}
                  />
                  {soloist && pflichtAlready && pflicht && <span className="section__hint is-error">{name(soloist)} hat das Pflichtsolo schon gespielt.</span>}
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          title={solo ? 'Solist' : d.kind === 'hochzeit' ? 'Re-Partei (Hochzeit + Partner)' : d.kind === 'armut' ? 'Re-Partei (Armut + Übernehmer)' : 'Re-Partei'}
          aside={<span className="section__aside">{solo ? 'Antippen' : `${d.reIds.length} von 2`}</span>}
        >
          <div className="party-grid">
            {d.playerIds.map((id) => {
              const isRe = d.reIds.includes(id);
              const complete = solo ? d.reIds.length === 1 : d.reIds.length === 2;
              return (
                <button key={id} type="button" className={`party-btn${isRe ? ' is-re' : complete ? ' is-kontra' : ''}`} aria-pressed={isRe} onClick={() => tapParty(id)}>
                  <span className="party-btn__name">{name(id)}</span>
                  <span className="party-btn__tag">{isRe ? reLabel : complete ? 'Kontra' : ' '}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {d.mode === 'calc' ? (
          <>
            <Section
              title="Augen"
              aside={
                <Segmented
                  label="Augen gezählt für"
                  size="sm"
                  value={d.augenParty}
                  onChange={setAugenParty}
                  options={[
                    { value: 're', label: reLabel },
                    { value: 'kontra', label: 'Kontra' },
                  ]}
                />
              }
            >
              <div className="augen">
                <button type="button" className="augen__step" onClick={() => stepAugen(-1)} aria-label="Eine Auge weniger">
                  <Icon name="minus" strokeWidth={2.5} />
                </button>
                <label className="augen__field">
                  <span className="sr-only">Augen {d.augenParty === 're' ? reLabel : 'Kontra'}</span>
                  <input
                    id="augen-input"
                    className={`augen__input num${showErrors && !augenValid ? ' is-invalid' : ''}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    placeholder="Augen"
                    value={d.augen}
                    onChange={(e) => set({ augen: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button type="button" className="augen__step" onClick={() => stepAugen(1)} aria-label="Eine Auge mehr">
                  <Icon name="plus" strokeWidth={2.5} />
                </button>
              </div>
              <input
                id="augen-slider"
                type="range"
                className="augen__slider"
                min={0}
                max={240}
                step={1}
                value={augenValid ? augenNum! : 120}
                onChange={(e) => set({ augen: e.target.value })}
                aria-label="Augen grob einstellen"
                style={{ ['--fill' as string]: `${((augenValid ? augenNum! : 120) / 240) * 100}%` }}
              />
              <div className="augen__scale num" aria-hidden="true">
                {[0, 30, 60, 90, 120, 150, 180, 210, 240].map((v) => (
                  <button key={v} type="button" tabIndex={-1} onClick={() => set({ augen: String(v) })}>
                    {v}
                  </button>
                ))}
              </div>
              <p className="augen__split num">
                <span className="party-re">
                  {reLabel} {reAugen ?? '–'}
                </span>
                <span className="augen__sep">:</span>
                <span className="party-kontra">Kontra {reAugen == null ? '–' : 240 - reAugen}</span>
              </p>
            </Section>

            <Section title="Ansagen">
              <div className="ann">
                <span className="ann__label party-re">{reLabel}</span>
                <Segmented label={`Ansage ${reLabel}`} size="sm" className="seg--ann" value={d.reAnn} onChange={(reAnn) => set({ reAnn })} options={ANN_OPTIONS('re')} />
                <span className="ann__label party-kontra">Kontra</span>
                <Segmented label="Ansage Kontra" size="sm" className="seg--ann" value={d.kontraAnn} onChange={(kontraAnn) => set({ kontraAnn })} options={ANN_OPTIONS('kontra')} />
              </div>
            </Section>

            {!solo && anyExtras && (
              <Section title="Sonderpunkte">
                <div className="extras">
                  <span />
                  <span className="extras__col party-re">Re</span>
                  <span className="extras__col party-kontra">Kontra</span>
                  {rules.extras.fuchs && (
                    <>
                      <span className="extras__label">Fuchs gefangen</span>
                      <Stepper size="sm" label="Fuchs Re" value={d.reExtras.fuchs} max={2 - d.kontraExtras.fuchs} onChange={(v) => setExtra('re', 'fuchs', v)} />
                      <Stepper size="sm" label="Fuchs Kontra" value={d.kontraExtras.fuchs} max={2 - d.reExtras.fuchs} onChange={(v) => setExtra('kontra', 'fuchs', v)} />
                    </>
                  )}
                  {rules.extras.doppelkopf && (
                    <>
                      <span className="extras__label">Doppelkopf</span>
                      <Stepper size="sm" label="Doppelkopf Re" value={d.reExtras.doppelkopf} max={5 - d.kontraExtras.doppelkopf} onChange={(v) => setExtra('re', 'doppelkopf', v)} />
                      <Stepper size="sm" label="Doppelkopf Kontra" value={d.kontraExtras.doppelkopf} max={5 - d.reExtras.doppelkopf} onChange={(v) => setExtra('kontra', 'doppelkopf', v)} />
                    </>
                  )}
                  {rules.extras.karlchen && (
                    <>
                      <span className="extras__label">Karlchen</span>
                      {(['re', 'kontra'] as Party[]).map((p) => {
                        const on = (p === 're' ? d.reExtras : d.kontraExtras).karlchen > 0;
                        return (
                          <button
                            key={p}
                            type="button"
                            className="chip chip--check"
                            aria-pressed={on}
                            aria-label={`Karlchen ${partyName(p)}`}
                            onClick={() =>
                              set({
                                reExtras: { ...d.reExtras, karlchen: p === 're' && !on ? 1 : 0 },
                                kontraExtras: { ...d.kontraExtras, karlchen: p === 'kontra' && !on ? 1 : 0 },
                              })
                            }
                          >
                            <Icon name={on ? 'check' : 'plus'} size={16} strokeWidth={2.5} />
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </Section>
            )}
          </>
        ) : (
          <>
            <Section title={solo ? 'Ausgang' : 'Gewinner'}>
              <Segmented
                label="Gewinner"
                value={d.winner}
                onChange={(winner) => set({ winner })}
                options={
                  solo
                    ? [
                        { value: 're' as Party, label: 'Solo gewonnen' },
                        { value: 'kontra' as Party, label: 'Solo verloren' },
                      ]
                    : [
                        { value: 're' as Party, label: 'Re gewinnt' },
                        { value: 'kontra' as Party, label: 'Kontra gewinnt' },
                      ]
                }
              />
            </Section>
            <Section title="Spielwert" aside={<span className="section__aside">pro Spieler{multiplier > 1 ? ', ohne Bock' : ''}</span>}>
              <div className="value-grid">
                {Array.from({ length: 13 }, (_, i) => i).map((v) => (
                  <button key={v} type="button" className="value-opt num" aria-pressed={d.value === v} onClick={() => set({ value: v })}>
                    {v}
                  </button>
                ))}
                <Stepper size="sm" label="Spielwert" value={d.value ?? 0} min={0} max={99} onChange={(value) => set({ value })} />
              </div>
              {solo && <p className="section__hint">Der Solist bekommt oder zahlt das Dreifache.</p>}
            </Section>
          </>
        )}

        {result && game && (
          <Section title="Ergebnis" className="result">
            {result.note && <p className="result__note">{result.note}</p>}
            {result.lines.length > 0 && d.mode === 'calc' && (
              <ul className="breakdown">
                {result.lines.map((l, i) => (
                  <li key={i} className={`breakdown__line party-${l.party}`}>
                    <span className="breakdown__label">{l.label}</span>
                    <span className="breakdown__party">{l.party === 're' ? reLabel : 'Kontra'}</span>
                    <span className="breakdown__pts num">+{l.points}</span>
                  </li>
                ))}
                <li className="breakdown__total">
                  <span>Spielwert</span>
                  <span className="num">
                    {value}
                    {multiplier > 1 && value > 0 && <span className="bock-text"> ×{multiplier} = {value * multiplier}</span>}
                  </span>
                </li>
              </ul>
            )}
            <div className="deltas">
              {d.playerIds.map((id) => {
                const v = (deltas[id] ?? 0) * multiplier;
                return (
                  <div key={id} className={`delta ${v > 0 ? 'is-pos' : v < 0 ? 'is-neg' : ''}`}>
                    <span className="delta__name">{name(id)}</span>
                    <span className="delta__val num">{signed(v)}</span>
                  </div>
                );
              })}
            </div>

            {rules.bock.enabled && (
              <div className="bock-pick">
                <span className="field__label">
                  <Icon name="bolt" size={16} /> Bockrunde auslösen
                </span>
                <div className="chips">
                  {enabledTriggers.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip chip--bock"
                      aria-pressed={triggerOn(t)}
                      onClick={() => set({ overrides: { ...d.overrides, [t]: !triggerOn(t) } })}
                    >
                      {TRIGGER_LABEL[t]}
                      {detected.includes(t) && <span className="chip__note">erkannt</span>}
                    </button>
                  ))}
                  <span className="bock-pick__manual">
                    Von Hand
                    <Stepper size="sm" label="Bockrunden von Hand" value={d.manual} max={3} onChange={(manual) => set({ manual })} />
                  </span>
                </div>
                {triggers.length > 0 && (
                  <p className="section__hint bock-text">
                    {triggers.length === 1 ? 'Eine neue Bockrunde' : `${triggers.length} neue Bockrunden`} ab dem nächsten Spiel.
                  </p>
                )}
              </div>
            )}
          </Section>
        )}
      </div>
    </Sheet>
  );
}
