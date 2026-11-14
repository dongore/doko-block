import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { navigate } from '../App';
import { DealerIcon, Icon } from '../components/Icon';
import { ConfirmSheet, Segmented, Sheet, Switch, useToast } from '../components/ui';
import { shareText } from '../components/share';
import { useWakeLock } from '../components/useWakeLock';
import { dateLabel, plain, plural, signed } from '../logic/format';
import { soloInfo } from '../logic/labels';
import { computeSession, type GameView, type SessionView } from '../logic/session';
import { actions, getState, loadPrefs, savePrefs, useAppData, useSession, type Prefs } from '../state/store';
import type { Game, PlayerId, Session } from '../state/types';
import { GameDetailSheet } from './GameDetail';
import { GameEntrySheet } from './GameEntry';
import { resultText } from '../logic/shareText';
import { MoneyView } from './MoneyView';
import { BockSheet, PlayersSheet, RenameSheet, RulesSheet } from './SessionSheets';
import { StatsView } from './StatsView';

export type SessionTab = 'block' | 'stats' | 'money';

type SheetName = null | 'menu' | 'players' | 'rules' | 'bock' | 'rename' | 'finish' | 'delete';

export function SessionScreen({ id, tab: requestedTab }: { id: string; tab: SessionTab }) {
  const session = useSession(id);
  const moneyOn = session?.rules.money.enabled ?? true;
  const tab: SessionTab = requestedTab === 'money' && !moneyOn ? 'block' : requestedTab;
  const data = useAppData();
  const toast = useToast();
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [entry, setEntry] = useState<{ open: boolean; editing?: Game }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const view = useMemo(() => (session ? computeSession(session) : null), [session]);
  const scrollToEnd = useRef(false);
  /** The game just entered, highlighted briefly so you see where it landed. */
  const [freshId, setFreshId] = useState<string | null>(null);

  useEffect(() => {
    if (!freshId) return;
    const t = window.setTimeout(() => setFreshId(null), 2800);
    return () => window.clearTimeout(t);
  }, [freshId]);

  useWakeLock(data.keepAwake && tab === 'block' && !!session && !session.finishedAt);

  useEffect(() => {
    if (scrollToEnd.current) {
      scrollToEnd.current = false;
      requestAnimationFrame(() => document.getElementById('next-row')?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  }, [session?.games.length]);

  useEffect(() => {
    // Open at the latest game.
    if (tab === 'block') requestAnimationFrame(() => document.getElementById('next-row')?.scrollIntoView({ block: 'end' }));
  }, [tab, id]);

  if (!session || !view) {
    return (
      <div className="screen">
        <header className="appbar">
          <div className="appbar__inner">
            <button type="button" className="icon-btn icon-btn--on-chrome" onClick={() => navigate({ name: 'home' })} aria-label="Zur Übersicht">
              <Icon name="back" />
            </button>
            <h1 className="appbar__title">Nicht gefunden</h1>
          </div>
        </header>
        <main className="page empty">
          <p className="empty__title">Diesen Spielabend gibt es auf diesem Gerät nicht.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'home' })}>
            Zur Übersicht
          </button>
        </main>
      </div>
    );
  }

  const setPrefs = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefsState(next);
    savePrefs(next);
  };
  const name = (pid: PlayerId) => session.players.find((p) => p.id === pid)?.name ?? '?';
  const finished = !!session.finishedAt;
  const detail = detailId ? (view.games.find((g) => g.game.id === detailId) ?? null) : null;

  const saveGame = (game: Game, isNew: boolean) => {
    if (isNew) {
      scrollToEnd.current = true;
      setFreshId(game.id);
      actions.addGame(session.id, game);
      navigator.vibrate?.(12);
      toast(`Spiel ${session.games.length + 1} eingetragen`, { label: 'Rückgängig', run: () => actions.deleteGame(session.id, game.id) });
    } else {
      actions.updateGame(session.id, game);
      toast('Änderung gespeichert');
    }
    setEntry({ open: false });
  };

  const deleteGame = (gv: GameView) => {
    const before = getState().sessions.find((s) => s.id === session.id);
    actions.deleteGame(session.id, gv.game.id);
    setDetailId(null);
    toast(`Spiel ${gv.number} gelöscht`, {
      label: 'Rückgängig',
      run: () => before && actions.updateSession(session.id, () => before),
    });
  };

  const setTab = (t: SessionTab) => navigate({ name: 'session', id: session.id, tab: t }, true);

  return (
    <div className={`screen session session--${tab}`}>
      <div className="session__top">
        <header className="appbar">
          <div className="appbar__inner">
            <button type="button" className="icon-btn icon-btn--on-chrome" onClick={() => navigate({ name: 'home' })} aria-label="Zur Übersicht">
              <Icon name="back" />
            </button>
            <div className="appbar__titles">
              <h1 className="appbar__title">{session.name}</h1>
              <span className="appbar__sub">
                {tab === 'stats' ? 'Statistik · ' : tab === 'money' ? 'Abrechnung · ' : ''}
                {finished
                  ? `Beendet · ${plural(session.games.length, 'Spiel', 'Spiele')}`
                  : `${plural(session.games.length, 'Spiel', 'Spiele')} · Runde ${view.next.round}${session.rules.rounds ? ` von ${session.rules.rounds}` : ''}`}
              </span>
            </div>
            <nav className="viewtabs" aria-label="Ansicht">
              {(
                [
                  ['block', 'Block', 'block'],
                  ['stats', 'Statistik', 'chart'],
                  ['money', 'Abrechnung', 'coins'],
                ] as const
              )
                .filter(([t]) => t !== 'money' || moneyOn)
                .map(([t, label, icon]) => (
                  <button
                    key={t}
                    type="button"
                    className="viewtab"
                    aria-current={tab === t ? 'page' : undefined}
                    aria-label={label}
                    title={label}
                    onClick={() => setTab(t)}
                  >
                    <Icon name={icon} size={20} />
                  </button>
                ))}
            </nav>
            <button type="button" className="icon-btn icon-btn--on-chrome" onClick={() => setSheet('menu')} aria-label="Mehr">
              <Icon name="more" />
            </button>
          </div>
        </header>
        {tab === 'block' && <BlockHead session={session} view={view} />}
      </div>

      {session.example && (
        <div className="example-note">
          <Icon name="info" size={18} /> Das ist ein Beispiel-Spielabend zum Ausprobieren. Er verschwindet, sobald du deinen ersten eigenen startest.
        </div>
      )}

      {tab === 'block' && (
        <BlockBody
          session={session}
          view={view}
          cellMode={prefs.cellMode}
          freshId={freshId}
          onOpen={(gv) => setDetailId(gv.game.id)}
          onNew={() => !finished && setEntry({ open: true })}
          finished={finished}
        />
      )}
      {tab === 'stats' && <StatsView session={session} view={view} />}
      {tab === 'money' && <MoneyView session={session} view={view} />}

      {tab === 'block' && (
        <BottomBar
          session={session}
          view={view}
          onEntry={() => setEntry({ open: true })}
          onBock={() => setSheet('bock')}
          onFinish={() => setSheet('finish')}
        />
      )}

      <GameEntrySheet open={entry.open} onClose={() => setEntry({ open: false })} session={session} view={view} editing={entry.editing} onSave={saveGame} />

      {detail && !entry.open && (
        <GameDetailSheet
          gv={detail}
          session={session}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEntry({ open: true, editing: detail.game });
            setDetailId(null);
          }}
          onDelete={() => deleteGame(detail)}
        />
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={session.name} subtitle={`Angefangen am ${dateLabel(session.createdAt)}`}>
        <div className="menu-list">
          <button type="button" className="menu-item" onClick={() => setSheet('players')}>
            <Icon name="users" /> Spieler & Sitzordnung
          </button>
          <button type="button" className="menu-item" onClick={() => setSheet('rules')}>
            <Icon name="sliders" /> Regeln
          </button>
          <button type="button" className="menu-item" onClick={() => setSheet('rename')}>
            <Icon name="edit" /> Umbenennen
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={async () => {
              const r = await shareText(session.name, resultText(session, view));
              if (r === 'copied') toast('Ergebnis kopiert');
              if (r === 'failed') toast('Teilen ist hier nicht möglich');
            }}
          >
            <Icon name="share" /> Ergebnis teilen
          </button>
        </div>
        <div className="menu-settings">
          <div className="field field--row">
            <span className="field__label">Zellen im Block zeigen</span>
            <Segmented
              label="Zellen im Block zeigen"
              size="sm"
              value={prefs.cellMode}
              onChange={(cellMode) => setPrefs({ cellMode })}
              options={[
                { value: 'stand', label: 'Stand' },
                { value: 'punkte', label: 'Punkte' },
              ]}
            />
          </div>
          <Switch label="Bildschirm anlassen" hint="Während der Block offen ist" checked={data.keepAwake} onChange={actions.setKeepAwake} />
        </div>
        <div className="menu-list">
          {finished ? (
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                actions.updateSession(session.id, (s) => ({ ...s, finishedAt: undefined }));
                setSheet(null);
              }}
            >
              <Icon name="play" /> Spielabend fortsetzen
            </button>
          ) : (
            <button type="button" className="menu-item" onClick={() => setSheet('finish')}>
              <Icon name="flag" /> Spielabend beenden
            </button>
          )}
          <button type="button" className="menu-item menu-item--danger" onClick={() => setSheet('delete')}>
            <Icon name="trash" /> Spielabend löschen
          </button>
        </div>
      </Sheet>

      {sheet === 'players' && <PlayersSheet session={session} view={view} onClose={() => setSheet(null)} />}
      {sheet === 'rules' && <RulesSheet session={session} onClose={() => setSheet(null)} />}
      {sheet === 'bock' && <BockSheet session={session} view={view} onClose={() => setSheet(null)} />}
      {sheet === 'rename' && <RenameSheet session={session} onClose={() => setSheet(null)} />}

      <ConfirmSheet
        open={sheet === 'finish'}
        title="Spielabend beenden?"
        text={
          <>
            Der Block wird abgeschlossen. Du kannst ihn später über das Menü fortsetzen.
            {session.rules.pflichtsolo.enabled && openPflicht(session, view).length > 0 && (
              <>
                <br />
                <strong>Pflichtsolo noch offen: {openPflicht(session, view).map(name).join(', ')}.</strong>
              </>
            )}
          </>
        }
        confirmLabel="Beenden"
        onClose={() => setSheet(null)}
        onConfirm={() => {
          actions.updateSession(session.id, (s) => ({ ...s, finishedAt: Date.now() }));
          setTab(moneyOn ? 'money' : 'stats');
        }}
      />
      <ConfirmSheet
        open={sheet === 'delete'}
        title="Spielabend löschen?"
        text={`„${session.name}“ mit ${plural(session.games.length, 'Spiel', 'Spielen')} wird von diesem Gerät gelöscht.`}
        confirmLabel="Löschen"
        danger
        onClose={() => setSheet(null)}
        onConfirm={() => {
          const index = getState().sessions.findIndex((s) => s.id === session.id);
          const copy = session;
          actions.deleteSession(session.id);
          navigate({ name: 'home' }, true);
          toast('Spielabend gelöscht', { label: 'Rückgängig', run: () => actions.restoreSession(copy, index) });
        }}
      />
    </div>
  );
}

