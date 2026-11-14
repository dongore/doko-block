import { useRef, useState } from 'react';
import { navigate } from '../App';
import { Icon, Logo } from '../components/Icon';
import { ConfirmSheet, PlayerDot, Sheet, useToast } from '../components/ui';
import { dateLabel, plain, plural, signed } from '../logic/format';
import { computeSession, ranking } from '../logic/session';
import { makeExampleSession } from '../state/example';
import { actions, getState, sanitize, useAppData } from '../state/store';
import type { Session } from '../state/types';
import { downloadText } from '../components/share';

export function Home() {
  const data = useAppData();
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Session | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Session | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const running = data.sessions.filter((s) => !s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  const finished = data.sessions.filter((s) => s.finishedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  const current = running[0];
  const others = [...running.slice(1), ...finished];

  const loadExample = () => {
    const s = makeExampleSession();
    actions.createSession(s);
    navigate({ name: 'session', id: s.id, tab: 'block' });
  };

  const exportAll = () => {
    const ok = downloadText(`doko-block-sicherung-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getState(), null, 2), 'application/json');
    toast(ok ? 'Sicherung gespeichert' : 'Speichern ist hier nicht möglich');
  };

  const importFile = async (file: File) => {
    try {
      const parsed = sanitize(JSON.parse(await file.text()));
      actions.importData(parsed);
      toast(`${plural(parsed.sessions.length, 'Spielabend', 'Spielabende')} wiederhergestellt`);
    } catch (e) {
      toast(e instanceof Error && e.message.startsWith('Keine') ? e.message : 'Die Datei ist keine Doko-Block-Sicherung');
    }
  };

  return (
    <div className="screen home">
      <header className="appbar appbar--home">
        <div className="appbar__inner">
          <div className="wordmark">
            <Logo size={34} />
            <span>Doko-Block</span>
          </div>
        </div>
      </header>

      <main className="home__main page">
        {current ? (
          <CurrentCard session={current} />
        ) : (
          <section className="hero">
            <div className="hero__copy">
              <h1 className="hero__title">Der Spielblock für Doppelkopf.</h1>
              <p className="hero__text">
                Punkte nach DDV-Regeln ausrechnen oder schnell eintragen, Bockrunden und Pflichtsoli im Blick behalten und am Ende per Knopfdruck abrechnen.
              </p>
            </div>
            <BlockIllustration />
          </section>
        )}

        <div className="home__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate({ name: 'setup' })}>
            <Icon name="plus" /> Neuer Spielabend
          </button>
          {data.sessions.length === 0 && (
            <button type="button" className="btn btn--ghost btn--lg" onClick={loadExample}>
              Beispiel ansehen
            </button>
          )}
        </div>

        {others.length > 0 && (
          <section className="history">
            <h2 className="eyebrow">Frühere Spielabende</h2>
            <ul className="history__list">
              {others.map((s) => (
                <SessionRow key={s.id} session={s} onMenu={() => setMenuFor(s)} />
              ))}
            </ul>
          </section>
        )}

        <section className="home__backup">
          <h2 className="eyebrow">Daten</h2>
          <p className="muted">Alles wird nur auf diesem Gerät gespeichert. Sichere deine Spielabende ab und zu als Datei.</p>
          <div className="btn-row btn-row--start">
            {!__SINGLE__ && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={exportAll} disabled={data.sessions.length === 0}>
                <Icon name="download" size={18} /> Sichern
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={18} /> Wiederherstellen
            </button>
            <input
              ref={fileInput}
              id="import-file"
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = '';
              }}
            />
          </div>
          <p className="version">Version {__APP_VERSION__}</p>
        </section>
      </main>

      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name ?? ''} subtitle={menuFor ? dateLabel(menuFor.createdAt) : ''}>
        {menuFor && (
          <div className="menu-list">
            <button type="button" className="menu-item" onClick={() => navigate({ name: 'session', id: menuFor.id, tab: 'block' })}>
              <Icon name="block" /> Öffnen
            </button>
            <button type="button" className="menu-item" onClick={() => navigate({ name: 'setup', fromId: menuFor.id })}>
              <Icon name="play" /> Mit denselben Spielern neu starten
            </button>
            <button
              type="button"
              className="menu-item menu-item--danger"
              onClick={() => {
                setConfirmDelete(menuFor);
                setMenuFor(null);
              }}
            >
              <Icon name="trash" /> Löschen
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!confirmDelete}
        title="Spielabend löschen?"
        text={confirmDelete ? `„${confirmDelete.name}“ mit ${plural(confirmDelete.games.length, 'Spiel', 'Spielen')} wird von diesem Gerät gelöscht.` : ''}
        confirmLabel="Löschen"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const s = confirmDelete;
          const index = getState().sessions.findIndex((x) => x.id === s.id);
          actions.deleteSession(s.id);
          toast('Spielabend gelöscht', { label: 'Rückgängig', run: () => actions.restoreSession(s, index) });
        }}
      />
    </div>
  );
}

/** A static sketch of a filled-in block sheet (decoration only). */
function BlockIllustration() {
  const names = ['Anna', 'Ben', 'Carla', 'David'];
  const totals = [5, -7, 11, -9];
  const rows: { points: number[]; value: number; bock?: boolean; solo?: boolean }[] = [
    { points: [1, 1, -1, -1], value: 1 },
    { points: [-2, 2, -2, 2], value: 2 },
    { points: [8, -8, 8, -8], value: 4, bock: true },
    { points: [-2, -2, 6, -2], value: 2, solo: true },
  ];
  return (
    <div className="illu" aria-hidden="true">
      <div className="illu__sheet" style={{ ['--n' as string]: 4 }}>
        <div className="grid-row block-head illu__head">
          <span className="bh-no" />
          {names.map((n, i) => (
            <span key={n} className={`bh-player${i === 2 ? ' is-lead' : ''}`} style={{ ['--pc' as string]: `var(--p${i + 1})` }}>
              <span className="bh-name">
                <span className="bh-name__text">{n}</span>
              </span>
              <span className={`bh-total num${totals[i] < 0 ? ' is-neg' : ''}`}>{plain(totals[i])}</span>
            </span>
          ))}
          <span className="bh-val" />
        </div>
        <div className="illu__paper">
          {rows.map((r, k) => (
            <div key={k} className={`grid-row brow${r.bock ? ' is-bock' : ''}`}>
              <span className="bc-no">
                <span className="num">{k + 1}</span>
                {r.solo && <span className="mark-solo">D</span>}
              </span>
              {r.points.map((v, i) => (
                <span key={i} className={`bc${v > 0 ? ' is-win' : ''}${v < 0 ? ' is-minus' : ''}`}>
                  <span className="num">{signed(v)}</span>
                </span>
              ))}
              <span className="bc-val">
                <span className="num">{r.value}</span>
                {r.bock && <span className="bc-val__x num">×2</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrentCard({ session }: { session: Session }) {
  const view = computeSession(session);
  const ranks = ranking(session.players, view.totals);
  const dealer = session.players.find((p) => p.id === view.next.dealerId);
  return (
    <section className="current">
      <div className="current__head">
        <span className="eyebrow eyebrow--on-chrome">Läuft gerade</span>
        <h1 className="current__title">{session.name}</h1>
        <p className="current__meta">
          {session.games.length === 0 ? 'Noch kein Spiel' : `${plural(session.games.length, 'Spiel', 'Spiele')} · Runde ${view.next.round}`} · {dealer?.name} gibt
          {view.next.bock.multiplier > 1 && <span className="bock-pill bock-pill--sm">Bock ×{view.next.bock.multiplier}</span>}
        </p>
      </div>
      <ol className="mini-standings">
        {ranks.map((r) => (
          <li key={r.player.id}>
            <span className="mini-standings__rank">{r.rank}.</span>
            <PlayerDot index={session.players.indexOf(r.player)} />
            <span className="mini-standings__name">{r.player.name}</span>
            <span className={`mini-standings__score num ${r.score < 0 ? 'is-neg' : ''}`}>{plain(r.score)}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => navigate({ name: 'session', id: session.id, tab: 'block' })}>
        Weiterspielen <Icon name="chevron" />
      </button>
    </section>
  );
}

function SessionRow({ session, onMenu }: { session: Session; onMenu: () => void }) {
  const view = computeSession(session);
  const top = ranking(session.players, view.totals)[0];
  return (
    <li className="history__item">
      <button type="button" className="history__open" onClick={() => navigate({ name: 'session', id: session.id, tab: 'block' })}>
        <span className="history__name">
          {session.name}
          {session.example && <span className="tag">Beispiel</span>}
          {!session.finishedAt && !session.example && <span className="tag tag--live">läuft</span>}
        </span>
        <span className="history__meta">
          {dateLabel(session.createdAt)} · {plural(session.games.length, 'Spiel', 'Spiele')} · {session.players.map((p) => p.name).join(', ')}
        </span>
        {top && session.games.length > 0 && (
          <span className="history__winner">
            Vorne: <strong>{top.player.name}</strong> <span className="num">{plain(top.score)}</span>
          </span>
        )}
      </button>
      <button type="button" className="icon-btn" onClick={onMenu} aria-label={`Optionen für ${session.name}`}>
        <Icon name="more" />
      </button>
    </li>
  );
}