function openPflicht(session: Session, view: SessionView): PlayerId[] {
  return session.seating.filter((id) => !view.pflichtDone[id]);
}

/** Column order: current table first, then players who left. */
function columnsOf(session: Session): PlayerId[] {
  return [...session.seating, ...session.players.filter((p) => !session.seating.includes(p.id)).map((p) => p.id)];
}

function BlockHead({ session, view }: { session: Session; view: SessionView }) {
  const cols = columnsOf(session);
  const max = Math.max(...cols.map((id) => view.totals[id] ?? 0));
  const finished = !!session.finishedAt;
  return (
    <div className={`block-head${cols.length >= 6 ? ' is-dense' : ''}`} style={{ '--n': cols.length } as CSSProperties}>
      <div className="grid-row">
        <div className="bh-no" aria-hidden="true" />
        {cols.map((id) => {
          const p = session.players.find((x) => x.id === id)!;
          const seated = session.seating.includes(id);
          const total = view.totals[id] ?? 0;
          const isDealer = !finished && view.next.dealerId === id;
          const out = !finished && seated && view.next.sittingOut.includes(id);
          return (
            <div
              key={id}
              className={`bh-player${!seated ? ' is-away' : ''}${out ? ' is-sitting-out' : ''}${total === max && view.games.length > 0 ? ' is-lead' : ''}`}
              title={out ? (isDealer ? `${p.name} gibt und setzt aus` : `${p.name} setzt aus`) : undefined}
              style={{ '--pc': `var(--p${(session.players.indexOf(p) % 7) + 1})` } as CSSProperties}
            >
              <span className="bh-name">
                <span className="bh-name__text">{p.name}</span>
              </span>
              <span className={`bh-total num${total < 0 ? ' is-neg' : ''}`}>{plain(total)}</span>
              <span className="bh-flags">
                {isDealer && (
                  <span className="dealer-mark" title="gibt">
                    <DealerIcon size={16} />
                    <span className="sr-only">gibt</span>
                  </span>
                )}
                {out && !isDealer && <span className="flag">aus</span>}
                {session.rules.pflichtsolo.enabled && seated && (
                  <span className={`pflicht-mark${view.pflichtDone[id] ? ' is-done' : ''}`} title={view.pflichtDone[id] ? 'Pflichtsolo gespielt' : 'Pflichtsolo offen'}>
                    P<span className="sr-only">{view.pflichtDone[id] ? 'flichtsolo gespielt' : 'flichtsolo offen'}</span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="bh-val" aria-hidden="true" />
      </div>
    </div>
  );
}

function BlockBody({
  session,
  view,
  cellMode,
  freshId,
  onOpen,
  onNew,
  finished,
}: {
  session: Session;
  view: SessionView;
  cellMode: Prefs['cellMode'];
  freshId: string | null;
  onOpen: (gv: GameView) => void;
  onNew: () => void;
  finished: boolean;
}) {
  const cols = columnsOf(session);
  const name = (id: PlayerId) => session.players.find((p) => p.id === id)?.name ?? '?';
  const next = view.next;
  const rounds = session.rules.rounds;
  const nextText = (
    <>
      <strong>{name(next.dealerId)}</strong> gibt
      {next.sittingOut.filter((x) => x !== next.dealerId).length > 0 && <> · {next.sittingOut.filter((x) => x !== next.dealerId).map(name).join(', ')} aus</>}
      {next.sittingOut.includes(next.dealerId) && next.sittingOut.length === 1 && <> und setzt aus</>}
    </>
  );

  return (
    <main className="block" style={{ '--n': cols.length } as CSSProperties}>
      {view.games.length === 0 ? (
        <div className="block-empty">
          <p className="block-empty__title">Bereit für das erste Spiel</p>
          <p>
            {name(next.dealerId)} gibt. Es spielen {next.playerIds.map(name).join(', ')}.
          </p>
          <p className="muted">Nach jedem Spiel tippst du auf „Spiel eintragen“. Der Block rechnet, wechselt den Geber und merkt sich Bockrunden.</p>
        </div>
      ) : (
        <ol className="block-rows" aria-label="Spiele">
          {view.games.map((gv) => (
            <Fragment key={gv.game.id}>
              {gv.roundStart && gv.round > 1 && (
                <li className="round-sep" aria-hidden="true">
                  <span>
                    Runde {gv.round}
                    {rounds ? ` von ${rounds}` : ''}
                  </span>
                </li>
              )}
              <li>
                <GameRow gv={gv} cols={cols} cellMode={cellMode} fresh={gv.game.id === freshId} onOpen={() => onOpen(gv)} />
              </li>
            </Fragment>
          ))}
        </ol>
      )}
      {!finished && (
        <button type="button" id="next-row" className="next-row" onClick={onNew}>
          <span className="next-row__no num">{next.number}</span>
          <span className="next-row__text">
            {view.plannedDone ? 'Zusatzspiel' : `Runde ${next.round}${rounds ? ` von ${rounds}` : ''}`} · {nextText}
          </span>
          {next.bock.multiplier > 1 && <span className="bock-pill bock-pill--sm">×{next.bock.multiplier}</span>}
        </button>
      )}
      {finished && (
        <div className="finished-note" id="next-row">
          <Icon name="flag" size={18} /> Beendet am {dateLabel(session.finishedAt!)}
        </div>
      )}
    </main>
  );
}

function GameRow({
  gv,
  cols,
  cellMode,
  fresh,
  onOpen,
}: {
  gv: GameView;
  cols: PlayerId[];
  cellMode: Prefs['cellMode'];
  fresh: boolean;
  onOpen: () => void;
}) {
  const { game, result } = gv;
  const solo = game.kind === 'solo';
  const s = solo ? soloInfo(game.soloType) : undefined;
  const value = Math.abs(result.reValue);
  return (
    <button
      type="button"
      className={`grid-row brow${gv.multiplier > 1 ? ' is-bock' : ''}${gv.multiplier > 2 ? ' is-bock2' : ''}${fresh ? ' is-fresh' : ''}`}
      onClick={onOpen}
      aria-label={`Spiel ${gv.number} ansehen`}
    >
      <span className="bc-no">
        <span className="num">{gv.number}</span>
        <span className="bc-marks">
          {solo && <span className={`mark-solo${s?.red ? ' is-red' : ''}`}>{s?.glyph ?? 'S'}</span>}
          {game.bockTriggers.length > 0 && <span className="mark-bock">B{game.bockTriggers.length > 1 ? game.bockTriggers.length : ''}</span>}
        </span>
      </span>
      {cols.map((id) => {
        const playing = game.playerIds.includes(id);
        const d = gv.deltas[id] ?? 0;
        const isSoloist = solo && game.reIds[0] === id;
        const shown = cellMode === 'stand' ? (gv.totals[id] ?? 0) : d;
        const cls = `bc${!playing ? ' is-out' : d > 0 ? ' is-win' : d < 0 ? ' is-loss' : ''}${isSoloist ? ' is-solo' : ''}${playing && shown < 0 ? ' is-minus' : ''}`;
        return (
          <span key={id} className={cls}>
            <span className="num">{cellMode === 'stand' ? plain(shown) : playing ? signed(d) : '·'}</span>
          </span>
        );
      })}
      <span className="bc-val">
        <span className="num">{value}</span>
        {gv.multiplier > 1 && <span className="bc-val__x num">×{gv.multiplier}</span>}
      </span>
    </button>
  );
}

function BottomBar({
  session,
  view,
  onEntry,
  onBock,
  onFinish,
}: {
  session: Session;
  view: SessionView;
  onEntry: () => void;
  onBock: () => void;
  onFinish: () => void;
}) {
  const finished = !!session.finishedAt;
  const name = (id: PlayerId) => session.players.find((p) => p.id === id)?.name ?? '?';
  const bock = view.next.bock;
  const rounds = session.rules.rounds;
  const openP = session.rules.pflichtsolo.enabled ? openPflicht(session, view) : [];
  const lastRound = rounds != null && view.next.round >= rounds;

  if (finished) {
    return (
      <div className="bottombar">
        <div className="bottombar__inner bottombar__row">
          <span className="bottombar__text">Spielabend beendet</span>
          <button type="button" className="btn btn--primary" onClick={() => actions.updateSession(session.id, (s) => ({ ...s, finishedAt: undefined }))}>
            <Icon name="play" size={18} /> Fortsetzen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bottombar">
      <div className="bottombar__inner">
        {view.plannedDone ? (
          <div className="notice notice--done">
            <span>
              Alle {rounds} Runden gespielt{bock.remainingGames > 0 ? `, noch ${plural(bock.remainingGames, 'Bock-Spiel', 'Bock-Spiele')} offen` : ''}.
            </span>
            <button type="button" className="btn btn--text btn--sm" onClick={onFinish}>
              Beenden
            </button>
          </div>
        ) : (
          lastRound &&
          openP.length > 0 && (
            <div className="notice">
              Letzte Runde · Pflichtsolo offen: <strong>{openP.map(name).join(', ')}</strong>
            </div>
          )
        )}
        <div className="bottombar__row">
          {bock.multiplier > 1 ? (
            <button
              type="button"
              className="btn btn--bock-ghost is-active"
              onClick={onBock}
              aria-label={`Bock ×${bock.multiplier}, noch ${plural(bock.remainingGames, 'Spiel', 'Spiele')}`}
            >
              <Icon name="bolt" size={18} />
              <span className="num">
                ×{bock.multiplier} <small>· {bock.remainingGames}</small>
              </span>
            </button>
          ) : (
            <button type="button" className="btn btn--bock-ghost btn--icon" onClick={onBock} aria-label="Bockrunden" title="Bockrunde auslösen">
              <Icon name="bolt" size={20} />
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg btn--grow" onClick={onEntry}>
            <Icon name="plus" /> Spiel eintragen
          </button>
        </div>
      </div>
    </div>
  );
}
